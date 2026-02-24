/**
 * pixel-draw.js
 * Pixel-grid editor modal for the "Pixel Draw" canvas crosshair style.
 * Opens a 16×16 interactive grid inside a Modal where the user can
 * paint pixels on/off, then returns the result as a flat array.
 */

/**
 * Opens the pixel-draw editor as a Modal.
 *
 * @param {number[]|null} existingData - Previous pixelData array to pre-fill; null for blank.
 * @param {Function} onDone           - Called with the new pixelData array when user clicks Done.
 */
function openPixelDrawModal(existingData, onDone) {
    const GRID = 16;
    const TOTAL = GRID * GRID;

    // Internal state: 1 = painted, 0 = empty.
    const cells = new Array(TOTAL).fill(0);
    if (Array.isArray(existingData) && existingData.length === TOTAL) {
        existingData.forEach((v, i) => { cells[i] = v ? 1 : 0; });
    }

    // ── Build DOM ────────────────────────────────────────────────────────────────

    const wrapper = document.createElement("div");
    wrapper.classList.add("pixel-draw-wrapper");

    // Title
    const title = document.createElement("div");
    title.classList.add("pixel-draw-title");
    title.textContent = "Draw Your Crosshair";
    wrapper.appendChild(title);

    // Grid container
    const grid = document.createElement("div");
    grid.classList.add("pixel-grid");
    grid.style.setProperty("--pixel-grid-size", GRID);
    wrapper.appendChild(grid);

    // Cell elements
    const cellEls = [];
    for (let i = 0; i < TOTAL; i++) {
        const cell = document.createElement("div");
        cell.classList.add("pixel-cell");
        if (cells[i]) cell.classList.add("on");
        grid.appendChild(cell);
        cellEls.push(cell);
    }

    // Buttons row
    const btnRow = document.createElement("div");
    btnRow.classList.add("pixel-draw-buttons");

    const clearBtn = document.createElement("button");
    clearBtn.classList.add("settings-btn", "settings-btn-danger");
    clearBtn.textContent = "Clear";

    const doneBtn = document.createElement("button");
    doneBtn.classList.add("settings-btn");
    doneBtn.textContent = "Done";

    btnRow.appendChild(clearBtn);
    btnRow.appendChild(doneBtn);
    wrapper.appendChild(btnRow);

    // ── Open in Modal ────────────────────────────────────────────────────────────

    const modal = new Modal([
        {
            element: "div",
            extraClass: "pixel-draw-modal-inner",
        },
    ]);

    // Replace the inner div the Modal built with our custom wrapper.
    const inner = modal.element.querySelector(".pixel-draw-modal-inner");
    inner.replaceWith(wrapper);

    // ── Paint interactions ───────────────────────────────────────────────────────

    let painting = false;
    let paintValue = 1; // 1 = turn on, 0 = turn off (set on mousedown)

    function toggleCell(index) {
        cells[index] = paintValue;
        cellEls[index].classList.toggle("on", !!paintValue);
    }

    grid.addEventListener("mousedown", (e) => {
        const cell = e.target.closest(".pixel-cell");
        if (!cell) return;
        e.preventDefault();
        const index = cellEls.indexOf(cell);
        if (index === -1) return;
        // Toggle mode: if the clicked cell is ON, paint mode turns cells OFF.
        paintValue = cells[index] ? 0 : 1;
        painting = true;
        toggleCell(index);
    });

    grid.addEventListener("mouseover", (e) => {
        if (!painting) return;
        const cell = e.target.closest(".pixel-cell");
        if (!cell) return;
        const index = cellEls.indexOf(cell);
        if (index !== -1) toggleCell(index);
    });

    // Stop painting when the mouse is released anywhere on the document.
    document.addEventListener("mouseup", () => { painting = false; }, { once: false });
    // Also handle the case where the cursor leaves the modal while painting.
    grid.addEventListener("mouseleave", () => { painting = false; });

    // ── Button handlers ──────────────────────────────────────────────────────────

    clearBtn.addEventListener("click", () => {
        cells.fill(0);
        cellEls.forEach((el) => el.classList.remove("on"));
    });

    doneBtn.addEventListener("click", () => {
        modal.remove();
        onDone([...cells]);
    });
}
