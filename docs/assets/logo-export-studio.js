(() => {
  "use strict";

  const BUILTIN_LOGOS = [
    {
      id: "snake",
      name: "蛇形标",
      slug: "snake",
      path: "assets/logo-system/svg/seasnake-logo-snake.svg",
      sizes: [40, 64, 96, 128],
    },
    {
      id: "triangle",
      name: "三角主标",
      slug: "triangle",
      path: "assets/logo-system/svg/seasnake-logo-triangle.svg",
      sizes: [40, 64, 96, 128],
    },
    {
      id: "wordmark-horizontal",
      name: "横版字标",
      slug: "wordmark-horizontal",
      path: "assets/logo-system/svg/seasnake-logo-wordmark-horizontal.svg",
      sizes: [76, 112, 164, 220],
    },
    {
      id: "snake-two-row",
      name: "蛇形双排组合",
      slug: "snake-two-row",
      path: "assets/logo-system/svg/seasnake-logo-snake-two-row.svg",
      sizes: [240, 360, 480, 640],
    },
  ];

  const DEFAULT_COLORS = [
    { id: "cyan", name: "青蓝", exportSlug: "cyan", hex: "#22C6C5", selected: true },
    { id: "acid", name: "竹叶", exportSlug: "acid", hex: "#D9F01A", selected: true },
    { id: "rose", name: "赤练", exportSlug: "rose", hex: "#F1265F", selected: true },
  ];

  const state = {
    logos: [],
    colors: DEFAULT_COLORS.map((color) => ({ ...color })),
    activeColorId: "acid",
    format: "png",
    sizeMode: "standard",
    customSizes: [128, 256, 512],
    canvasMode: "fit",
    padding: 8,
    backgroundMode: "transparent",
    customBackground: "#202523",
    forceMonochrome: true,
    exporting: false,
  };

  const elements = {};
  let previewUrls = [];
  let customLogoCounter = 0;
  let colorCounter = 0;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    bindStaticControls();
    renderLoadingLogos();

    try {
      state.logos = await Promise.all(BUILTIN_LOGOS.map(loadBuiltinLogo));
      renderAll();
    } catch (error) {
      console.error(error);
      elements.logoPicker.innerHTML = "";
      showToast(
        "主 SVG 读取失败。请通过 GitHub Pages 或本地网页服务打开该页面，不要直接双击 HTML 文件。",
        "error",
        8000,
      );
      renderPaletteList();
      renderColorTabs();
      updateSummaries();
    }

    window.SEASNAKE_EXPORT_STUDIO = {
      getState: () => snapshotState(),
      buildSvg: (logoId, colorHex, width, overrides = {}) => {
        const logo = state.logos.find((item) => item.id === logoId);
        if (!logo) throw new Error(`Unknown logo: ${logoId}`);
        return buildSvgAsset(logo, normalizeHex(colorHex), width, { ...currentExportOptions(), ...overrides });
      },
      createZip,
      exportActive: () => exportLogoKit("active"),
      exportAll: () => exportLogoKit("all"),
    };
  }

  function cacheElements() {
    elements.logoPicker = document.getElementById("logo-picker");
    elements.logoInput = document.getElementById("custom-logo-input");
    elements.paletteList = document.getElementById("palette-list");
    elements.addColor = document.getElementById("add-color");
    elements.customSizeField = document.getElementById("custom-size-field");
    elements.standardSizeHelp = document.getElementById("standard-size-help");
    elements.customSizes = document.getElementById("custom-sizes");
    elements.paddingRange = document.getElementById("padding-range");
    elements.paddingOutput = document.getElementById("padding-output");
    elements.customBackground = document.getElementById("custom-background");
    elements.monochromeToggle = document.getElementById("monochrome-toggle");
    elements.colorTabs = document.getElementById("color-tabs");
    elements.previewTitle = document.getElementById("preview-title");
    elements.previewGrid = document.getElementById("preview-grid");
    elements.emptyState = document.getElementById("empty-state");
    elements.selectionSummary = document.getElementById("selection-summary");
    elements.fileSummary = document.getElementById("file-summary");
    elements.exportCount = document.getElementById("export-count");
    elements.exportActive = document.getElementById("export-active");
    elements.exportAll = document.getElementById("export-all");
    elements.toastRegion = document.getElementById("toast-region");
    elements.overlay = document.getElementById("export-overlay");
    elements.progressTitle = document.getElementById("progress-title");
    elements.progressDetail = document.getElementById("progress-detail");
    elements.progressBar = document.getElementById("progress-bar");
  }

  function bindStaticControls() {
    elements.logoInput.addEventListener("change", handleCustomLogoUpload);
    elements.addColor.addEventListener("click", addBrandColor);
    elements.exportActive.addEventListener("click", () => exportLogoKit("active"));
    elements.exportAll.addEventListener("click", () => exportLogoKit("all"));

    document.querySelectorAll('input[name="format"]').forEach((input) => {
      input.addEventListener("change", () => {
        state.format = input.value;
        updateSummaries();
      });
    });

    document.querySelectorAll('input[name="size-mode"]').forEach((input) => {
      input.addEventListener("change", () => {
        state.sizeMode = input.value;
        elements.customSizeField.hidden = state.sizeMode !== "custom";
        elements.standardSizeHelp.hidden = state.sizeMode === "custom";
        renderPreview();
        updateSummaries();
      });
    });

    elements.customSizes.addEventListener("input", () => {
      state.customSizes = parseCustomSizes(elements.customSizes.value);
      renderPreview();
      updateSummaries();
    });

    document.querySelectorAll('input[name="canvas-mode"]').forEach((input) => {
      input.addEventListener("change", () => {
        state.canvasMode = input.value;
        renderPreview();
      });
    });

    elements.paddingRange.addEventListener("input", () => {
      state.padding = Number(elements.paddingRange.value);
      elements.paddingOutput.value = `${state.padding}%`;
      elements.paddingOutput.textContent = `${state.padding}%`;
      renderPreview();
    });

    document.querySelectorAll('input[name="background"]').forEach((input) => {
      input.addEventListener("change", () => {
        state.backgroundMode = input.value;
        renderPreview();
      });
    });

    elements.customBackground.addEventListener("input", () => {
      state.customBackground = elements.customBackground.value.toUpperCase();
      const customRadio = document.querySelector('input[name="background"][value="custom"]');
      customRadio.checked = true;
      state.backgroundMode = "custom";
      renderPreview();
    });

    elements.monochromeToggle.addEventListener("change", () => {
      state.forceMonochrome = elements.monochromeToggle.checked;
      renderPreview();
    });
  }

  async function loadBuiltinLogo(config) {
    const response = await fetch(config.path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Unable to load ${config.path}: ${response.status}`);
    const source = sanitizeSvg(await response.text());
    return {
      ...config,
      source,
      selected: true,
      custom: false,
      previewPath: config.path,
    };
  }

  function renderLoadingLogos() {
    elements.logoPicker.innerHTML = Array.from({ length: 4 }, (_, index) => (
      `<div class="logo-option-card" style="opacity:${0.34 + index * 0.08}"><span>载入主资产…</span></div>`
    )).join("");
  }

  function renderAll() {
    renderLogoPicker();
    renderPaletteList();
    renderColorTabs();
    renderPreview();
    updateSummaries();
  }

  function renderLogoPicker() {
    elements.logoPicker.innerHTML = "";
    state.logos.forEach((logo) => {
      const wrapper = document.createElement("div");
      wrapper.className = "logo-option";

      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = logo.selected;
      checkbox.setAttribute("aria-label", `选择 ${logo.name}`);
      checkbox.addEventListener("change", () => {
        logo.selected = checkbox.checked;
        renderPreview();
        updateSummaries();
      });

      const card = document.createElement("span");
      card.className = "logo-option-card";
      const image = document.createElement("img");
      image.src = logo.previewPath;
      image.alt = "";
      const name = document.createElement("span");
      name.textContent = logo.name;
      card.append(image, name);
      label.append(checkbox, card);
      wrapper.append(label);

      if (logo.custom) {
        const remove = document.createElement("button");
        remove.className = "logo-remove";
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `移除 ${logo.name}`);
        remove.addEventListener("click", () => removeCustomLogo(logo.id));
        wrapper.append(remove);
      }

      elements.logoPicker.append(wrapper);
    });
  }

  async function handleCustomLogoUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    let added = 0;
    for (const file of files.slice(0, 12)) {
      if (file.size > 3 * 1024 * 1024) {
        showToast(`${file.name} 超过 3 MB，已跳过。`, "error");
        continue;
      }
      try {
        const source = sanitizeSvg(await file.text());
        const id = `custom-${Date.now()}-${customLogoCounter++}`;
        const blobUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
        const customNumber = customLogoCounter;
        state.logos.push({
          id,
          name: file.name.replace(/\.svg$/i, "") || "自定义 Logo",
          slug: safeAsciiSegment(file.name.replace(/\.svg$/i, ""), `custom-logo-${customNumber}`),
          path: null,
          previewPath: blobUrl,
          source,
          sizes: [128, 256, 512, 1024],
          selected: true,
          custom: true,
        });
        added += 1;
      } catch (error) {
        console.error(error);
        showToast(`${file.name} 不是可用的 SVG，已跳过。`, "error");
      }
    }

    if (files.length > 12) showToast("一次最多加入 12 个 SVG，其余文件已跳过。", "error");
    if (added) {
      renderLogoPicker();
      renderPreview();
      updateSummaries();
      showToast(`已加入 ${added} 个自定义 SVG。`);
    }
  }

  function removeCustomLogo(id) {
    const logo = state.logos.find((item) => item.id === id);
    if (!logo || !logo.custom) return;
    URL.revokeObjectURL(logo.previewPath);
    state.logos = state.logos.filter((item) => item.id !== id);
    renderLogoPicker();
    renderPreview();
    updateSummaries();
  }

  function renderPaletteList() {
    elements.paletteList.innerHTML = "";
    state.colors.forEach((color) => {
      const row = document.createElement("div");
      row.className = "palette-row";
      row.style.setProperty("--row-color", color.hex);

      const selected = document.createElement("input");
      selected.type = "checkbox";
      selected.checked = color.selected;
      selected.setAttribute("aria-label", `导出 ${color.name}`);
      selected.addEventListener("change", () => {
        color.selected = selected.checked;
        keepActiveColorValid();
        renderColorTabs();
        renderPreview();
        updateSummaries();
      });

      const well = document.createElement("label");
      well.className = "color-well";
      well.title = `修改 ${color.name} 色值`;
      const picker = document.createElement("input");
      picker.type = "color";
      picker.value = color.hex;
      picker.setAttribute("aria-label", `${color.name} 色值`);
      well.append(picker);

      const name = document.createElement("input");
      name.className = "palette-name";
      name.value = color.name;
      name.maxLength = 20;
      name.setAttribute("aria-label", "品牌色名称");

      const hex = document.createElement("input");
      hex.className = "palette-hex";
      hex.value = color.hex;
      hex.maxLength = 7;
      hex.spellcheck = false;
      hex.setAttribute("aria-label", `${color.name} HEX 色值`);

      const remove = document.createElement("button");
      remove.className = "palette-delete";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `删除 ${color.name}`);

      picker.addEventListener("input", () => {
        color.hex = picker.value.toUpperCase();
        hex.value = color.hex;
        row.style.setProperty("--row-color", color.hex);
        refreshAfterColorEdit();
      });

      hex.addEventListener("input", () => {
        const normalized = tryNormalizeHex(hex.value);
        hex.setCustomValidity(normalized ? "" : "请输入 3 位或 6 位 HEX 色值");
        if (!normalized) return;
        color.hex = normalized;
        picker.value = normalized;
        row.style.setProperty("--row-color", normalized);
        refreshAfterColorEdit();
      });

      hex.addEventListener("blur", () => {
        hex.value = color.hex;
        hex.setCustomValidity("");
      });

      name.addEventListener("input", () => {
        color.name = name.value.trim() || "未命名色";
        refreshAfterColorEdit();
      });

      name.addEventListener("blur", () => {
        name.value = color.name;
      });

      remove.addEventListener("click", () => deleteBrandColor(color.id));
      row.append(selected, well, name, hex, remove);
      elements.paletteList.append(row);
    });
  }

  function addBrandColor() {
    const palette = ["#8A7DFF", "#FF8A1F", "#47D17A", "#F6F7EF"];
    const color = {
      id: `custom-color-${Date.now()}-${colorCounter++}`,
      name: `新色 ${state.colors.length + 1}`,
      exportSlug: `color-${String(state.colors.length + 1).padStart(2, "0")}`,
      hex: palette[colorCounter % palette.length],
      selected: true,
    };
    state.colors.push(color);
    state.activeColorId = color.id;
    renderPaletteList();
    renderColorTabs();
    renderPreview();
    updateSummaries();
  }

  function deleteBrandColor(id) {
    if (state.colors.length <= 1) {
      showToast("至少保留一个品牌色。", "error");
      return;
    }
    state.colors = state.colors.filter((color) => color.id !== id);
    keepActiveColorValid();
    renderPaletteList();
    renderColorTabs();
    renderPreview();
    updateSummaries();
  }

  function refreshAfterColorEdit() {
    renderColorTabs();
    renderPreview();
    updateSummaries();
  }

  function keepActiveColorValid() {
    const selected = selectedColors();
    if (selected.some((color) => color.id === state.activeColorId)) return;
    state.activeColorId = selected[0]?.id || state.colors[0]?.id || null;
  }

  function renderColorTabs() {
    keepActiveColorValid();
    elements.colorTabs.innerHTML = "";
    const colors = selectedColors();

    colors.forEach((color) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "color-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(color.id === state.activeColorId));
      tab.style.setProperty("--tab-color", color.hex);
      tab.innerHTML = `<i aria-hidden="true"></i><span><b></b><small></small></span>`;
      tab.querySelector("b").textContent = color.name;
      tab.querySelector("small").textContent = color.hex;
      tab.addEventListener("click", () => {
        state.activeColorId = color.id;
        renderColorTabs();
        renderPreview();
      });
      elements.colorTabs.append(tab);
    });
  }

  function renderPreview() {
    revokePreviewUrls();
    elements.previewGrid.innerHTML = "";

    const logos = selectedLogos();
    const color = activeColor();
    const empty = !logos.length || !color;
    elements.emptyState.hidden = !empty;
    elements.previewGrid.hidden = empty;
    if (empty) {
      elements.previewTitle.textContent = color ? `${color.name} · ${color.hex}` : "请选择品牌色";
      return;
    }

    setActiveAccent(color.hex);
    elements.previewTitle.textContent = `${color.name} · ${color.hex}`;
    const options = currentExportOptions();
    const background = resolvedBackground();
    const contrast = previewContrast(background);

    logos.forEach((logo) => {
      const previewWidth = state.canvasMode === "square" ? 512 : 720;
      const { svg } = buildSvgAsset(logo, color.hex, previewWidth, options);
      const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      previewUrls.push(objectUrl);

      const card = document.createElement("article");
      card.className = `preview-card${background ? "" : " transparent-preview"}`;
      card.style.setProperty("--preview-bg", background || "#111513");
      card.style.setProperty("--preview-ink", contrast.ink);
      card.style.setProperty("--preview-caption", contrast.caption);
      card.style.setProperty("--checker-a", "#151a18");
      card.style.setProperty("--checker-b", "#0e1211");

      const head = document.createElement("div");
      head.className = "preview-card-head";
      const logoName = document.createElement("b");
      logoName.textContent = logo.name;
      const dimensions = document.createElement("span");
      const geometry = assetGeometry(logo, previewWidth, options);
      dimensions.textContent = `${geometry.width} × ${geometry.height}`;
      head.append(logoName, dimensions);

      const stage = document.createElement("div");
      stage.className = "preview-logo-stage";
      const image = document.createElement("img");
      image.src = objectUrl;
      image.alt = `${logo.name} ${color.name}预览`;
      stage.append(image);

      const foot = document.createElement("div");
      foot.className = "preview-card-foot";
      const mode = document.createElement("span");
      mode.textContent = state.canvasMode === "square" ? "SQUARE CANVAS" : "FIT CANVAS";
      const sizes = document.createElement("span");
      const sizeCount = sizesForLogo(logo).length;
      sizes.textContent = `${sizeCount} SIZE${sizeCount === 1 ? "" : "S"}`;
      foot.append(mode, sizes);
      card.append(head, stage, foot);
      elements.previewGrid.append(card);
    });
  }

  function revokePreviewUrls() {
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
  }

  function updateSummaries() {
    const logos = selectedLogos();
    const colors = selectedColors();
    const perColor = countExportFiles(logos, 1);
    const total = countExportFiles(logos, colors.length);
    elements.selectionSummary.textContent = `${logos.length} 个 Logo`;
    elements.fileSummary.textContent = `${perColor} 个文件 / 色`;
    elements.exportCount.textContent = `即将生成 ${total} 个文件`;
    elements.exportActive.disabled = !logos.length || !colors.length || perColor === 0 || state.exporting;
    elements.exportAll.disabled = !logos.length || !colors.length || total === 0 || state.exporting;
  }

  function countExportFiles(logos, colorCount) {
    const formatMultiplier = state.format === "both" ? 2 : 1;
    const sizes = logos.reduce((sum, logo) => sum + sizesForLogo(logo).length, 0);
    return sizes * colorCount * formatMultiplier;
  }

  function sizesForLogo(logo) {
    if (state.sizeMode === "standard") return logo.sizes;
    return state.customSizes;
  }

  function parseCustomSizes(value) {
    return Array.from(new Set(
      value
        .split(/[，,\s]+/)
        .map((part) => Number.parseInt(part, 10))
        .filter((size) => Number.isFinite(size) && size >= 16 && size <= 8192),
    )).sort((a, b) => a - b).slice(0, 12);
  }

  function selectedLogos() {
    return state.logos.filter((logo) => logo.selected);
  }

  function selectedColors() {
    return state.colors.filter((color) => color.selected);
  }

  function activeColor() {
    return selectedColors().find((color) => color.id === state.activeColorId) || selectedColors()[0] || null;
  }

  function currentExportOptions() {
    return {
      canvasMode: state.canvasMode,
      padding: state.padding,
      background: resolvedBackground(),
      forceMonochrome: state.forceMonochrome,
    };
  }

  function resolvedBackground() {
    if (state.backgroundMode === "transparent") return null;
    if (state.backgroundMode === "custom") return state.customBackground;
    return state.backgroundMode;
  }

  function sanitizeSvg(source) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, "image/svg+xml");
    const parserError = doc.querySelector("parsererror");
    const svg = doc.documentElement;
    if (parserError || !svg || svg.localName.toLowerCase() !== "svg") {
      throw new Error("Invalid SVG document");
    }

    doc.querySelectorAll("script, foreignObject, iframe, object, embed, audio, video, link").forEach((node) => node.remove());
    doc.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes || []).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim();
        if (name.startsWith("on")) node.removeAttribute(attribute.name);
        if ((name === "href" || name === "xlink:href") && !value.startsWith("#") && !value.startsWith("data:image/")) {
          node.removeAttribute(attribute.name);
        }
        if (name === "style" && /(?:@import|javascript:|url\s*\(\s*["']?https?:)/i.test(value)) {
          node.removeAttribute(attribute.name);
        }
      });
    });
    doc.querySelectorAll("style").forEach((style) => {
      style.textContent = style.textContent
        .replace(/@import[^;]+;?/gi, "")
        .replace(/url\s*\(\s*["']?https?:[^)]+\)/gi, "none");
    });

    ensureViewBox(svg);
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(svg);
  }

  function ensureViewBox(svg) {
    if (svg.hasAttribute("viewBox")) return;
    const width = parseSvgLength(svg.getAttribute("width")) || 512;
    const height = parseSvgLength(svg.getAttribute("height")) || width;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  function buildSvgAsset(logo, colorHex, targetWidth, options) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(logo.source, "image/svg+xml");
    const svg = doc.documentElement;
    const color = normalizeHex(colorHex);
    const geometry = assetGeometry(logo, targetWidth, options);

    svg.setAttribute("viewBox", geometry.viewBox.join(" "));
    svg.setAttribute("width", String(geometry.width));
    svg.setAttribute("height", String(geometry.height));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("color", color);
    svg.style.setProperty("color", color);
    svg.setAttribute("data-export-color", color);
    svg.setAttribute("data-export-source", "SEASNAKE Logo Export Studio");

    if (options.forceMonochrome) forceMonochrome(svg, color);
    replaceCurrentColor(svg, color);

    if (options.background) {
      const rect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(geometry.viewBox[0]));
      rect.setAttribute("y", String(geometry.viewBox[1]));
      rect.setAttribute("width", String(geometry.viewBox[2]));
      rect.setAttribute("height", String(geometry.viewBox[3]));
      rect.setAttribute("fill", normalizeHex(options.background));
      rect.setAttribute("data-export-background", "true");
      const visibleAnchor = Array.from(svg.children).find((child) => !["title", "desc", "defs"].includes(child.localName));
      svg.insertBefore(rect, visibleAnchor || null);
    }

    const serialized = new XMLSerializer().serializeToString(svg);
    return {
      svg: `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}\n`,
      width: geometry.width,
      height: geometry.height,
    };
  }

  function assetGeometry(logo, targetWidth, options) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(logo.source, "image/svg+xml");
    const raw = doc.documentElement.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);
    const [x, y, sourceWidth, sourceHeight] = raw;
    const paddingRatio = Math.max(0, Number(options.padding) || 0) / 100;
    let viewBox;

    if (options.canvasMode === "square") {
      const side = Math.max(sourceWidth, sourceHeight);
      const paddedSide = side * (1 + paddingRatio * 2);
      const centerX = x + sourceWidth / 2;
      const centerY = y + sourceHeight / 2;
      viewBox = [centerX - paddedSide / 2, centerY - paddedSide / 2, paddedSide, paddedSide];
    } else {
      const padX = sourceWidth * paddingRatio;
      const padY = sourceHeight * paddingRatio;
      viewBox = [x - padX, y - padY, sourceWidth + padX * 2, sourceHeight + padY * 2];
    }

    const width = Math.max(1, Math.round(Number(targetWidth)));
    const height = Math.max(1, Math.round(width * viewBox[3] / viewBox[2]));
    return {
      viewBox: viewBox.map((value) => roundNumber(value, 4)),
      width,
      height,
    };
  }

  function forceMonochrome(svg, color) {
    svg.setAttribute("fill", color);
    svg.setAttribute("color", color);
    svg.querySelectorAll("*").forEach((node) => {
      ["fill", "stroke", "color", "stop-color", "flood-color"].forEach((attribute) => {
        if (!node.hasAttribute(attribute)) return;
        const value = node.getAttribute(attribute).trim();
        if (isProtectedPaint(value)) return;
        node.setAttribute(attribute, color);
      });
      if (node.hasAttribute("style")) {
        const updated = node.getAttribute("style").replace(
          /(fill|stroke|color|stop-color|flood-color)\s*:\s*(?!none\b|transparent\b|url\s*\()[^;]+/gi,
          `$1:${color}`,
        );
        node.setAttribute("style", updated);
      }
    });
    svg.querySelectorAll("style").forEach((style) => {
      style.textContent = style.textContent.replace(
        /(fill|stroke|color|stop-color|flood-color)\s*:\s*(?!none\b|transparent\b|url\s*\()[^;}]+/gi,
        `$1:${color}`,
      );
    });
  }

  function replaceCurrentColor(svg, color) {
    svg.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes || []).forEach((attribute) => {
        if (/currentColor/i.test(attribute.value)) {
          node.setAttribute(attribute.name, attribute.value.replace(/currentColor/gi, color));
        }
      });
    });
    svg.querySelectorAll("style").forEach((style) => {
      style.textContent = style.textContent.replace(/currentColor/gi, color);
    });
  }

  function isProtectedPaint(value) {
    return !value || /^(none|transparent|inherit|initial|unset)$/i.test(value) || /^url\s*\(/i.test(value);
  }

  async function exportLogoKit(scope) {
    if (state.exporting) return;
    const logos = selectedLogos();
    const colors = scope === "active" ? [activeColor()].filter(Boolean) : selectedColors();
    const sizesAvailable = logos.every((logo) => sizesForLogo(logo).length > 0);

    if (!logos.length) {
      showToast("请至少选择一个 Logo。", "error");
      return;
    }
    if (!colors.length) {
      showToast("请至少选择一个品牌色。", "error");
      return;
    }
    if (!sizesAvailable) {
      showToast("请输入 16–8192 px 之间的有效尺寸。", "error");
      return;
    }

    state.exporting = true;
    updateSummaries();
    showProgress(true, "正在生成导出文件…", "准备品牌资产", 0);

    try {
      const files = [];
      const total = countExportFiles(logos, colors.length);
      let complete = 0;
      const options = currentExportOptions();

      for (const color of colors) {
        const colorFolder = `${safeAsciiSegment(color.exportSlug || color.id, "color")}-${color.hex.slice(1).toUpperCase()}`;
        for (const logo of logos) {
          for (const width of sizesForLogo(logo)) {
            const asset = buildSvgAsset(logo, color.hex, width, options);
            const baseName = `${safeAsciiSegment(logo.slug, "logo")}-${width}w`;

            if (state.format === "svg" || state.format === "both") {
              files.push({
                name: `${colorFolder}/svg/${baseName}.svg`,
                data: new TextEncoder().encode(asset.svg),
              });
              complete += 1;
              updateProgress(color, logo, complete, total);
            }

            if (state.format === "png" || state.format === "both") {
              const png = await svgToPng(asset.svg, asset.width, asset.height);
              files.push({
                name: `${colorFolder}/png/${baseName}.png`,
                data: new Uint8Array(await png.arrayBuffer()),
              });
              complete += 1;
              updateProgress(color, logo, complete, total);
            }

            await nextFrame();
          }
        }
      }

      showProgress(true, "正在封装 ZIP…", `${files.length} 个文件已生成`, 97);
      const zipBlob = createZip(files);
      const date = new Date();
      const dateStamp = [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join("");
      const suffix = scope === "active" ? `-${safeAsciiSegment(colors[0].exportSlug || colors[0].id, "color")}` : "-all-colors";
      downloadBlob(zipBlob, `SEASNAKE-logo-kit${suffix}-${dateStamp}.zip`);
      showProgress(true, "导出完成", `已整理 ${files.length} 个文件`, 100);
      await delay(460);
      showToast(`导出完成：${files.length} 个文件已写入 ZIP。`);
    } catch (error) {
      console.error(error);
      showToast(`导出失败：${error.message || "未知错误"}`, "error", 8000);
    } finally {
      showProgress(false);
      state.exporting = false;
      updateSummaries();
    }
  }

  function updateProgress(color, logo, complete, total) {
    const percent = Math.min(95, Math.round((complete / total) * 95));
    showProgress(true, `正在生成 ${color.name}…`, `${logo.name} · ${complete} / ${total}`, percent);
  }

  async function svgToPng(svgText, width, height) {
    if (width > 8192 || height > 8192) throw new Error("PNG 画布不能超过 8192 px");
    const sourceBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const sourceUrl = URL.createObjectURL(sourceBlob);
    try {
      const image = await loadImage(sourceUrl);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("当前浏览器无法创建 PNG 画布");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG 编码失败")), "image/png");
      });
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("SVG 栅格化失败"));
      image.src = url;
    });
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const entries = [];
    let localOffset = 0;
    const now = new Date();
    const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((Math.floor(now.getSeconds() / 2)) & 0x1f);
    const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length + data.length);
      const view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, dosTime, true);
      view.setUint16(12, dosDate, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      view.setUint16(28, 0, true);
      local.set(name, 30);
      local.set(data, 30 + name.length);
      entries.push({ local, name, dataLength: data.length, crc, offset: localOffset, dosTime, dosDate });
      localOffset += local.length;
    }

    const centralParts = entries.map((entry) => {
      const central = new Uint8Array(46 + entry.name.length);
      const view = new DataView(central.buffer);
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, entry.dosTime, true);
      view.setUint16(14, entry.dosDate, true);
      view.setUint32(16, entry.crc, true);
      view.setUint32(20, entry.dataLength, true);
      view.setUint32(24, entry.dataLength, true);
      view.setUint16(28, entry.name.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, entry.offset, true);
      central.set(entry.name, 46);
      return central;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(4, 0, true);
    endView.setUint16(6, 0, true);
    endView.setUint16(8, entries.length, true);
    endView.setUint16(10, entries.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, localOffset, true);
    endView.setUint16(20, 0, true);

    return new Blob([...entries.map((entry) => entry.local), ...centralParts, end], { type: "application/zip" });
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      table[index] = value >>> 0;
    }
    return table;
  })();

  function crc32(data) {
    let crc = 0xffffffff;
    for (let index = 0; index < data.length; index += 1) crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function showProgress(visible, title = "", detail = "", percent = 0) {
    elements.overlay.hidden = !visible;
    if (!visible) return;
    elements.progressTitle.textContent = title;
    elements.progressDetail.textContent = detail;
    elements.progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function showToast(message, type = "info", duration = 4200) {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " error" : ""}`;
    toast.textContent = message;
    elements.toastRegion.append(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function setActiveAccent(hex) {
    const normalized = normalizeHex(hex);
    const rgb = hexToRgb(normalized);
    document.documentElement.style.setProperty("--accent", normalized);
    document.documentElement.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }

  function previewContrast(background) {
    if (!background) return { ink: "#F6F7EF", caption: "rgba(246,247,239,.58)" };
    const { r, g, b } = hexToRgb(background);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.55
      ? { ink: "#070909", caption: "rgba(7,9,9,.56)" }
      : { ink: "#F6F7EF", caption: "rgba(246,247,239,.58)" };
  }

  function normalizeHex(value) {
    const normalized = tryNormalizeHex(value);
    if (!normalized) throw new Error(`Invalid color: ${value}`);
    return normalized;
  }

  function tryNormalizeHex(value) {
    const raw = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
    if (/^#[0-9a-f]{3}$/i.test(raw)) {
      return `#${raw.slice(1).split("").map((part) => part + part).join("")}`.toUpperCase();
    }
    return null;
  }

  function hexToRgb(hex) {
    const value = normalizeHex(hex).slice(1);
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  }

  function parseSvgLength(value) {
    const parsed = Number.parseFloat(String(value || "").replace(/[^\d.+-]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function safeAsciiSegment(value, fallback = "asset") {
    const cleaned = String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^[._-]+|[._-]+$/g, "")
      .toLowerCase();
    return cleaned || fallback;
  }

  function roundNumber(value, precision) {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  function snapshotState() {
    return {
      ...state,
      logos: state.logos.map(({ source, previewPath, ...logo }) => ({ ...logo, sourceLength: source.length, previewPath })),
      colors: state.colors.map((color) => ({ ...color })),
      selectedLogoIds: selectedLogos().map((logo) => logo.id),
      selectedColorIds: selectedColors().map((color) => color.id),
      totalFiles: countExportFiles(selectedLogos(), selectedColors().length),
    };
  }
})();
