/**
 * crosshair.js — Crosshair overlay renderer.
 * Uses canvas-crosshair.js for programmatic native-canvas rendering.
 * Also supports external PNG/SVG images as a fallback.
 */

const canvas = document.getElementById("crosshair-canvas");

// ─── HiDPI-aware canvas sizing ────────────────────────────────────────────────

/**
 * Sizes the canvas to fill the window at the device's native resolution.
 *
 * On HiDPI (Retina) screens, devicePixelRatio > 1, meaning one CSS pixel maps
 * to multiple physical pixels. Without this scaling the canvas buffer would be
 * created at CSS-pixel resolution and then stretched, producing a blurry result.
 *
 * Strategy:
 *  1. Set canvas.width/height to physical pixels (CSS size × DPR).
 *  2. Keep canvas.style.width/height at CSS pixels so layout is unchanged.
 *  3. Apply setTransform(dpr, …) so that all drawing coordinates remain in
 *     CSS pixels — no changes needed in the drawing functions themselves.
 *     setTransform() is used instead of scale() to avoid accumulating the
 *     multiplier on successive resize calls.
 */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Internal buffer at native (physical) resolution.
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  // CSS size stays at logical pixels so the element position is unaffected.
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";

  // Scale the drawing context to match the DPR without stacking transforms.
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  redraw();
});

// ─── Crosshair state ──────────────────────────────────────────────────────────

/** Current drawing parameters. Merged from defaults and persisted config. */
let currentParams = {
  style: "Classic",
  imagePath: null,
  color: "#00ff00",
  thickness: 2,
  gap: 4,
  length: 8,
  dot: false,
  outline: false,
  outlineThickness: 1,
  outlineColor: "#000000",
  outlineOpacity: 1,
  opacity: 1,
  rotation: 0,
  pixelData: null,
};

// Restore the previously saved canvas configuration from localStorage on startup.
try {
  const saved = JSON.parse(localStorage.getItem("canvas-config"));
  if (saved) currentParams = { ...currentParams, ...saved };
} catch (e) {
  console.warn("[crosshair] Failed to read canvas-config:", e);
}

/** Triggers a full redraw using the current parameter state. */
function redraw() {
  if (typeof CanvasCrosshair !== "undefined") {
    CanvasCrosshair.draw(canvas, currentParams);
  }
}

// Redraw once an external image finishes loading (fired by canvas-crosshair.js).
document.addEventListener("canvas-image-ready", (e) => {
  if (e.detail === currentParams.imagePath) redraw();
});

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

// Ask the main process to send back the currently active crosshair path.
ipcRenderer.send("load-crosshair");

/**
 * Handles the active crosshair path sent by the main process.
 * Paths prefixed with "canvas:" select a native canvas style.
 * All other paths are treated as external image files.
 */
ipcRenderer.on("crosshair-loaded", (event, rawPath) => {
  if (!rawPath) return;

  if (rawPath.startsWith("canvas:")) {
    // Native canvas style — e.g. "canvas:Classic", "canvas:Dot".
    currentParams.imagePath = null;
    currentParams.style = rawPath.replace("canvas:", "");
  } else {
    // External image (PNG or SVG).
    let srcUrl = rawPath;

    // Bundled crosshairs are served from the public/crosshairs directory.
    if (
      rawPath.includes("public/crosshairs") ||
      rawPath.includes("public\\crosshairs")
    ) {
      const filename = rawPath.replace(/\\/g, "/").split("/").pop();
      srcUrl = `./crosshairs/${filename}`;
    } else if (!rawPath.startsWith("http") && !rawPath.startsWith("file://")) {
      // Absolute filesystem path — wrap in a file:// URI.
      srcUrl = `file://${rawPath}`;
    }

    currentParams.imagePath = srcUrl;
    currentParams.style = null;
  }

  redraw();
});

/** Applies a new direct color value to the canvas crosshair. */
ipcRenderer.on("load-color", (event, color) => {
  currentParams.color = color;
  redraw();
});

/**
 * Legacy hue-rotate handler for compatibility with the classic hue slider.
 * Converts a hue-rotation offset (0–180) into an HSL color derived from
 * the default green (#00ff00, hue 120°) and applies it to the canvas crosshair.
 * No-op when an external image is active (images use CSS filter instead).
 */
ipcRenderer.on("load-hue", (event, hue) => {
  if (!currentParams.imagePath) {
    currentParams._hue = hue;
    // Pure green is hue 120°; add the slider offset and wrap around 360°.
    const h = (120 + Number(hue)) % 360;
    currentParams.color = `hsl(${h}, 100%, 50%)`;
    redraw();
  }
});

/** Applies a new rotation angle (degrees) to the crosshair. */
ipcRenderer.on("load-rotation", (event, rotation) => {
  currentParams.rotation = Number(rotation);
  redraw();
});

/** Applies a new global opacity (0–1) to the crosshair. */
ipcRenderer.on("load-opacity", (event, opacity) => {
  currentParams.opacity = Number(opacity);
  redraw();
});

/** Applies a full set of advanced canvas parameters (gap, length, thickness, etc.). */
ipcRenderer.on("load-canvas-params", (event, params) => {
  currentParams = { ...currentParams, ...params };
  redraw();
});

/** Updates the pixel-draw data and redraws the crosshair. */
ipcRenderer.on("load-pixel-data", (event, pixelData) => {
  currentParams.pixelData = pixelData;
  redraw();
});

// Perform an initial render once the DOM is fully ready.
document.addEventListener("DOMContentLoaded", () => redraw());
