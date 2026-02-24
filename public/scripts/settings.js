const settings = document.querySelector(".settings");

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function applyReducedMotion(state) {
  const html = document.documentElement;
  html.classList.remove("reduced-motion");

  if (state === "on") {
    html.classList.add("reduced-motion");
  } else if (state === "system") {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      html.classList.add("reduced-motion");
    }
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "F3" || (e.ctrlKey && e.key === "f")) {
    e.preventDefault();
    const frame = document.querySelector(".full-frame");
    if (frame) {
      const frameDoc = frame.contentDocument || frame.contentWindow.document;
      const searchInput = frameDoc.querySelector("#search-input");
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }
});

settings.addEventListener("click", () => {
  const frame = document.createElement("iframe");
  frame.src = "./settings.html";
  frame.classList.add("full-frame", "full-animation");
  document.body.appendChild(frame);

  frame.addEventListener("load", () => {
    const frameDoc = frame.contentDocument || frame.contentWindow.document;
    const frameBody = frameDoc.body;
    const htmlElement = frameBody.parentElement;

    const navigationWrapper = frameBody.querySelector(".navigation-wrapper");
    const navigationTabs = frameBody.querySelector(".navigation-tabs");
    const navigationInput = frameBody.querySelector(".navigation-input");
    const searchInput = frameBody.querySelector("#search-input");
    const itemsFound = frameBody.querySelector(".items-found");
    const navButtons = frameBody.querySelector(".navigation-buttons");
    const crosshairGroupTitle = frameBody.querySelector(
      ".group-title#crosshair",
    );

    const resetButton = frameBody.querySelector(".reset");
    const closeButton = frameBody.querySelector(".close");
    const sizeRange = frameBody.querySelector("#size-range");
    const hueRange = frameBody.querySelector("#hue-range");
    const rotateRange = frameBody.querySelector("#rotate-range");
    const opacityRange = frameBody.querySelector("#opacity-range");
    const fixedPositionToggle = frameBody.querySelector(
      "#fixed-position-toggle",
    );
    const xPositionInput = frameBody.querySelector("#x-position-input");
    const yPositionInput = frameBody.querySelector("#y-position-input");
    const saveMousePositionButton = frameBody.querySelector(
      "#save-mouse-position",
    );
    const loadPresetSelect = frameBody.querySelector("#load-preset");
    const savePresetButton = frameBody.querySelector("#save-preset");
    const deletePresetBtn = frameBody.querySelector("#delete-preset");
    const deleteAllPresetsBtn = frameBody.querySelector("#delete-all-preset");
    const exportPresets = frameBody.querySelector("#export-presets");
    const importPresets = frameBody.querySelector("#import-presets");
    const setDirectory = frameBody.querySelector("#set-directory");
    const crosshairCodeInput = frameBody.querySelector("#crosshair-code-input");
    const saveCrosshairCodeBtn = frameBody.querySelector(
      "#save-crosshair-code",
    );
    const setDirectorySubText = setDirectory.querySelector(".sub-label");
    const removeDir = frameBody.querySelector("#remove-directory");

    const themeSelect = frameBody.querySelector("#theme-select");

    const reducedMotionSelect = frameBody.querySelector(
      "#reduced-motion-select",
    );
    const about = frameBody.querySelector("#about");
    const checkForUpdates = frameBody.querySelector("#check-for-updates");
    const autoUpdater = frameBody.querySelector("#auto-updates-toggle");
    const systemTrayToggle = frameBody.querySelector("#system-tray-toggle");

    const applyTheme = (themeName) => {
      const linkId = "custom-theme-link";

      const targets = [
        { doc: document, root: document.documentElement },
        { doc: frameDoc, root: htmlElement },
      ];

      targets.forEach(({ doc, root }) => {
        let linkEl = doc.getElementById(linkId);

        root.classList.remove("light-theme");

        if (themeName === "light") {
          root.classList.add("light-theme");
          if (linkEl) linkEl.remove();
        } else if (themeName === "dark") {
          if (linkEl) linkEl.remove();
        } else {
          if (!linkEl) {
            linkEl = doc.createElement("link");
            linkEl.id = linkId;
            linkEl.rel = "stylesheet";

            doc.head.appendChild(linkEl);
          }
          linkEl.href = `./style/themes/${themeName}.css`;
        }
      });
    };

    ipcRenderer.send("get-themes");

    ipcRenderer.once("themes-list", (event, customThemes) => {
      themeSelect.innerHTML = `
                <option value="dark">Dark</option>
                <option value="light">Light</option>
            `;

      customThemes.forEach((theme) => {
        const opt = document.createElement("option");
        opt.value = theme;
        opt.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
        themeSelect.appendChild(opt);
      });

      themeSelect._parseOptions?.();

      let storedTheme = localStorage.getItem("app-theme");

      if (!storedTheme) {
        const oldLightMode = localStorage.getItem("light-theme");
        if (oldLightMode === "true") {
          storedTheme = "light";
          localStorage.removeItem("light-theme");
          localStorage.setItem("app-theme", "light");
        } else {
          storedTheme = "dark";
        }
      }

      themeSelect.value = storedTheme;
      applyTheme(storedTheme);
    });

    themeSelect.addEventListener("change", () => {
      const val = themeSelect.value;
      localStorage.setItem("app-theme", val);
      localStorage.removeItem("light-theme");
      applyTheme(val);
    });

    let navigationSections = {};

    frameBody.querySelectorAll(".group-title").forEach((title) => {
      navigationSections[title.id] = title.textContent;
    });

    let searchHits = [];
    let currentIndex = -1;

    const btnPrev = navButtons.children[0];
    const btnNext = navButtons.children[1];

    const scrollToHit = (idx) => {
      if (!searchHits.length) return;
      currentIndex =
        ((idx % searchHits.length) + searchHits.length) % searchHits.length;

      searchHits.forEach((it, i) =>
        it.classList.toggle("item-found", i === currentIndex),
      );

      searchHits[currentIndex].scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      itemsFound.textContent = `${currentIndex + 1}/${searchHits.length}`;
    };

    const handleSearch = debounce(() => {
      const query = searchInput.value.trim().toLowerCase();
      const allItems = [...frameBody.querySelectorAll(".item")];

      allItems.forEach((it) => it.classList.remove("item-found"));
      searchHits = [];
      currentIndex = -1;

      if (!query) {
        itemsFound.textContent = "0/0";
        navButtons.classList.remove("items-are-found");
        itemsFound.classList.remove("items-are-found");
        return;
      }

      searchHits = allItems.filter((it) =>
        it.textContent.toLowerCase().includes(query),
      );
      itemsFound.textContent = `0/${searchHits.length}`;
      navButtons.classList.toggle("items-are-found", searchHits.length > 0);
      itemsFound.classList.toggle("items-are-found", searchHits.length > 0);

      if (searchHits.length) {
        scrollToHit(0);
      }
    }, 200);

    searchInput.addEventListener("input", handleSearch);

    btnPrev.addEventListener(
      "click",
      () => searchHits.length && scrollToHit(currentIndex - 1),
    );
    btnNext.addEventListener(
      "click",
      () => searchHits.length && scrollToHit(currentIndex + 1),
    );

    searchInput.addEventListener("keydown", (e) => {
      if (!searchHits.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollToHit(currentIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollToHit(currentIndex - 1);
      }
    });

    const NAV_HEIGHT = navigationWrapper.offsetHeight + 8;
    crosshairGroupTitle.style.marginTop = `${NAV_HEIGHT}px`;

    Object.keys(navigationSections).forEach((section) => {
      const tab = document.createElement("div");
      tab.classList.add("navigation-tab");
      tab.textContent = navigationSections[section];

      tab.addEventListener("click", () => {
        const targetSection = frameBody.querySelector(`#${section}`);
        if (!targetSection) return;

        const scrollTop = targetSection.offsetTop - NAV_HEIGHT * 2.5;
        targetSection.parentElement.scrollTo({
          top: scrollTop,
          behavior: "smooth",
        });
      });
      navigationTabs.appendChild(tab);
    });

    searchInput.addEventListener("focus", () => {
      navigationInput.classList.add("search-active");
    });

    searchInput.addEventListener("blur", () => {
      navigationInput.classList.remove("search-active");
    });

    frameDoc.addEventListener("keydown", (e) => {
      if (e.key === "F3" || (e.ctrlKey && e.key === "f")) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    reducedMotionSelect.value =
      localStorage.getItem("reduced-motion") || "system";
    applyReducedMotion(reducedMotionSelect.value);

    autoUpdater.checked = localStorage.getItem("auto-updates") === "true";

    const storedTrayState = localStorage.getItem("system-tray");
    systemTrayToggle.checked =
      storedTrayState === null ? true : storedTrayState === "true";

    systemTrayToggle.addEventListener("change", () => {
      const isEnabled = systemTrayToggle.checked;

      new Modal([
        {
          element: "div",
          extraClass: "modal-wrapper",
          children: [
            {
              element: "div",
              text: "Changing the system tray setting requires the app to restart to take effect.",
              extraClass: "modal-message",
            },
            {
              element: "div",
              extraClass: "modal-wrapper-buttons",
              children: [
                {
                  element: "button",
                  text: "Restart Now",
                  event: "click",
                  eventAction: () => {
                    localStorage.setItem("system-tray", isEnabled);
                    ipcRenderer.send("restart-app");
                  },
                },
                {
                  element: "button",
                  text: "Later",
                  event: "click",
                  eventAction: (ev) => {
                    localStorage.setItem("system-tray", isEnabled);
                    ev.target.closest(".modal-background").remove();
                  },
                },
              ],
            },
          ],
        },
      ]);
    });

    const INPUT_DEBOUNCE_DELAY = 50;

    const debouncedSendSize = debounce((value) => {
      ipcRenderer.send("change-size", value);
      console.log("Debounced size change sent:", value);
    }, INPUT_DEBOUNCE_DELAY);

    if (resetButton) {
      resetButton.addEventListener("click", () => {
        localStorage.removeItem("config");
        config = {
          ...(typeof DEFAULT_CONFIG !== "undefined"
            ? DEFAULT_CONFIG
            : {
              size: 40,
              hue: 0,
              rotation: 0,
              opacity: 1,
              crosshair: "",
              fixedPosition: false,
              xPosition: 0,
              yPosition: 0,
            }),
        };

        sizeRange.value = config.size;
        hueRange.value = config.hue;
        rotateRange.value = config.rotation;
        opacityRange.value = config.opacity;

        sizeRange.title = sizeRange.value;
        hueRange.title = hueRange.value;
        rotateRange.title = rotateRange.value;
        opacityRange.title = parseFloat(opacityRange.value).toFixed(1);

        fixedPositionToggle.checked = config.fixedPosition;
        xPositionInput.value = config.xPosition;
        yPositionInput.value = config.yPosition;

        xPositionInput.title = xPositionInput.value;
        yPositionInput.title = yPositionInput.value;

        ipcRenderer.send("config", config);
        ipcRenderer.send("change-size", config.size);
        ipcRenderer.send("change-hue", config.hue);
        ipcRenderer.send("change-rotation", config.rotation);
        ipcRenderer.send("change-opacity", config.opacity);
        ipcRenderer.send("change-fixed-position", config.fixedPosition);
        ipcRenderer.send("change-x-position", config.xPosition);
        ipcRenderer.send("change-y-position", config.yPosition);

        localStorage.removeItem("crosshairs-directory");
        setDirectorySubText.textContent = "No directory";
        if (typeof openDir !== "undefined") {
          openDir.title = "No directory";
          openDir.classList.add("disabled");
        }
        ipcRenderer.send("onload-crosshair-directory", null);

        localStorage.removeItem("app-theme");
        localStorage.removeItem("light-theme");
        themeSelect.value = "dark";
        applyTheme("dark");

        localStorage.removeItem("reduced-motion");
        reducedMotionSelect.value = "system";
        applyReducedMotion("system");

        if (localStorage.getItem("auto-updates") === "true") {
          localStorage.removeItem("auto-updates");
        }
        autoUpdater.checked = false;

        localStorage.removeItem("system-tray");
        systemTrayToggle.checked = true;
        ipcRenderer.send("toggle-tray", true);

        refreshOverlay();
      });
    }

    if (closeButton) {
      closeButton.addEventListener("click", () => {
        frame.classList.add("full-animation");
        if (typeof container !== "undefined") {
          container.classList.remove("full-animation");
        } else {
          console.warn("'container' element not found for animation.");
        }
        setTimeout(() => {
          frame.remove();
        }, 200);
      });
    }

    sizeRange.value = config.size || 40;
    sizeRange.title = sizeRange.value;
    sizeRange.addEventListener("change", () => {
      const currentValue = sizeRange.value;
      config.size = currentValue;
      sizeRange.title = currentValue;
      localStorage.setItem("config", JSON.stringify(config));
      debouncedSendSize(currentValue);
      // Also propagate size into canvas-config so drawPixelCrosshair can scale correctly.
      sendCanvasParams({ size: Number(currentValue) });
    });

    hueRange.value = config.hue || 0;
    hueRange.title = hueRange.value;
    hueRange.addEventListener("change", () => {
      config.hue = hueRange.value;
      localStorage.setItem("config", JSON.stringify(config));
      ipcRenderer.send("change-hue", hueRange.value);
      hueRange.title = hueRange.value;
    });

    rotateRange.value = config.rotation || 0;
    rotateRange.title = rotateRange.value;
    rotateRange.addEventListener("change", () => {
      config.rotation = rotateRange.value;
      localStorage.setItem("config", JSON.stringify(config));
      ipcRenderer.send("change-rotation", rotateRange.value);
      rotateRange.title = rotateRange.value;
    });

    opacityRange.value = config.opacity || 1;
    opacityRange.title = parseFloat(opacityRange.value.toFixed(1));
    opacityRange.addEventListener("change", () => {
      config.opacity = opacityRange.value;
      localStorage.setItem("config", JSON.stringify(config));
      ipcRenderer.send("change-opacity", opacityRange.value);
      opacityRange.title = parseFloat(opacityRange.value.toFixed(1));
    });

    fixedPositionToggle.checked = config.fixedPosition || false;
    fixedPositionToggle.addEventListener("change", () => {
      config.fixedPosition = fixedPositionToggle.checked;
      localStorage.setItem("config", JSON.stringify(config));
      ipcRenderer.send("change-fixed-position", config.fixedPosition);
    });

    // ─── Monitor / Display Selection ──────────────────────────────────────
    const displaySelect = frameBody.querySelector("#display-select");
    const recenterBtn = frameBody.querySelector("#recenter-btn");

    ipcRenderer.send("get-displays");
    ipcRenderer.once("displays-list", (event, displays) => {
      if (!displaySelect) return;

      // Limpa opções padrão e reconstrói com dados reais
      displaySelect.innerHTML = `
                <option value="primary">Primary</option>
                <option value="cursor">Where cursor is</option>
            `;

      displays.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = String(d.index);
        const tag = d.isPrimary ? " (Primary)" : "";
        const res = `${d.bounds.width}×${d.bounds.height}`;
        opt.textContent = `${d.label}${tag} — ${res}`;
        displaySelect.appendChild(opt);
      });

      displaySelect._parseOptions?.();

      // Restaura o valor salvo
      const saved = localStorage.getItem("display-target") || "primary";
      displaySelect.value = saved;
    });

    displaySelect?.addEventListener("change", () => {
      const raw = displaySelect.value;
      const target = raw === "primary" || raw === "cursor" ? raw : Number(raw);

      localStorage.setItem("display-target", String(raw));
      ipcRenderer.send("set-display", target);
    });

    recenterBtn?.addEventListener("click", () => {
      ipcRenderer.send("recenter-crosshair");

      // Aguarda a resposta com as coordenadas calculadas e atualiza os inputs
      ipcRenderer.once("center-coords", (event, { x, y }) => {
        if (xPositionInput) {
          xPositionInput.value = x;
          xPositionInput.title = x;
        }
        if (yPositionInput) {
          yPositionInput.value = y;
          yPositionInput.title = y;
        }

        // Persiste as novas coordenadas no config
        config.xPosition = x;
        config.yPosition = y;
        localStorage.setItem("config", JSON.stringify(config));
      });
    });
    // ─────────────────────────────────────────────────────────────────────

    xPositionInput.value = config.xPosition || 0;
    xPositionInput.title = xPositionInput.value;
    xPositionInput.addEventListener("change", () => {
      const currentValue = parseInt(xPositionInput.value);
      config.xPosition = currentValue;
      xPositionInput.title = currentValue;
      localStorage.setItem("config", JSON.stringify(config));
      ipcRenderer.send("change-x-position", currentValue);
    });

    yPositionInput.value = config.yPosition || 0;
    yPositionInput.title = yPositionInput.value;
    yPositionInput.addEventListener("change", () => {
      const currentValue = parseInt(yPositionInput.value);
      config.yPosition = currentValue;
      yPositionInput.title = currentValue;
      localStorage.setItem("config", JSON.stringify(config));
      ipcRenderer.send("change-y-position", currentValue);
    });

    saveMousePositionButton.addEventListener("click", () => {
      ipcRenderer.send("get-mouse-position");
    });

    ipcRenderer.on("mouse-position", (event, { x, y }) => {
      config.xPosition = x;
      config.yPosition = y;
      localStorage.setItem("config", JSON.stringify(config));

      xPositionInput.value = x;
      yPositionInput.value = y;
      xPositionInput.title = x;
      yPositionInput.title = y;

      ipcRenderer.send("change-x-position", x);
      ipcRenderer.send("change-y-position", y);
    });

    function rebuildPresetList() {
      loadPresetSelect.innerHTML = '<option value="default">Default</option>';

      const presets = JSON.parse(
        localStorage.getItem("crosshair-presets") || "{}",
      );

      ipcRenderer.send("update-tray-presets", presets);

      Object.keys(presets).forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        loadPresetSelect.appendChild(opt);
      });

      loadPresetSelect._parseOptions?.();
    }

    rebuildPresetList();

    ipcRenderer.on("update-config-ui", (event, newConfig) => {
      config = newConfig;
      localStorage.setItem("config", JSON.stringify(config));

      sizeRange.value = config.size;
      hueRange.value = config.hue;
      rotateRange.value = config.rotation;
      opacityRange.value = config.opacity;

      sizeRange.title = sizeRange.value;
      hueRange.title = hueRange.value;
      rotateRange.title = rotateRange.value;
      opacityRange.title = parseFloat(opacityRange.value).toFixed(1);

      fixedPositionToggle.checked = config.fixedPosition;
      xPositionInput.value = config.xPosition;
      yPositionInput.value = config.yPosition;
    });

    loadPresetSelect.addEventListener("change", () => {
      const selectedPreset = loadPresetSelect.value;
      if (!selectedPreset) return;

      let presetObj;
      if (selectedPreset === "default") {
        presetObj = { ...DEFAULT_CONFIG };
      } else {
        const presets = JSON.parse(
          localStorage.getItem("crosshair-presets") || "{}",
        );
        presetObj = presets[selectedPreset];
        if (!presetObj) return;
      }

      config = { ...config, ...presetObj };
      localStorage.setItem("config", JSON.stringify(config));

      sizeRange.value = config.size;
      hueRange.value = config.hue;
      rotateRange.value = config.rotation;
      opacityRange.value = config.opacity;

      sizeRange.title = sizeRange.value;
      hueRange.title = hueRange.value;
      rotateRange.title = rotateRange.value;
      opacityRange.title = parseFloat(opacityRange.value).toFixed(1);

      ipcRenderer.send("apply-preset", config);

      if (config.crosshair && localStorage.getItem("crosshairs-directory")) {
        localStorage.setItem("custom-crosshair", config.crosshair);
      } else {
        localStorage.removeItem("custom-crosshair");
      }
    });

    savePresetButton.addEventListener("click", () => {
      const modal = new Modal([
        {
          element: "div",
          extraClass: "modal-wrapper",
          children: [
            { element: "div", text: "Enter a name for the preset" },
            {
              element: "input",
              extraClass: "modal-input",
              attributes: { placeholder: "My awesome crosshair" },
            },
            {
              element: "div",
              extraClass: "modal-wrapper-buttons",
              children: [
                {
                  element: "button",
                  text: "Save",
                  event: "click",
                  eventAction: (e) => {
                    const input = e.target
                      .closest(".modal-foreground")
                      .querySelector(".modal-input");
                    const name = input.value.trim();
                    if (!name) return;

                    const presets = JSON.parse(
                      localStorage.getItem("crosshair-presets") || "{}",
                    );
                    presets[name] = { ...config };
                    localStorage.setItem(
                      "crosshair-presets",
                      JSON.stringify(presets),
                    );

                    rebuildPresetList();

                    const opt = document.createElement("option");
                    opt.value = name;
                    opt.textContent = name;
                    loadPresetSelect.appendChild(opt);

                    modal.remove();
                  },
                },
                {
                  element: "button",
                  text: "Cancel",
                  event: "click",
                  eventAction: () => modal.remove(),
                },
              ],
            },
          ],
        },
      ]);

      setTimeout(() => {
        modal.element.querySelector(".modal-input")?.focus();
      }, 50);
    });

    deletePresetBtn?.addEventListener("click", () => {
      const selected = loadPresetSelect.value;
      if (selected === "default") return;

      new Modal([
        {
          element: "div",
          extraClass: "modal-wrapper",
          children: [
            { element: "div", text: `Delete “${selected}”?` },
            {
              element: "div",
              extraClass: "modal-wrapper-buttons",
              children: [
                {
                  element: "button",
                  text: "Delete",
                  event: "click",
                  eventAction: (e) => {
                    const presets = JSON.parse(
                      localStorage.getItem("crosshair-presets") || "{}",
                    );
                    delete presets[selected];
                    localStorage.setItem(
                      "crosshair-presets",
                      JSON.stringify(presets),
                    );
                    rebuildPresetList();
                    e.target.closest(".modal-background").remove();
                  },
                },
                {
                  element: "button",
                  text: "Cancel",
                  event: "click",
                  eventAction: (e) =>
                    e.target.closest(".modal-background").remove(),
                },
              ],
            },
          ],
        },
      ]);
    });

    deleteAllPresetsBtn?.addEventListener("click", () => {
      new Modal([
        {
          element: "div",
          extraClass: "modal-wrapper",
          children: [
            { element: "div", text: "Delete ALL saved presets?" },
            {
              element: "div",
              extraClass: "modal-wrapper-buttons",
              children: [
                {
                  element: "button",
                  text: "Delete All",
                  event: "click",
                  eventAction: (e) => {
                    localStorage.removeItem("crosshair-presets");
                    rebuildPresetList();
                    e.target.closest(".modal-background").remove();
                  },
                },
                {
                  element: "button",
                  text: "Cancel",
                  event: "click",
                  eventAction: (e) =>
                    e.target.closest(".modal-background").remove(),
                },
              ],
            },
          ],
        },
      ]);
    });

    exportPresets.addEventListener("action", (e) => {
      const presets = JSON.parse(localStorage.getItem("crosshair-presets"));

      if (e.detail.value === "save") {
        if (presets && Object.keys(presets).length > 0) {
          ipcRenderer.send("export-presets", presets || {});
        } else {
          messageFromUI("No presets to export.");
        }
      } else if (e.detail.value === "clipboard") {
        if (presets && Object.keys(presets).length > 0) {
          navigator.clipboard
            .writeText(JSON.stringify(presets, null, 2))
            .then(() => {
              messageFromUI("Copied to clipboard.");
            })
            .catch((err) => {
              console.error("Failed to copy presets:", err);
              messageFromUI("Failed to copy presets to clipboard.");
            });
        } else {
          messageFromUI("No presets to copy.");
        }
      }
    });

    importPresets.addEventListener("action", (e) => {
      if (e.detail.value === "load") {
        ipcRenderer.send("import-presets");
        ipcRenderer.once("imported-presets", (event, presets) => {
          if (presets && Object.keys(presets).length > 0) {
            localStorage.setItem("crosshair-presets", JSON.stringify(presets));
            rebuildPresetList();
            messageFromUI("Presets imported successfully.");
          } else {
            messageFromUI("No presets found in the file.");
          }
        });
        ipcMain.once("import-presets-error", (event, error) => {
          console.error("Error importing presets:", error);
          messageFromUI(
            "Failed to import presets. Please check the file format.",
          );
        });
      } else if (e.detail.value === "clipboard") {
        navigator.clipboard
          .readText()
          .then((text) => {
            try {
              const presets = JSON.parse(text);
              localStorage.setItem(
                "crosshair-presets",
                JSON.stringify(presets),
              );
              rebuildPresetList();
              messageFromUI("Presets imported from clipboard.");
            } catch (err) {
              console.error("Failed to parse presets from clipboard:", err);
              messageFromUI("Invalid presets format in clipboard.");
            }
          })
          .catch((err) => {
            console.error("Failed to read clipboard:", err);
            messageFromUI("Failed to read presets from clipboard.");
          });
      }
    });

    const messageFromUI = (message, opts = {}) => {
      const cfg = {
        okText: "OK",
        onClose: (modal) => modal.remove(),
        ...opts,
      };

      const modal = new Modal([
        {
          element: "div",
          extraClass: "modal-wrapper",
          children: [
            { element: "div", text: message, extraClass: "modal-message" },
            {
              element: "div",
              extraClass: "modal-wrapper-buttons",
              children: [
                {
                  element: "button",
                  text: cfg.okText,
                  event: "click",
                  eventAction: () => cfg.onClose(modal),
                },
              ],
            },
          ],
        },
      ]);
    };

    const crosshairsDirectory =
      localStorage.getItem("crosshairs-directory") || "";

    if (crosshairsDirectory.trim() === "" || !crosshairsDirectory) {
      setDirectorySubText.textContent = "No directory";
    } else {
      setDirectorySubText.textContent = crosshairsDirectory;
    }

    setDirectory.addEventListener("click", () => {
      ipcRenderer.send("open-folder-dialog");
      ipcRenderer.once("custom-crosshairs-directory", (event, directory) => {
        localStorage.setItem("crosshairs-directory", directory);

        const dir = localStorage.getItem("crosshairs-directory");
        setDirectorySubText.textContent = dir;
        if (typeof openDir !== "undefined") {
          openDir.title = dir;
          openDir.classList.remove("disabled");
        } else {
          console.warn("'openDir' element not found.");
        }

        ipcRenderer.send(
          "onload-crosshair-directory",
          localStorage.getItem("crosshairs-directory") || null,
        );
        setTimeout(updateCrosshairSaveState, 100);
      });
    });

    removeDir.addEventListener("click", () => {
      localStorage.removeItem("crosshairs-directory");
      setDirectorySubText.textContent = "No directory";
      if (typeof openDir !== "undefined") {
        openDir.title = "No directory";
        openDir.classList.add("disabled");
      } else {
        console.warn("'openDir' element not found.");
      }
      ipcRenderer.send("onload-crosshair-directory", null);
      setTimeout(updateCrosshairSaveState, 100);
    });

    const updateCrosshairSaveState = () => {
      const dir = localStorage.getItem("crosshairs-directory");
      const hasDir = dir && dir.trim() !== "";

      if (hasDir) {
        saveCrosshairCodeBtn.classList.remove("disabled");
        saveCrosshairCodeBtn.style.opacity = "1";
        saveCrosshairCodeBtn.style.pointerEvents = "all";
        crosshairCodeInput.disabled = false;
      } else {
        saveCrosshairCodeBtn.classList.add("disabled");
        saveCrosshairCodeBtn.style.opacity = "0.5";
        saveCrosshairCodeBtn.style.pointerEvents = "none";
        crosshairCodeInput.disabled = true;
      }
    };

    saveCrosshairCodeBtn.addEventListener("click", () => {
      const code = crosshairCodeInput.value.trim();
      if (!code) {
        messageFromUI("Please enter a crosshair code first.");
        return;
      }

      new Modal([
        {
          element: "div",
          extraClass: "modal-wrapper",
          children: [
            { element: "div", text: "Name your crosshair" },
            {
              element: "input",
              extraClass: "modal-input",
              attributes: { placeholder: "TenZ-AimBot" },
            },
            {
              element: "div",
              extraClass: "modal-wrapper-buttons",
              children: [
                {
                  element: "button",
                  text: "Save",
                  event: "click",
                  eventAction: (e) => {
                    const input = e.target
                      .closest(".modal-foreground")
                      .querySelector(".modal-input");
                    const name = input.value.trim();
                    if (!name) return;

                    try {
                      const generator = new ValorantCrosshair();
                      const svgString = generator.generate(code);

                      ipcRenderer.send("save-generated-crosshair", {
                        name: name,
                        svg: svgString,
                      });

                      crosshairCodeInput.value = "";
                      e.target.closest(".modal-background").remove();
                    } catch (err) {
                      console.error(err);
                      messageFromUI("Invalid Crosshair Code");
                    }
                  },
                },
                {
                  element: "button",
                  text: "Cancel",
                  event: "click",
                  eventAction: (e) =>
                    e.target.closest(".modal-background").remove(),
                },
              ],
            },
          ],
        },
      ]);

      setTimeout(() => {
        const modalInput = document.querySelector(".modal-input");
        if (modalInput) modalInput.focus();
      }, 50);
    });

    updateCrosshairSaveState();

    // ─── Canvas Style Controls ────────────────────────────────────────────
    const canvasStyleSelect = frameBody.querySelector("#canvas-style-select");
    const canvasColorInput = frameBody.querySelector("#canvas-color-input");
    const canvasGapRange = frameBody.querySelector("#canvas-gap-range");
    const canvasLengthRange = frameBody.querySelector("#canvas-length-range");
    const canvasThicknessRange = frameBody.querySelector(
      "#canvas-thickness-range",
    );
    const canvasDotToggle = frameBody.querySelector("#canvas-dot-toggle");
    const canvasOutlineToggle = frameBody.querySelector(
      "#canvas-outline-toggle",
    );
    const canvasOutlineColorInput = frameBody.querySelector(
      "#canvas-outline-color-input",
    );
    const canvasOutlineThicknessRange = frameBody.querySelector(
      "#canvas-outline-thickness-range",
    );
    const canvasOutlineOpacityRange = frameBody.querySelector(
      "#canvas-outline-opacity-range",
    );

    // Number inputs (paired with sliders)
    const canvasGapInput = frameBody.querySelector("#canvas-gap-input");
    const canvasLengthInput = frameBody.querySelector("#canvas-length-input");
    const canvasThicknessInput = frameBody.querySelector("#canvas-thickness-input");
    const canvasOutlineThicknessInput = frameBody.querySelector("#canvas-outline-thickness-input");
    const canvasOutlineOpacityInput = frameBody.querySelector("#canvas-outline-opacity-input");

    // Pixel Draw editor button (only visible when Pixel Draw style is selected)
    const openPixelDrawBtn = frameBody.querySelector("#open-pixel-draw");

    // Items that should be hidden when Pixel Draw mode is active
    const pixelDrawHiddenItems = [
      frameBody.querySelector("#canvas-gap-input")?.closest(".item"),
      frameBody.querySelector("#canvas-length-input")?.closest(".item"),
      frameBody.querySelector("#canvas-thickness-input")?.closest(".item"),
      frameBody.querySelector("#canvas-dot-toggle")?.closest(".item"),
    ].filter(Boolean);

    /** Switches the canvas settings UI between Pixel Draw mode and normal mode. */
    function setPixelDrawMode(active) {
      pixelDrawHiddenItems.forEach((el) => el.style.setProperty("display", active ? "none" : ""));
      if (openPixelDrawBtn) openPixelDrawBtn.style.display = active ? "" : "none";
    }

    // Populate Style Select
    if (canvasStyleSelect && frame.contentWindow.CanvasCrosshair) {
      canvasStyleSelect.innerHTML = "";
      frame.contentWindow.CanvasCrosshair.styles.forEach((style) => {
        const opt = document.createElement("option");
        opt.value = style;
        opt.textContent = style;
        canvasStyleSelect.appendChild(opt);
      });
      canvasStyleSelect._parseOptions?.(); // Re-initialize custom-select if needed
    }

    // Função que lê o canvasParams salvo do localStorage
    function getCanvasParams() {
      try {
        return JSON.parse(localStorage.getItem("canvas-config")) || {};
      } catch {
        return {};
      }
    }

    function sendCanvasParams(patch) {
      const current = getCanvasParams();
      const merged = { ...current, ...patch };
      localStorage.setItem("canvas-config", JSON.stringify(merged));
      ipcRenderer.send("load-canvas-params", merged);

      // If style changed, we might need to update the main config too to ensure it loads on restart
      if (patch.style) {
        config.crosshair = `canvas:${patch.style}`;
        localStorage.setItem("config", JSON.stringify(config));
      }
    }

    // Inicializa valores com o que está salvo
    const savedCanvas = getCanvasParams();

    if (canvasStyleSelect)
      canvasStyleSelect.value = savedCanvas.style || "Classic";
    if (canvasColorInput)
      canvasColorInput.value = savedCanvas.color ?? "#00ff00";
    if (canvasGapRange) canvasGapRange.value = savedCanvas.gap ?? 4;
    if (canvasGapInput) canvasGapInput.value = savedCanvas.gap ?? 4;
    if (canvasLengthRange) canvasLengthRange.value = savedCanvas.length ?? 8;
    if (canvasLengthInput) canvasLengthInput.value = savedCanvas.length ?? 8;
    if (canvasThicknessRange)
      canvasThicknessRange.value = savedCanvas.thickness ?? 2;
    if (canvasThicknessInput)
      canvasThicknessInput.value = savedCanvas.thickness ?? 2;
    if (canvasDotToggle) canvasDotToggle.checked = savedCanvas.dot ?? false;
    if (canvasOutlineToggle)
      canvasOutlineToggle.checked = savedCanvas.outline ?? false;
    if (canvasOutlineColorInput)
      canvasOutlineColorInput.value = savedCanvas.outlineColor ?? "#000000";
    if (canvasOutlineThicknessRange)
      canvasOutlineThicknessRange.value = savedCanvas.outlineThickness ?? 1;
    if (canvasOutlineThicknessInput)
      canvasOutlineThicknessInput.value = savedCanvas.outlineThickness ?? 1;
    if (canvasOutlineOpacityRange)
      canvasOutlineOpacityRange.value = savedCanvas.outlineOpacity ?? 1;
    if (canvasOutlineOpacityInput)
      canvasOutlineOpacityInput.value = savedCanvas.outlineOpacity ?? 1;

    // Seed the current Size into canvas-config so drawPixelCrosshair has it from
    // the very first render, even if the user hasn't moved the Size slider yet.
    if (savedCanvas.size === undefined) {
      sendCanvasParams({ size: Number(config.size ?? 40) });
    }

    // Listeners
    canvasStyleSelect?.addEventListener("change", () => {
      const styleName = canvasStyleSelect.value;

      // Busca o preset padrão do estilo selecionado
      const CC = frame.contentWindow?.CanvasCrosshair;
      const preset = CC?.presets?.[styleName] ?? {};

      // Monta o novo config: estilo + preset + mantém cor/outline (customizações visuais)
      const current = getCanvasParams();
      const newParams = {
        ...current,
        ...preset,
        style: styleName,
      };

      // Atualiza os controles da UI com os valores do preset
      if (canvasThicknessRange && preset.thickness !== undefined) {
        canvasThicknessRange.value = preset.thickness;
        if (canvasThicknessInput) canvasThicknessInput.value = preset.thickness;
      }
      if (canvasGapRange && preset.gap !== undefined) {
        canvasGapRange.value = preset.gap;
        if (canvasGapInput) canvasGapInput.value = preset.gap;
      }
      if (canvasLengthRange && preset.length !== undefined) {
        canvasLengthRange.value = preset.length;
        if (canvasLengthInput) canvasLengthInput.value = preset.length;
      }
      if (canvasDotToggle && preset.dot !== undefined) {
        canvasDotToggle.checked = preset.dot;
      }

      // Toggle Pixel Draw mode UI
      setPixelDrawMode(styleName === "Pixel Draw");

      // Salva e envia tudo de uma vez
      localStorage.setItem("canvas-config", JSON.stringify(newParams));
      ipcRenderer.send("load-canvas-params", newParams);

      // Atualiza o crosshair selecionado no config principal
      config.crosshair = `canvas:${styleName}`;
      localStorage.setItem("config", JSON.stringify(config));
    });

    // Apply initial Pixel Draw mode state based on current saved style
    setPixelDrawMode((savedCanvas.style || "Classic") === "Pixel Draw");

    // Open the pixel editor modal when the button is clicked
    openPixelDrawBtn?.addEventListener("click", () => {
      const existing = getCanvasParams().pixelData ?? null;
      const frameWin = frame.contentWindow;

      // openPixelDrawModal is defined in pixel-draw.js, loaded inside the settings iframe
      if (typeof frameWin.openPixelDrawModal === "function") {
        frameWin.openPixelDrawModal(existing, (pixelData) => {
          sendCanvasParams({ pixelData });
          ipcRenderer.send("load-pixel-data", pixelData);
        });
      }
    });

    canvasColorInput?.addEventListener("input", () => {
      sendCanvasParams({ color: canvasColorInput.value });
    });

    canvasGapRange?.addEventListener("change", () => {
      if (canvasGapInput) canvasGapInput.value = canvasGapRange.value;
      sendCanvasParams({ gap: Number(canvasGapRange.value) });
    });
    canvasGapInput?.addEventListener("change", () => {
      const v = Number(canvasGapInput.value);
      if (canvasGapRange) canvasGapRange.value = v;
      sendCanvasParams({ gap: v });
    });

    canvasLengthRange?.addEventListener("change", () => {
      if (canvasLengthInput) canvasLengthInput.value = canvasLengthRange.value;
      sendCanvasParams({ length: Number(canvasLengthRange.value) });
    });
    canvasLengthInput?.addEventListener("change", () => {
      const v = Number(canvasLengthInput.value);
      if (canvasLengthRange) canvasLengthRange.value = v;
      sendCanvasParams({ length: v });
    });

    canvasThicknessRange?.addEventListener("change", () => {
      if (canvasThicknessInput) canvasThicknessInput.value = canvasThicknessRange.value;
      sendCanvasParams({ thickness: Number(canvasThicknessRange.value) });
    });
    canvasThicknessInput?.addEventListener("change", () => {
      const v = Number(canvasThicknessInput.value);
      if (canvasThicknessRange) canvasThicknessRange.value = v;
      sendCanvasParams({ thickness: v });
    });

    canvasDotToggle?.addEventListener("change", () => {
      sendCanvasParams({ dot: canvasDotToggle.checked });
    });

    canvasOutlineToggle?.addEventListener("change", () => {
      sendCanvasParams({ outline: canvasOutlineToggle.checked });
    });

    canvasOutlineColorInput?.addEventListener("input", () => {
      sendCanvasParams({ outlineColor: canvasOutlineColorInput.value });
    });

    canvasOutlineThicknessRange?.addEventListener("change", () => {
      if (canvasOutlineThicknessInput)
        canvasOutlineThicknessInput.value = canvasOutlineThicknessRange.value;
      sendCanvasParams({
        outlineThickness: Number(canvasOutlineThicknessRange.value),
      });
    });
    canvasOutlineThicknessInput?.addEventListener("change", () => {
      const v = Number(canvasOutlineThicknessInput.value);
      if (canvasOutlineThicknessRange) canvasOutlineThicknessRange.value = v;
      sendCanvasParams({ outlineThickness: v });
    });

    canvasOutlineOpacityRange?.addEventListener("change", () => {
      if (canvasOutlineOpacityInput)
        canvasOutlineOpacityInput.value = parseFloat(canvasOutlineOpacityRange.value).toFixed(1);
      sendCanvasParams({
        outlineOpacity: Number(canvasOutlineOpacityRange.value),
      });
    });
    canvasOutlineOpacityInput?.addEventListener("change", () => {
      const v = Number(canvasOutlineOpacityInput.value);
      if (canvasOutlineOpacityRange) canvasOutlineOpacityRange.value = v;
      sendCanvasParams({ outlineOpacity: v });
    });
    // ─────────────────────────────────────────────────────────────────────

    ipcRenderer.removeAllListeners("save-generated-crosshair-success");

    ipcRenderer.on("save-generated-crosshair-success", () => {
      messageFromUI("Crosshair saved successfully!");
      ipcRenderer.send("refresh-crosshairs");
    });

    reducedMotionSelect.addEventListener("change", () => {
      const val = reducedMotionSelect.value;
      localStorage.setItem("reduced-motion", val);
      applyReducedMotion(val);
    });

    about.addEventListener("click", () => {
      ipcRenderer.send("about-request");
      ipcRenderer.once("about-response", (event, info) => {
        if (!info.error) {
          const modal = new Modal([
            {
              element: "div",
              extraClass: "modal-wrapper",
              children: [
                {
                  element: "div",
                  children: [
                    {
                      element: "div",
                      text: `Version: ${info.version}`,
                    },
                    {
                      element: "div",
                      text: `Author: ${info.author}`,
                    },
                    {
                      element: "div",
                      text: `License: ${info.license}`,
                    },
                  ],
                },
                {
                  element: "div",
                  extraClass: "modal-wrapper-buttons",
                  children: [
                    {
                      element: "button",
                      text: "OK",
                      event: "click",
                      eventAction: () => modal.remove(),
                    },
                  ],
                },
              ],
            },
          ]);
        } else {
          alert("An error occured while trying to load data.");
        }
      });
    });

    checkForUpdates.addEventListener("click", () => updatesCheck(false));

    autoUpdater.addEventListener("change", () => {
      if (autoUpdater.checked) {
        localStorage.setItem("auto-updates", true);
      } else {
        localStorage.removeItem("auto-updates");
      }
    });
  });

  setTimeout(() => {
    frame.classList.remove("full-animation");
    container.classList.add("full-animation");
  });
});
