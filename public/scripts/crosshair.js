/**
 * crosshair.js — Renderer do overlay de mira.
 * Usa canvas-crosshair.js para renderização programática.
 * Suporta estilos canvas nativos e fallback para PNG/SVG externos.
 */

const canvas = document.getElementById('crosshair-canvas');

// Lê o tamanho da janela para dimensionar o canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', () => {
    resizeCanvas();
    redraw();
});

// ─── Estado ──────────────────────────────────────────────────────────────────

let currentParams = {
    style: 'Classic',
    imagePath: null,
    color: '#00ff00',
    thickness: 2,
    gap: 4,
    length: 8,
    dot: false,
    outline: false,
    outlineThickness: 1,
    opacity: 1,
    rotation: 0,
};

// Carrega config salva do localStorage para aplicar na inicialização
try {
    const saved = JSON.parse(localStorage.getItem('canvas-config'));
    if (saved) currentParams = { ...currentParams, ...saved };
} catch (e) {
    console.warn('[crosshair] Erro ao ler canvas-config:', e);
}

function redraw() {
    if (typeof CanvasCrosshair !== 'undefined') {
        CanvasCrosshair.draw(canvas, currentParams);
    }
}

// Redesenha quando imagem externa termina de carregar
document.addEventListener('canvas-image-ready', (e) => {
    if (e.detail === currentParams.imagePath) redraw();
});

// ─── IPC Handlers ────────────────────────────────────────────────────────────

// Solicita o crosshair atual ao processo principal
ipcRenderer.send('load-crosshair');

ipcRenderer.on('crosshair-loaded', (event, rawPath) => {
    if (!rawPath) return;

    if (rawPath.startsWith('canvas:')) {
        // Estilo canvas nativo: "canvas:Classic", "canvas:Dot", etc.
        currentParams.imagePath = null;
        currentParams.style = rawPath.replace('canvas:', '');
    } else {
        // Imagem externa (PNG ou SVG)
        let srcUrl = rawPath;

        if (rawPath.includes('public/crosshairs') || rawPath.includes('public\\crosshairs')) {
            const filename = rawPath.replace(/\\/g, '/').split('/').pop();
            srcUrl = `./crosshairs/${filename}`;
        } else if (!rawPath.startsWith('http') && !rawPath.startsWith('file://')) {
            srcUrl = `file://${rawPath}`;
        }

        currentParams.imagePath = srcUrl;
        currentParams.style = null;
    }

    redraw();
});

// Cor direta (modo canvas)
ipcRenderer.on('load-color', (event, color) => {
    currentParams.color = color;
    redraw();
});

// Hue-rotate legado — converte para cor aproximada no canvas
// Para PNG/SVG não há canvas, mas mantemos para animação de parâmetros legados
ipcRenderer.on('load-hue', (event, hue) => {
    // Se estiver em modo canvas, hue-rotate não é a abordagem ideal,
    // mas convertemos para manter compatibilidade com código existente.
    // A cor fica verde (padrão) rotacionada no espaço HSL.
    if (!currentParams.imagePath) {
        // Apenas atualiza quando color picker não foi definido explicitamente
        currentParams._hue = hue;
        // Converte: verde puro (#00ff00) = hue 120. Rotação soma ao hue.
        const h = (120 + Number(hue)) % 360;
        currentParams.color = `hsl(${h}, 100%, 50%)`;
        redraw();
    }
});

ipcRenderer.on('load-rotation', (event, rotation) => {
    currentParams.rotation = Number(rotation);
    redraw();
});

ipcRenderer.on('load-opacity', (event, opacity) => {
    currentParams.opacity = Number(opacity);
    redraw();
});

// Parâmetros canvas avançados
ipcRenderer.on('load-canvas-params', (event, params) => {
    currentParams = { ...currentParams, ...params };
    redraw();
});

// Redraw inicial após carregamento
document.addEventListener('DOMContentLoaded', () => redraw());