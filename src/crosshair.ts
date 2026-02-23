import { app, BrowserWindow, screen, ipcMain, Display } from 'electron';
import path from 'path';

type DisplayTarget = 'primary' | 'cursor' | number; // number = índice do display

class CrosshairOverlay {
    public window: BrowserWindow | null = null;
    public size: number = 40;
    public hue: number = 0;
    public rotation: number = 0;
    public opacity: number = 1;
    public fixedPosition: boolean = false;
    public xPosition: number = 0;
    public yPosition: number = 0;

    /** Qual monitor usar para centralizar a mira.
     *  'primary' → monitor principal (padrão)
     *  'cursor'  → monitor onde o cursor está no momento do setBounds
     *  number    → índice do display na lista screen.getAllDisplays()
     */
    public displayTarget: DisplayTarget = 'primary';

    constructor() { }

    /** Retorna o Display correto baseado em displayTarget. */
    private getTargetDisplay(): Display {
        const all = screen.getAllDisplays();

        if (this.displayTarget === 'cursor') {
            const point = screen.getCursorScreenPoint();
            const found = screen.getDisplayNearestPoint(point);
            return found ?? screen.getPrimaryDisplay();
        }

        if (typeof this.displayTarget === 'number') {
            const byIndex = all[this.displayTarget];
            if (byIndex) return byIndex;
            console.warn(`[CrosshairOverlay] Display index ${this.displayTarget} não encontrado, usando primário.`);
        }

        return screen.getPrimaryDisplay();
    }

    async open(imagePath: string) {
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
                    preload: path.join(__dirname, 'preload.js')
                },
            });

            this.window.loadFile('./public/crosshair.html');

            this.setBounds();

            this.window.setIgnoreMouseEvents(true);

            this.window.once('ready-to-show', () => {
                console.log('CrosshairOverlay window is ready to show');
                this.window?.show();
                this.applyOpacity();
            });

            this.window.webContents.on('did-finish-load', () => {
                this.window?.webContents.send('load-crosshair', imagePath);

                setTimeout(() => {
                    this.window?.webContents.send('load-hue', this.hue);
                    this.window?.webContents.send('load-rotation', this.rotation);
                    this.window?.webContents.send('load-opacity', this.opacity);
                }, 50);
            });

            this.window.on('closed', () => {
                this.window = null;
            });

            ipcMain.on('load-crosshair', event => {
                event.reply('crosshair-loaded', imagePath);
            });

            ipcMain.on('change-fixed-position', (event, fixedPosition) => {
                this.fixedPosition = fixedPosition;
                this.setBounds();
            });
            ipcMain.on('recenter-crosshair', (event) => {
                if (!this.fixedPosition) {
                    this.setBounds();
                    const coords = this.getCenterCoords();
                    // Responde ao remetente (iframe de settings via preload)
                    event.reply('center-coords', coords);
                }
            });

            ipcMain.on('change-x-position', (event, xPosition) => {
                this.xPosition = xPosition;
                if (this.fixedPosition) {
                    this.setBounds();
                }
            });

            ipcMain.on('change-y-position', (event, yPosition) => {
                this.yPosition = yPosition;
                if (this.fixedPosition) {
                    this.setBounds();
                }
            });

            ipcMain.on('get-mouse-position', (event) => {
                const { x, y } = screen.getCursorScreenPoint();
                event.reply('mouse-position', { x, y });
            });
        }
    }

    setBounds() {
        if (!this.window) return;

        const display = this.getTargetDisplay();
        const { x: dX, y: dY, width, height } = display.bounds;

        let x: number;
        let y: number;

        if (this.fixedPosition) {
            // Posição fixa: coordenadas absolutas fornecidas pelo usuário
            x = Math.round(this.xPosition - (this.size / 2));
            y = Math.round(this.yPosition - (this.size / 2));
        } else {
            // Centro exato do monitor-alvo (usando bounds, não workArea, para ignorar taskbar)
            x = Math.round(dX + width / 2 - this.size / 2);
            y = Math.round(dY + height / 2 - this.size / 2);
        }

        this.window.setBounds({
            x,
            y,
            width: this.size,
            height: this.size,
        });
    }

    applyHue() {
        this.window?.webContents.send('load-hue', this.hue);
    }

    applyRotation() {
        this.window?.webContents.send('load-rotation', this.rotation);
    }

    applySize() {
        if (this.window) {
            this.setBounds();
        }
    }

    applyOpacity() {
        this.window?.webContents.send('load-opacity', this.opacity);
    }

    /** Retorna as coordenadas do centro do monitor-alvo (coordenadas absolutas do pixel central). */
    getCenterCoords(): { x: number; y: number } {
        const display = this.getTargetDisplay();
        const { x: dX, y: dY, width, height } = display.bounds;
        return {
            x: Math.round(dX + width / 2),
            y: Math.round(dY + height / 2),
        };
    }

    setImage(imagePath: string) {
        if (!this.window) return;
        this.window.webContents.send('load-crosshair', imagePath);

        setTimeout(() => {
            this.window?.webContents.send('load-hue', this.hue);
            this.window?.webContents.send('load-rotation', this.rotation);
            this.window?.webContents.send('load-opacity', this.opacity);
        }, 50);
    }

    close() {
        if (this.window) {
            this.window.destroy();
        }
    }

    show() {
        if (this.window) {
            console.log('CrosshairOverlay show called');
            this.window.show();
        }
    }

    hide() {
        if (this.window) {
            console.log('CrosshairOverlay hide called');
            this.window.hide();
        }
    }
}

export = CrosshairOverlay;
