# GEMINI.md - Crosshair Y Context

## Project Overview
**Crosshair Y** is a free and open-source customizable crosshair overlay application built with **Electron**. It allows users to overlay a crosshair on their screen for gaming, with features like adjustable size, hue, rotation, opacity, and position. It supports both built-in crosshairs and custom image/SVG crosshairs.

### Key Technologies
- **Framework:** [Electron](https://www.electronjs.org/) (v37.2.5+)
- **Language:** TypeScript (Main process) and JavaScript (Renderer process)
- **Styling:** CSS / SCSS
- **Networking:** Axios (for updates)
- **Packaging:** Electron Packager
- **Package Manager:** `pnpm` (based on `pnpm-lock.yaml`)

## Architecture & Structure
The project follows a standard Electron structure, separating the **Main Process** (system-level) and the **Renderer Process** (UI).

- **`src/`**: Main process TypeScript source code.
    - `index.ts`: Application entry point, window management, and IPC handling.
    - `crosshair.ts`: Logic for the crosshair overlay window.
    - `editor.ts`: Logic for the built-in SVG editor window.
    - `preload.ts`: Bridge between Main and Renderer processes using `contextBridge`.
- **`public/`**: Frontend assets and logic.
    - `index.html`: Main settings/dashboard UI.
    - `crosshair.html`: The actual overlay window.
    - `editor.html`: SVG Editor interface.
    - `scripts/`: Client-side JavaScript logic (e.g., `main.js`, `editor.js`, `crosshair.js`).
    - `style/`: CSS/SCSS files and themes.
    - `crosshairs/`: Built-in PNG crosshair assets.
- **`dist/`**: Target directory for compiled TypeScript files.

## Building and Running

### Development Commands
- **Install Dependencies:** `pnpm install`
- **Compile TypeScript:** `npx tsc` (watches not explicitly configured in scripts, but typically used during dev).
- **Start Application:** `npm start` (Runs `electron .`)

### Packaging for Distribution
- **Windows (x64):** `npm run build:win32`
- **Windows (ia32):** `npm run build:win32-32bit`
- **Linux (x64):** `npm run build:linux`

*Note: Built applications are output to the `build/` directory.*

## Development Conventions

### IPC Communication
Communication between the main process and renderer is handled via Electron's `ipcMain` and `ipcRenderer`.
- Preload script (`src/preload.ts`) exposes a safe `ipcRenderer` wrapper to the renderer process.
- Common IPC channels include: `config`, `show-crosshair`, `hide-crosshair`, `change-hue`, `change-size`, etc.

### Configuration & State
- User configuration is persisted in the renderer process using `localStorage`.
- Settings are synchronized to the main process via IPC calls whenever they change.
- Presets are stored as JSON strings in `localStorage` and can be exported/imported.

### Style & UI
- The UI is styled using CSS with theme support (found in `public/style/themes/`).
- Themes can be switched dynamically by injecting CSS link tags.
- The application supports "Reduced Motion" and "Light/Dark" modes.

### SVG Editor
- The app includes a custom SVG editor reachable via the `editor.html` and `src/editor.ts`.
- It allows real-time manipulation of SVG crosshairs.

## Guidelines for AI Interactions
- When modifying the UI, check `public/style/style.css` and existing themes.
- When adding system-level features, modify `src/index.ts` and ensure the `preload.ts` is updated if the renderer needs access.
- Always ensure TypeScript changes are compiled (`npx tsc`) before running the app.
- Adhere to the existing event-driven IPC pattern for main-renderer communication.
