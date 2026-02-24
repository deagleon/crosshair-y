import { app, BrowserWindow, screen, ipcMain, Display } from "electron";
import path from "path";

/** Which display to place the crosshair on. */
type DisplayTarget = "primary" | "cursor" | number;

/**
 * CrosshairOverlay manages the transparent, always-on-top overlay window
 * that displays the crosshair. It exposes methods for updating all visual
 * properties (size, hue, rotation, opacity, canvas params) and handles
 * window positioning across multiple monitors.
 *
 * A single instance is created at application startup and reused for the
 * entire session. IPC handlers are registered exactly once in the constructor
 * to avoid MaxListenersExceededWarnings.
 */
class CrosshairOverlay {
  public window: BrowserWindow | null = null;

  // ── Visual properties ──────────────────────────────────────────────────────
  public size: number = 40;
  public hue: number = 0;
  public rotation: number = 0;
  public opacity: number = 1;

  // ── Canvas crosshair dimensions (used to size the window correctly) ────────
  public canvasGap: number = 4;
  public canvasLength: number = 8;
  public canvasThickness: number = 2;
  public isCanvas: boolean = false;

  // ── Fixed-position mode ────────────────────────────────────────────────────
  public fixedPosition: boolean = false;
  public xPosition: number = 0;
  public yPosition: number = 0;

  /** Which display the crosshair is anchored to. */
  public displayTarget: DisplayTarget = "primary";

  private imagePath: string = "";
  private handlersRegistered: boolean = false;

  constructor() {
    // Register all IPC handlers once to prevent listener accumulation.
    this._registerHandlers();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Resolves the active Display based on the current displayTarget setting.
   * Falls back to the primary display if the target cannot be resolved.
   */
  private getTargetDisplay(): Display {
    const all = screen.getAllDisplays();

    if (this.displayTarget === "cursor") {
      // Place on whichever screen the cursor is currently on.
      const point = screen.getCursorScreenPoint();
      return screen.getDisplayNearestPoint(point) ?? screen.getPrimaryDisplay();
    }

    if (typeof this.displayTarget === "number") {
      // Target a display by its index in the displays array.
      const byIndex = all[this.displayTarget];
      if (byIndex) return byIndex;
      console.warn(
        `[CrosshairOverlay] Display index ${this.displayTarget} not found, falling back to primary.`,
      );
    }

    return screen.getPrimaryDisplay();
  }

  /**
   * Registers all IPC listeners exactly once.
   * Guard flag prevents double-registration if open() is called multiple times.
   */
  private _registerHandlers() {
    if (this.handlersRegistered) return;
    this.handlersRegistered = true;

    // Reply with the current crosshair path so the renderer can load it.
    ipcMain.on("load-crosshair", (event) => {
      event.reply("crosshair-loaded", this.imagePath);
    });

    // Toggle fixed-position mode and reposition the window immediately.
    ipcMain.on("change-fixed-position", (_event, fixedPosition) => {
      this.fixedPosition = fixedPosition;
      this.setBounds();
    });

    // Snap the crosshair to the center of the current target display.
    ipcMain.on("recenter-crosshair", (event) => {
      if (!this.fixedPosition) {
        this.setBounds();
        event.reply("center-coords", this.getCenterCoords());
      }
    });

    // Update absolute X position (only repositions when in fixed-position mode).
    ipcMain.on("change-x-position", (_event, xPosition) => {
      this.xPosition = xPosition;
      if (this.fixedPosition) this.setBounds();
    });

    // Update absolute Y position (only repositions when in fixed-position mode).
    ipcMain.on("change-y-position", (_event, yPosition) => {
      this.yPosition = yPosition;
      if (this.fixedPosition) this.setBounds();
    });

    // Return the current physical cursor coordinates to the renderer.
    ipcMain.on("get-mouse-position", (event) => {
      const { x, y } = screen.getCursorScreenPoint();
      event.reply("mouse-position", { x, y });
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Updates canvas crosshair dimension parameters.
   * Triggers a bounds recalculation only when a canvas style is active,
   * since PNG/SVG crosshairs have a fixed window size driven by `this.size`.
   */
  setCanvasParams(params: { gap?: number; length?: number; thickness?: number }) {
    if (params.gap !== undefined) this.canvasGap = params.gap;
    if (params.length !== undefined) this.canvasLength = params.length;
    if (params.thickness !== undefined) this.canvasThickness = params.thickness;
    if (this.isCanvas) this.setBounds();
  }

  /**
   * Opens (or reuses) the overlay window and loads the given crosshair.
   * @param imagePath - Either "canvas:<StyleName>" or an absolute file path.
   */
  async open(imagePath: string) {
    this.imagePath = imagePath;
    this.isCanvas = imagePath.startsWith("canvas:");
    await app.whenReady();

    if (!this.window) {
      this.window = new BrowserWindow({
        width: this.size,
        height: this.size,
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        alwaysOnTop: true,
        focusable: false,
        skipTaskbar: true,
        hasShadow: false,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, "preload.js"),
        },
      });

      this.window.loadFile("./public/crosshair.html");
      this.setBounds();
      this.window.setIgnoreMouseEvents(true); // Overlay must not capture input.

      this.window.once("ready-to-show", () => {
        console.log("CrosshairOverlay window is ready to show");
        this.window?.show();
        this.applyOpacity();
      });

      // Re-send visual parameters after the page fully reloads.
      this.window.webContents.on("did-finish-load", () => {
        this.window?.webContents.send("load-crosshair", imagePath);
        // Small delay ensures the renderer scripts have finished initializing.
        setTimeout(() => {
          this.window?.webContents.send("load-hue", this.hue);
          this.window?.webContents.send("load-rotation", this.rotation);
          this.window?.webContents.send("load-opacity", this.opacity);
        }, 50);
      });

      this.window.on("closed", () => {
        this.window = null;
      });
    }
  }

  /**
   * Calculates the pixel-perfect window bounds and applies them.
   *
   * For canvas crosshairs the window must be large enough to fit the drawn
   * geometry. The diameter is derived from the gap + length arms plus the
   * line thickness, plus a 40 px safety margin.
   *
   * A negative canvasGap is legal (lines overlap in the center), but
   * gap + length could become negative, which would produce an invalid window
   * size. Math.max(0, …) clamps the arm to zero in that edge case.
   */
  setBounds() {
    if (!this.window) return;

    const display = this.getTargetDisplay();
    const { x: dX, y: dY, width, height } = display.bounds;

    let w = this.size;
    let h = this.size;

    if (this.isCanvas) {
      // Arm length in each direction from the center.
      // Clamped to 0 so a very negative gap never produces a negative diameter.
      const arm = Math.max(0, this.canvasGap + this.canvasLength);
      const diameter = arm * 2 + this.canvasThickness + 40;

      // For styles like "Pixel Draw" that have no gap/length/thickness, the
      // diameter would be 40px. Use this.size as a lower bound so the Size
      // slider always drives the window size (and therefore the pixel scale).
      const effective = Math.max(diameter, this.size);

      // Never exceed the smaller screen dimension (no fullscreen overlays).
      const screenCap = Math.min(width, height);
      const capped = Math.min(effective, screenCap);
      w = capped;
      h = capped;
    }

    let x: number;
    let y: number;

    if (this.fixedPosition) {
      // Center the window on the user-specified absolute coordinates.
      x = Math.round(this.xPosition - w / 2);
      y = Math.round(this.yPosition - h / 2);
    } else {
      // Center the window on the target display.
      x = Math.round(dX + width / 2 - w / 2);
      y = Math.round(dY + height / 2 - h / 2);
    }

    this.window.setBounds({ x, y, width: w, height: h });
  }

  /** Sends the current hue offset to the renderer to update the crosshair color. */
  applyHue() {
    this.window?.webContents.send("load-hue", this.hue);
  }

  /** Sends the current rotation angle (degrees) to the renderer. */
  applyRotation() {
    this.window?.webContents.send("load-rotation", this.rotation);
  }

  /** Recalculates window bounds after a size change. */
  applySize() {
    if (this.window) this.setBounds();
  }

  /** Sends the current opacity value (0–1) to the renderer. */
  applyOpacity() {
    this.window?.webContents.send("load-opacity", this.opacity);
  }

  /** Returns the pixel coordinates of the center of the target display. */
  getCenterCoords(): { x: number; y: number } {
    const display = this.getTargetDisplay();
    const { x: dX, y: dY, width, height } = display.bounds;
    return {
      x: Math.round(dX + width / 2),
      y: Math.round(dY + height / 2),
    };
  }

  /**
   * Updates the active crosshair image or style and triggers a full re-render.
   * Also resizes the overlay window if switching between canvas and image modes.
   */
  setImage(imagePath: string) {
    this.imagePath = imagePath;
    this.isCanvas = imagePath.startsWith("canvas:");
    if (!this.window) return;
    this.window.webContents.send("load-crosshair", imagePath);
    this.setBounds();
    setTimeout(() => {
      this.window?.webContents.send("load-hue", this.hue);
      this.window?.webContents.send("load-rotation", this.rotation);
      this.window?.webContents.send("load-opacity", this.opacity);
    }, 50);
  }

  /** Destroys the overlay window entirely. */
  close() {
    if (this.window) this.window.destroy();
  }

  /** Makes the overlay visible. */
  show() {
    if (this.window) {
      console.log("CrosshairOverlay show called");
      this.window.show();
    }
  }

  /** Hides the overlay without destroying it. */
  hide() {
    if (this.window) {
      console.log("CrosshairOverlay hide called");
      this.window.hide();
    }
  }
}

export = CrosshairOverlay;
