/**
 * canvas-crosshair.js
 * Engine de renderização de miras via HTML5 Canvas.
 * Suporta estilos nativos programáticos e fallback para PNG/SVG externos.
 */

const CANVAS_STYLES = {
    Classic: drawClassic,
    Dot: drawDot,
    'T-Shape': drawTShape,
    Circle: drawCircle,
    'Cross+Dot': drawCrossWithDot,
    Chevron: drawChevron,
};

/**
 * Ponto de entrada principal.
 * @param {HTMLCanvasElement} canvas
 * @param {Object} params
 * @param {string}  params.style        - nome do estilo nativo (ex: 'Classic')
 * @param {string}  [params.imagePath]  - caminho para PNG/SVG externo (prioridade sobre style)
 * @param {string}  [params.color]      - cor da mira (default: '#00ff00')
 * @param {number}  [params.thickness]  - espessura das linhas em px (default: 2)
 * @param {number}  [params.gap]        - gap central em px (default: 4)
 * @param {number}  [params.length]     - comprimento das linhas em px (default: 8)
 * @param {boolean} [params.dot]        - ponto central (default: false)
 * @param {boolean} [params.outline]    - contorno preto (default: false)
 * @param {number}  [params.outlineThickness] - espessura do contorno (default: 1)
 * @param {number}  [params.opacity]    - opacidade global 0–1 (default: 1)
 * @param {number}  [params.rotation]   - rotação em graus (default: 0)
 */
function drawCrosshair(canvas, params = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const opacity = params.opacity ?? 1;
    const rotation = params.rotation ?? 0;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    if (params.imagePath) {
        _drawExternalImage(ctx, params.imagePath, w, h);
    } else {
        const drawFn = CANVAS_STYLES[params.style] || drawClassic;
        drawFn(ctx, params);
    }

    ctx.restore();
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function _resolveParams(params) {
    return {
        color: params.color ?? '#00ff00',
        thickness: params.thickness ?? 2,
        gap: params.gap ?? 4,
        length: params.length ?? 8,
        dot: params.dot ?? false,
        outline: params.outline ?? false,
        outlineThickness: params.outlineThickness ?? 1,
    };
}

function _fillRect(ctx, x, y, w, h) {
    ctx.fillRect(x, y, w, h);
}

function _drawOutlinedRect(ctx, x, y, w, h, outlineThickness, outlineColor = 'black') {
    const ot = outlineThickness;
    ctx.fillStyle = outlineColor;
    ctx.fillRect(x - ot, y - ot, w + ot * 2, h + ot * 2);
}

/**
 * Desenha um conjunto de retângulos com outline opcional e cor principal.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x,y,w,h}>} rects
 * @param {string} color
 * @param {boolean} outline
 * @param {number} outlineThickness
 */
function _drawRects(ctx, rects, color, outline, outlineThickness) {
    if (outline) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        rects.forEach(r => _drawOutlinedRect(ctx, r.x, r.y, r.w, r.h, outlineThickness));
    }
    ctx.fillStyle = color;
    rects.forEach(r => _fillRect(ctx, r.x, r.y, r.w, r.h));
}

// ─── Estilos nativos ─────────────────────────────────────────────────────────

/** Cruz clássica: 4 linhas com gap central. */
function drawClassic(ctx, params) {
    const { color, thickness, gap, length, dot, outline, outlineThickness } = _resolveParams(params);
    const t = thickness;
    const th = t / 2;

    const rects = [
        // direita
        { x: gap, y: -th, w: length, h: t },
        // esquerda
        { x: -(gap + length), y: -th, w: length, h: t },
        // baixo
        { x: -th, y: gap, w: t, h: length },
        // cima
        { x: -th, y: -(gap + length), w: t, h: length },
    ];

    _drawRects(ctx, rects, color, outline, outlineThickness);

    if (dot) {
        const ds = t * 1.5;
        _drawRects(ctx, [{ x: -ds / 2, y: -ds / 2, w: ds, h: ds }], color, outline, outlineThickness);
    }
}

/** Ponto central. */
function drawDot(ctx, params) {
    const { color, thickness, outline, outlineThickness } = _resolveParams(params);
    const size = thickness * 3;
    _drawRects(ctx, [{ x: -size / 2, y: -size / 2, w: size, h: size }], color, outline, outlineThickness);
}

/** T-Shape: cruz sem a linha de cima. */
function drawTShape(ctx, params) {
    const { color, thickness, gap, length, dot, outline, outlineThickness } = _resolveParams(params);
    const t = thickness;
    const th = t / 2;

    const rects = [
        { x: gap, y: -th, w: length, h: t },
        { x: -(gap + length), y: -th, w: length, h: t },
        { x: -th, y: gap, w: t, h: length },
    ];

    _drawRects(ctx, rects, color, outline, outlineThickness);

    if (dot) {
        const ds = t * 1.5;
        _drawRects(ctx, [{ x: -ds / 2, y: -ds / 2, w: ds, h: ds }], color, outline, outlineThickness);
    }
}

/** Círculo/anel. */
function drawCircle(ctx, params) {
    const { color, thickness, gap: radius, outline, outlineThickness } = _resolveParams(params);
    const r = radius + thickness * 2;

    if (outline) {
        ctx.beginPath();
        ctx.arc(0, 0, r + outlineThickness, 0, Math.PI * 2);
        ctx.lineWidth = thickness + outlineThickness * 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.stroke();
}

/** Cruz com ponto central. */
function drawCrossWithDot(ctx, params) {
    const merged = { ...params, dot: true };
    drawClassic(ctx, merged);
}

/** Chevron (seta para baixo). */
function drawChevron(ctx, params) {
    const { color, thickness, gap, length, outline, outlineThickness } = _resolveParams(params);

    const arm = length + gap;

    if (outline) {
        ctx.beginPath();
        ctx.moveTo(-arm, -gap);
        ctx.lineTo(0, gap + length / 2);
        ctx.lineTo(arm, -gap);
        ctx.lineWidth = thickness + outlineThickness * 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(-arm, -gap);
    ctx.lineTo(0, gap + length / 2);
    ctx.lineTo(arm, -gap);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
}

// ─── Fallback para imagens externas ──────────────────────────────────────────

const _imageCache = new Map();

function _drawExternalImage(ctx, imagePath, canvasW, canvasH) {
    const cached = _imageCache.get(imagePath);

    if (cached && cached.complete) {
        ctx.drawImage(cached, -canvasW / 2, -canvasH / 2, canvasW, canvasH);
        return;
    }

    const img = new Image();
    img.onload = () => {
        _imageCache.set(imagePath, img);
        // Redispacha evento para que crosshair.js redesenhe
        document.dispatchEvent(new CustomEvent('canvas-image-ready', { detail: imagePath }));
    };
    img.onerror = () => console.warn('[canvas-crosshair] Falha ao carregar imagem:', imagePath);
    img.src = imagePath;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

window.CanvasCrosshair = {
    draw: drawCrosshair,
    styles: Object.keys(CANVAS_STYLES),
};
