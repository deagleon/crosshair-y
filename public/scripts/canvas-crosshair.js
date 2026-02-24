/**
 * canvas-crosshair.js
 * HTML5 Canvas-based crosshair rendering engine.
 * Supports native programmatic styles and external PNG/SVG fallback.
 */

const CANVAS_STYLES = {
  // ── Classic shapes ──────────────────────────────────────────────────────────
  Classic: drawClassic,
  "Cross+Dot": drawCrossWithDot,
  "T-Shape": drawTShape,
  "Two Lines": drawTwoLines,
  "Three Angled Lines": drawThreeAngledLines,

  // ── Dots and solid shapes ───────────────────────────────────────────────────
  Dot: drawDot,
  Square: drawSquare,
  Triangle: drawTriangle,

  // ── Circular ────────────────────────────────────────────────────────────────
  Circle: drawCircle,
  "Semi-circle": drawSemiCircle,
  "Two Curves": drawTwoCurves,
  "Four Curves": drawFourCurves,

  // ── Directional ─────────────────────────────────────────────────────────────
  Arrow: drawArrow,
  "Dual Arrow": drawDualArrow,
  Chevron: drawChevron,
  "Angled Brackets": drawAngledBrackets,
};

/**
 * Main entry point — draws the crosshair onto the given canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object}  params
 * @param {string}  params.style              - Name of the native canvas style.
 * @param {string}  [params.imagePath]        - Path to an external PNG/SVG image.
 * @param {string}  [params.color]            - Crosshair color (default: '#00ff00').
 * @param {number}  [params.thickness]        - Line thickness in px (default: 2).
 * @param {number}  [params.gap]              - Center gap in px; negative values overlap lines (default: 4).
 * @param {number}  [params.length]           - Arm length in px (default: 8).
 * @param {boolean} [params.dot]              - Show a center dot (default: false).
 * @param {boolean} [params.outline]          - Enable outline stroke (default: false).
 * @param {number}  [params.outlineThickness] - Outline thickness in px (default: 1).
 * @param {string}  [params.outlineColor]     - Outline color (default: '#000000').
 * @param {number}  [params.outlineOpacity]   - Outline opacity 0–1 (default: 1).
 * @param {number}  [params.opacity]          - Global crosshair opacity 0–1 (default: 1).
 * @param {number}  [params.rotation]         - Rotation in degrees (default: 0).
 */
function drawCrosshair(canvas, params = {}) {
  const ctx = canvas.getContext("2d");

  // Use CSS (logical) pixel dimensions so that the coordinate system matches
  // the post-DPR transform set by resizeCanvas() via setTransform().
  // canvas.width/height already include the DPR factor and must not be used
  // directly as drawing coordinates.
  const w = parseFloat(canvas.style.width) || canvas.width;
  const h = parseFloat(canvas.style.height) || canvas.height;

  ctx.clearRect(0, 0, w, h);

  const opacity = params.opacity ?? 1;
  const rotation = params.rotation ?? 0;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Translate origin to canvas center and apply rotation.
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);

  if (params.imagePath) {
    // External image mode (PNG / SVG).
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    _drawExternalImage(ctx, params.imagePath, w, h);
  } else {
    // Native canvas style mode.
    const drawFn = CANVAS_STYLES[params.style] || drawClassic;
    drawFn(ctx, params);
  }

  ctx.restore();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Merges user-supplied params with sensible defaults.
 * @param {Object} params - Raw parameter object from the renderer.
 * @returns {Object} Resolved parameters with all fields guaranteed.
 */
function _resolveParams(params) {
  return {
    color: params.color ?? "#00ff00",
    thickness: params.thickness ?? 2,
    gap: params.gap ?? 4,
    length: params.length ?? 8,
    dot: params.dot ?? false,
    outline: params.outline ?? false,
    outlineThickness: params.outlineThickness ?? 1,
    outlineColor: params.outlineColor ?? "#000000",
    outlineOpacity: params.outlineOpacity ?? 1,
  };
}

/** Thin wrapper around ctx.fillRect for consistent call sites. */
function _fillRect(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, h);
}

/**
 * Draws an expanded (outlined) version of a rectangle behind the main shape.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x, y, w, h      - Inner rectangle coordinates and dimensions.
 * @param {number} outlineThickness - How many px to expand on each side.
 * @param {string} outlineColor
 * @param {number} outlineOpacity
 */
function _drawOutlinedRect(ctx, x, y, w, h, outlineThickness, outlineColor, outlineOpacity) {
  const ot = outlineThickness;
  ctx.save();
  ctx.globalAlpha = outlineOpacity;
  ctx.fillStyle = outlineColor;
  ctx.fillRect(x - ot, y - ot, w + ot * 2, h + ot * 2);
  ctx.restore();
}

/**
 * Draws a list of rectangles, optionally prefixed with an outline layer.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x,y,w,h}>} rects - Array of rectangle descriptors.
 */
function _drawRects(ctx, rects, color, outline, outlineThickness, outlineColor, outlineOpacity) {
  // Draw the outline layer first (behind the main color).
  if (outline) {
    rects.forEach((r) =>
      _drawOutlinedRect(ctx, r.x, r.y, r.w, r.h, outlineThickness, outlineColor, outlineOpacity),
    );
  }
  ctx.fillStyle = color;
  rects.forEach((r) => _fillRect(ctx, r.x, r.y, r.w, r.h));
}

/**
 * Strokes a path with an optional outline drawn behind the main stroke.
 * The caller must NOT open a path before calling this; `buildPath` is
 * responsible for calling beginPath() and the desired path commands.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {function(CanvasRenderingContext2D): void} buildPath - Builds the canvas path.
 * @param {number} thickness      - Stroke width of the main line.
 * @param {string} color          - Main stroke color.
 * @param {boolean} outline       - Whether to draw an outline stroke behind the main one.
 * @param {number} outlineThickness
 * @param {string} outlineColor
 * @param {number} outlineOpacity
 */
function _strokeWithOutline(ctx, buildPath, thickness, color, outline, outlineThickness, outlineColor, outlineOpacity) {
  // Draw the wider outline stroke first so it sits behind the main color.
  if (outline) {
    ctx.save();
    ctx.globalAlpha = outlineOpacity;
    ctx.lineWidth = thickness + outlineThickness * 2;
    ctx.strokeStyle = outlineColor;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    buildPath(ctx);
    ctx.stroke();
    ctx.restore();
  }

  // Draw the main colored stroke on top.
  ctx.lineWidth = thickness;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  buildPath(ctx);
  ctx.stroke();
}

// ─── Native crosshair styles ──────────────────────────────────────────────────

/** Classic crosshair: 4 arms extending from a center gap. */
function drawClassic(ctx, params) {
  const { color, thickness, gap, length, dot, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const t = thickness;
  const th = t / 2; // Half-thickness used to center rectangles vertically/horizontally.

  // Right, left, bottom, top arms.
  const rects = [
    { x: gap, y: -th, w: length, h: t }, // right
    { x: -(gap + length), y: -th, w: length, h: t }, // left
    { x: -th, y: gap, w: t, h: length }, // bottom
    { x: -th, y: -(gap + length), w: t, h: length }, // top
  ];

  _drawRects(ctx, rects, color, outline, outlineThickness, outlineColor, outlineOpacity);

  if (dot) {
    const ds = t * 1.5;
    _drawRects(ctx, [{ x: -ds / 2, y: -ds / 2, w: ds, h: ds }], color, outline, outlineThickness, outlineColor, outlineOpacity);
  }
}

/** Classic crosshair with center dot always enabled. */
function drawCrossWithDot(ctx, params) {
  drawClassic(ctx, { ...params, dot: true });
}

/** T-Shape: left, right, and bottom arms only (no top arm). */
function drawTShape(ctx, params) {
  const { color, thickness, gap, length, dot, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const t = thickness;
  const th = t / 2;

  const rects = [
    { x: gap, y: -th, w: length, h: t }, // right
    { x: -(gap + length), y: -th, w: length, h: t }, // left
    { x: -th, y: gap, w: t, h: length }, // bottom
  ];

  _drawRects(ctx, rects, color, outline, outlineThickness, outlineColor, outlineOpacity);

  if (dot) {
    const ds = t * 1.5;
    _drawRects(ctx, [{ x: -ds / 2, y: -ds / 2, w: ds, h: ds }], color, outline, outlineThickness, outlineColor, outlineOpacity);
  }
}

/** Two Lines: only horizontal arms (left and right), no vertical. */
function drawTwoLines(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const t = thickness;
  const th = t / 2;

  const rects = [
    { x: gap, y: -th, w: length, h: t }, // right
    { x: -(gap + length), y: -th, w: length, h: t }, // left
  ];

  _drawRects(ctx, rects, color, outline, outlineThickness, outlineColor, outlineOpacity);
}

/** Three Angled Lines: precision / military-style crosshair with three diagonal arms. */
function drawThreeAngledLines(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const arm = gap + length;

  // Lines: bottom-left, bottom-right, top.
  const lines = [
    { x1: 0, y1: gap, x2: -arm * 0.7, y2: arm * 0.7 },  // bottom-left
    { x1: 0, y1: gap, x2: arm * 0.7, y2: arm * 0.7 },  // bottom-right
    { x1: 0, y1: -gap, x2: 0, y2: -arm }, // top
  ];

  lines.forEach(({ x1, y1, x2, y2 }) => {
    _strokeWithOutline(
      ctx,
      (c) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); },
      thickness, color, outline, outlineThickness, outlineColor, outlineOpacity,
    );
  });
}

/** Dot: a simple square dot at the center. */
function drawDot(ctx, params) {
  const { color, thickness, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const size = thickness * 3;
  _drawRects(ctx, [{ x: -size / 2, y: -size / 2, w: size, h: size }], color, outline, outlineThickness, outlineColor, outlineOpacity);
}

/** Square: a hollow square (stroked rectangle) centered on origin. */
function drawSquare(ctx, params) {
  const { color, thickness, gap, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const halfSide = gap + thickness;

  const buildPath = (c) => {
    c.beginPath();
    c.rect(-halfSide, -halfSide, halfSide * 2, halfSide * 2);
  };

  _strokeWithOutline(ctx, buildPath, thickness, color, outline, outlineThickness, outlineColor, outlineOpacity);
}

/** Triangle: an upward-pointing triangle crosshair. */
function drawTriangle(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const arm = gap + length;

  const buildPath = (c) => {
    c.beginPath();
    c.moveTo(0, -(arm));        // tip (top)
    c.lineTo(arm * 0.8, arm * 0.6);  // bottom-right
    c.lineTo(-arm * 0.8, arm * 0.6); // bottom-left
    c.closePath();
  };

  _strokeWithOutline(ctx, buildPath, thickness, color, outline, outlineThickness, outlineColor, outlineOpacity);
}

/** Circle: a full circular ring centered on the crosshair. */
function drawCircle(ctx, params) {
  const { color, thickness, gap: radius, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const r = radius + thickness * 2;

  // Draw the outline ring slightly larger behind the main ring.
  if (outline) {
    ctx.save();
    ctx.globalAlpha = outlineOpacity;
    ctx.beginPath();
    ctx.arc(0, 0, r + outlineThickness, 0, Math.PI * 2);
    ctx.lineWidth = thickness + outlineThickness * 2;
    ctx.strokeStyle = outlineColor;
    ctx.stroke();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.lineWidth = thickness;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Semi-circle: a lower arc (sniper-style curved crosshair). */
function drawSemiCircle(ctx, params) {
  const { color, thickness, gap: radius, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const r = radius + thickness * 2;

  // Arc from 0 to PI draws the bottom half (left → right through the bottom).
  const buildPath = (c) => {
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI);
  };

  _strokeWithOutline(ctx, buildPath, thickness, color, outline, outlineThickness, outlineColor, outlineOpacity);
}

/** Two Curves: left and right curved arcs (parenthesis-style brackets). */
function drawTwoCurves(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const r = (gap + length) * 0.75;
  const spread = gap + thickness;

  // Left arc opens ~135°–225°; right arc opens ~315°–45°.
  const arcs = [
    { x: -spread, startAngle: Math.PI * 0.6, endAngle: Math.PI * 1.4 }, // left
    { x: spread, startAngle: -Math.PI * 0.4, endAngle: Math.PI * 0.4 }, // right
  ];

  arcs.forEach(({ x, startAngle, endAngle }) => {
    _strokeWithOutline(
      ctx,
      (c) => { c.beginPath(); c.arc(x, 0, r, startAngle, endAngle); },
      thickness, color, outline, outlineThickness, outlineColor, outlineOpacity,
    );
  });
}

/** Four Curves: four arcs at the four diagonal corners, like a cross of parentheses. */
function drawFourCurves(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const r = (gap + length) * 0.6;
  const d = gap + thickness;

  const arcs = [
    // Top arc
    { cx: 0, cy: -d, startAngle: Math.PI + Math.PI * 0.25, endAngle: Math.PI * 2 - Math.PI * 0.25 },
    // Bottom arc
    { cx: 0, cy: d, startAngle: Math.PI * 0.25, endAngle: Math.PI - Math.PI * 0.25 },
    // Left arc
    { cx: -d, cy: 0, startAngle: -Math.PI * 0.25, endAngle: Math.PI * 0.25, ccw: true },
    // Right arc
    { cx: d, cy: 0, startAngle: Math.PI - Math.PI * 0.25, endAngle: Math.PI + Math.PI * 0.25, ccw: true },
  ];

  arcs.forEach(({ cx, cy, startAngle, endAngle, ccw }) => {
    _strokeWithOutline(
      ctx,
      (c) => { c.beginPath(); c.arc(cx, cy, r, startAngle, endAngle, ccw); },
      thickness, color, outline, outlineThickness, outlineColor, outlineOpacity,
    );
  });
}

/** Arrow: an upward-pointing filled arrow head. */
function drawArrow(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const tip = -(gap + length); // Y-coordinate of the arrow tip (top).
  const base = gap;             // Y-coordinate of the arrow base.
  const wing = length * 0.5;   // Half-width of the arrow base.

  const buildPath = (c) => {
    c.beginPath();
    c.moveTo(0, tip);
    c.lineTo(-wing, base);
    c.lineTo(0, base - wing * 0.4); // Inner notch.
    c.lineTo(wing, base);
    c.closePath();
  };

  // Draw outline fill behind the main fill.
  if (outline) {
    ctx.save();
    ctx.globalAlpha = outlineOpacity;
    ctx.fillStyle = outlineColor;
    buildPath(ctx);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = color;
  buildPath(ctx);
  ctx.fill();
}

/** Dual Arrow: two filled arrow heads pointing up and down. */
function drawDualArrow(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const tip = gap + length;    // Distance from center to arrow tip.
  const base = gap;             // Distance from center to arrow base.
  const wing = length * 0.45;  // Half-width of each arrow.

  const buildPath = (c) => {
    // Top arrow (pointing up).
    c.beginPath();
    c.moveTo(0, -tip);
    c.lineTo(-wing, -base);
    c.lineTo(0, -(base - wing * 0.4));
    c.lineTo(wing, -base);
    c.closePath();
    // Bottom arrow (pointing down).
    c.moveTo(0, tip);
    c.lineTo(-wing, base);
    c.lineTo(0, base - wing * 0.4);
    c.lineTo(wing, base);
    c.closePath();
  };

  if (outline) {
    ctx.save();
    ctx.globalAlpha = outlineOpacity;
    ctx.fillStyle = outlineColor;
    buildPath(ctx);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = color;
  buildPath(ctx);
  ctx.fill();
}

/** Chevron: a downward-opening V shape. */
function drawChevron(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const arm = length + gap;

  const buildPath = (c) => {
    c.beginPath();
    c.moveTo(-arm, -gap);            // Top-left point.
    c.lineTo(0, gap + length / 2);    // Bottom-center apex.
    c.lineTo(arm, -gap);             // Top-right point.
  };

  _strokeWithOutline(ctx, buildPath, thickness, color, outline, outlineThickness, outlineColor, outlineOpacity);
}

/** Angled Brackets (shotgun-style): a left and right angled bracket on either side. */
function drawAngledBrackets(ctx, params) {
  const { color, thickness, gap, length, outline, outlineThickness, outlineColor, outlineOpacity } = _resolveParams(params);
  const armLen = length * 0.6;
  const x = gap + thickness;
  const y = length * 0.5;

  // Two sets of three points forming ‹ and › brackets.
  const sides = [
    // Left bracket  ›
    [[-x - armLen, -y], [-x, 0], [-x - armLen, y]],
    // Right bracket ‹
    [[x + armLen, -y], [x, 0], [x + armLen, y]],
  ];

  sides.forEach((pts) => {
    _strokeWithOutline(
      ctx,
      (c) => {
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        c.lineTo(pts[1][0], pts[1][1]);
        c.lineTo(pts[2][0], pts[2][1]);
      },
      thickness, color, outline, outlineThickness, outlineColor, outlineOpacity,
    );
  });
}

// ─── External image fallback ──────────────────────────────────────────────────

/** Cached Image elements keyed by image path to avoid repeated network requests. */
const _imageCache = new Map();

/**
 * Draws an external PNG or SVG image centered on the canvas origin.
 * If the image is not yet loaded, it starts loading and fires a
 * 'canvas-image-ready' custom event when complete so the caller can redraw.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} imagePath - URL or file:// path to the external image.
 * @param {number} canvasW   - Canvas logical width in CSS pixels.
 * @param {number} canvasH   - Canvas logical height in CSS pixels.
 */
function _drawExternalImage(ctx, imagePath, canvasW, canvasH) {
  const cached = _imageCache.get(imagePath);

  if (cached && cached.complete) {
    // Image is already cached and fully decoded — draw immediately.
    ctx.drawImage(cached, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
    return;
  }

  // Start loading the image; redraw will be triggered by the event below.
  const img = new Image();
  img.onload = () => {
    _imageCache.set(imagePath, img);
    // Notify the crosshair renderer that the image is ready to display.
    document.dispatchEvent(
      new CustomEvent("canvas-image-ready", { detail: imagePath }),
    );
  };
  img.onerror = () =>
    console.warn("[canvas-crosshair] Failed to load image:", imagePath);
  img.src = imagePath;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Default parameter presets for each built-in style.
 * Applied automatically when the user switches to a new style so that
 * the controls start at sensible values instead of retaining previous ones.
 */
const STYLE_PRESETS = {
  // Classic shapes
  "Classic": { thickness: 2, gap: 4, length: 8, dot: false },
  "Cross+Dot": { thickness: 2, gap: 4, length: 8, dot: true },
  "T-Shape": { thickness: 2, gap: 4, length: 8, dot: false },
  "Two Lines": { thickness: 2, gap: 6, length: 10, dot: false },
  "Three Angled Lines": { thickness: 2, gap: 4, length: 14, dot: false },

  // Dots and solid shapes
  "Dot": { thickness: 5, gap: 0, length: 0 },
  "Square": { thickness: 2, gap: 10, length: 0 },
  "Triangle": { thickness: 2, gap: 4, length: 12 },

  // Circular
  "Circle": { thickness: 2, gap: 10, length: 0 },
  "Semi-circle": { thickness: 2, gap: 10, length: 0 },
  "Two Curves": { thickness: 2, gap: 6, length: 12 },
  "Four Curves": { thickness: 2, gap: 6, length: 12 },

  // Directional
  "Arrow": { thickness: 2, gap: 4, length: 14 },
  "Dual Arrow": { thickness: 2, gap: 4, length: 12 },
  "Chevron": { thickness: 2, gap: 4, length: 10 },
  "Angled Brackets": { thickness: 2, gap: 8, length: 14 },
};

/**
 * Global CanvasCrosshair API exposed to other renderer scripts.
 * - draw(canvas, params)  → renders the crosshair.
 * - styles                → array of available style names.
 * - presets               → map of style name → default params.
 */
window.CanvasCrosshair = {
  draw: drawCrosshair,
  styles: Object.keys(CANVAS_STYLES),
  presets: STYLE_PRESETS,
};
