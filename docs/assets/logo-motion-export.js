(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const LOGO_VIEWBOX = { width: 826, height: 619 };
  const THEMES = [
    { label: "青蓝", key: "cyan", colors: ["#22C6C5", "#1DA4AB", "#6DD5DE"] },
    { label: "竹叶", key: "acid", colors: ["#D9F01A", "#BCC94E", "#E2F072"] },
    { label: "赤练", key: "rose", colors: ["#F1265F", "#C41F4D", "#F26089"] },
  ];

  const PATH_DEFS = [
    { kind: "path", data: "M419.44 36 L790.87 582.54 L36 582.54 Z", delay: 40, role: "frame" },
    { kind: "path", data: "M378.15 188.94 L305.61 258.94 L362.03 258.94 L292.26 335.52", delay: 180 },
    { kind: "line", data: [382.03, 258.94, 433.03, 258.94], delay: 250 },
    { kind: "path", data: "M422.44 188.94 L382.03 258.94 L422.44 328.94", delay: 310 },
    { kind: "line", data: [478.3, 258.94, 521.05, 258.94], delay: 360 },
    { kind: "path", data: "M462.78 328.94 L485.03 188.94", delay: 410 },
    { kind: "path", data: "M485.03 188.94 L565.86 328.94", delay: 470 },
    { kind: "path", data: "M285.26 365.94 L192.15 441.94 L247.03 441.94 L155.44 518.94", delay: 700 },
    { kind: "path", data: "M232.03 517.94 L319.79 365.94 L292.79 517.94 L380.54 365.94", delay: 760 },
    { kind: "line", data: [376.35, 441.94, 453.7, 441.94], delay: 820 },
    { kind: "path", data: "M327.27 517.94 L415.03 365.94 L502.79 517.94", delay: 880 },
    { kind: "path", data: "M491.91 441.94 L535.79 365.94", delay: 940 },
    { kind: "path", data: "M491.91 441.94 L601.54 517.94", delay: 1000 },
    { kind: "path", data: "M448.03 365.94 L535.79 517.94", delay: 1060 },
    { kind: "line", data: [543.34, 441.94, 631.1, 441.94], delay: 1120 },
    { kind: "path", data: "M587.22 365.94 L543.34 441.94 L672.98 518.94", delay: 1180 },
  ];

  const elements = {
    resolution: document.getElementById("motion-resolution"),
    fps: document.getElementById("motion-fps"),
    manualButton: document.getElementById("export-manual-motion"),
    viButton: document.getElementById("export-vi-motion"),
    overlay: document.getElementById("export-overlay"),
    progressTitle: document.getElementById("progress-title"),
    progressDetail: document.getElementById("progress-detail"),
    progressBar: document.getElementById("progress-bar"),
    toastRegion: document.getElementById("toast-region"),
  };

  if (!elements.manualButton || !elements.viButton) return;

  const sampledPaths = sampleLogoPaths();
  let busy = false;

  elements.manualButton.addEventListener("click", () => exportMotion("manual"));
  elements.viButton.addEventListener("click", () => exportMotion("vi"));

  window.SEASNAKE_MOTION_EXPORT = {
    exportManual: () => exportMotion("manual"),
    exportVi: () => exportMotion("vi"),
    getCapabilities: () => ({
      captureStream: typeof HTMLCanvasElement.prototype.captureStream === "function",
      mediaRecorder: typeof window.MediaRecorder === "function",
      encoding: preferredEncoding(),
    }),
  };

  async function exportMotion(preset) {
    if (busy) {
      showToast("已有动画正在录制，请稍候。", "error");
      return null;
    }

    const studioState = window.SEASNAKE_EXPORT_STUDIO?.getState?.();
    if (studioState?.exporting) {
      showToast("静态 Logo 套装仍在生成，请完成后再录制动画。", "error");
      return null;
    }

    if (typeof HTMLCanvasElement.prototype.captureStream !== "function" || typeof window.MediaRecorder !== "function") {
      showToast("当前浏览器不支持本地视频录制，请使用最新版 Chrome、Edge 或 Safari。", "error", 7000);
      return null;
    }

    const encoding = preferredEncoding();
    if (!encoding) {
      showToast("当前浏览器没有可用的视频编码器，请使用最新版 Chrome。", "error", 7000);
      return null;
    }

    const [width, height] = elements.resolution.value.split("x").map(Number);
    const fps = Number(elements.fps.value);
    const duration = preset === "manual" ? 2.44 : 8;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    let previewFrame = null;

    busy = true;
    setButtonsDisabled(true);
    showProgress(true, "准备动画录制…", `${width} × ${height} · ${fps} FPS`, 2);

    try {
      if (preset === "vi") {
        showProgress(true, "载入动态 VI 背景…", "复用原页面的 WebGL 渲染器", 4);
        previewFrame = await createPreviewFrame(width, height);
      }

      const renderFrame = preset === "manual"
        ? (seconds) => renderManualFrame(context, width, height, seconds)
        : (seconds) => renderViFrame(context, width, height, seconds, previewFrame.api);

      renderFrame(0);
      const blob = await recordCanvas({
        canvas,
        fps,
        duration,
        encoding,
        renderFrame,
        onProgress: (progress) => {
          const percent = 6 + progress * 90;
          const elapsed = (progress * duration).toFixed(1);
          showProgress(
            true,
            preset === "manual" ? "正在录制 MANUAL 入场…" : "正在录制动态 VI 预览…",
            `${elapsed} / ${duration.toFixed(1)} 秒 · 请保持本页可见`,
            percent,
          );
        },
      });

      showProgress(true, "视频已生成", `${formatBytes(blob.size)} · 正在下载`, 100);
      const stamp = dateStamp();
      const name = preset === "manual" ? "manual-arrival" : "vi-dynamic-preview";
      const filename = `seasnake-${name}-${width}x${height}-${fps}fps-${stamp}.${encoding.extension}`;
      downloadBlob(blob, filename);
      await delay(320);
      showToast(`已导出 ${filename}`);
      return { blob, filename, width, height, fps, duration, mimeType: encoding.mimeType };
    } catch (error) {
      console.error(error);
      showToast(error?.message || "动画导出失败，请重试。", "error", 8000);
      return null;
    } finally {
      previewFrame?.destroy();
      busy = false;
      setButtonsDisabled(false);
      showProgress(false);
    }
  }

  function preferredEncoding() {
    if (typeof window.MediaRecorder !== "function") return null;
    const candidates = [
      { mimeType: "video/webm;codecs=vp9", extension: "webm" },
      { mimeType: "video/webm;codecs=vp8", extension: "webm" },
      { mimeType: "video/webm", extension: "webm" },
      { mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4" },
      { mimeType: "video/mp4", extension: "mp4" },
    ];
    return candidates.find(({ mimeType }) => MediaRecorder.isTypeSupported(mimeType)) || null;
  }

  async function recordCanvas({ canvas, fps, duration, encoding, renderFrame, onProgress }) {
    const stream = canvas.captureStream(fps);
    const bitrate = Math.max(6_000_000, Math.min(28_000_000, Math.round(canvas.width * canvas.height * fps * 0.12)));
    const recorder = new MediaRecorder(stream, {
      mimeType: encoding.mimeType,
      videoBitsPerSecond: bitrate,
    });
    const chunks = [];
    let animationFrame = 0;
    let settled = false;

    const finished = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      recorder.addEventListener("error", (event) => reject(event.error || new Error("视频编码失败")), { once: true });
      recorder.addEventListener("stop", () => {
        if (settled) return;
        settled = true;
        if (!chunks.length) {
          reject(new Error("浏览器没有生成视频数据，请重试。"));
          return;
        }
        resolve(new Blob(chunks, { type: encoding.mimeType }));
      }, { once: true });
    });

    recorder.start(250);
    const startedAt = performance.now();

    await new Promise((resolve, reject) => {
      const draw = (now) => {
        try {
          const elapsed = Math.min(duration, Math.max(0, (now - startedAt) / 1000));
          renderFrame(elapsed);
          onProgress(elapsed / duration);
          if (elapsed >= duration) {
            resolve();
            return;
          }
          animationFrame = requestAnimationFrame(draw);
        } catch (error) {
          reject(error);
        }
      };
      animationFrame = requestAnimationFrame(draw);
    });

    await delay(140);
    recorder.requestData();
    await delay(40);
    recorder.stop();
    cancelAnimationFrame(animationFrame);
    const blob = await finished;
    stream.getTracks().forEach((track) => track.stop());
    return blob;
  }

  async function createPreviewFrame(width, height) {
    const frame = document.createElement("iframe");
    frame.title = "动态 VI 导出渲染器";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = [
      "position:fixed",
      `left:-${width + 160}px`,
      "top:0",
      `width:${width}px`,
      `height:${height}px`,
      "border:0",
      "opacity:0.001",
      "pointer-events:none",
      "z-index:-100",
    ].join(";");
    frame.src = "seasnake-logo-preview.html?export=1&from=studio";
    document.body.append(frame);

    await Promise.race([
      new Promise((resolve, reject) => {
        frame.addEventListener("load", resolve, { once: true });
        frame.addEventListener("error", () => reject(new Error("动态预览页面载入失败。")), { once: true });
      }),
      delay(15000).then(() => { throw new Error("动态预览页面载入超时，请刷新后重试。"); }),
    ]);

    let api = null;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      api = frame.contentWindow?.SEASNAKE_PREVIEW_EXPORT;
      if (api?.ready && api.canvas) break;
      await delay(50);
    }
    if (!api?.ready || !api.canvas) {
      frame.remove();
      throw new Error("动态 VI 渲染器没有准备好，请刷新后重试。");
    }
    api.renderFrame(0, 0);
    return { api, destroy: () => frame.remove() };
  }

  function renderManualFrame(context, width, height, seconds) {
    const milliseconds = seconds * 1000;
    const duration = 2440;
    const fadeStart = duration * 0.88;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#050707";
    context.fillRect(0, 0, width, height);

    const accent = activeAccent();
    const centerX = width * 0.5;
    const centerY = height * 0.48;
    const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.56);
    glow.addColorStop(0, rgba(accent, 0.13));
    glow.addColorStop(0.36, rgba(accent, 0.045));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    drawManualBeam(context, width, height, seconds, accent);
    const fadeOut = 1 - arrivalEase(clamp((milliseconds - fadeStart) / (duration - fadeStart), 0, 1));
    drawLogo(context, width, height, {
      progressForPath: (path) => arrivalEase(clamp((milliseconds - path.delay) / 860, 0, 1)),
      color: mixHex("#FBFBF5", accent, 0.16),
      glowColor: accent,
      opacity: fadeOut,
      scaleFactor: 0.68,
    });

    const labelProgress = cssEase(clamp((milliseconds - 430) / 560, 0, 1));
    context.save();
    context.globalAlpha = labelProgress * fadeOut * 0.82;
    context.fillStyle = "#FBFBF5";
    context.textAlign = "center";
    context.font = `800 ${Math.max(11, Math.round(height * 0.016))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.letterSpacing = `${Math.max(2, height * 0.004)}px`;
    context.fillText("SEASNAKE  ·  BRAND MANUAL", centerX, height * 0.91);
    context.restore();

    if (milliseconds > fadeStart) {
      context.fillStyle = `rgba(5,7,7,${1 - fadeOut})`;
      context.fillRect(0, 0, width, height);
    }
  }

  function renderViFrame(context, width, height, seconds, previewApi) {
    const duration = 8;
    const themeProgress = smoothThemeProgress(seconds / duration);
    const backgroundPhase = Math.min(themeProgress, 0.9995);
    previewApi.renderFrame(themeProgress, seconds, backgroundPhase);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.drawImage(previewApi.canvas, 0, 0, width, height);

    const vignette = context.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.68);
    vignette.addColorStop(0, "rgba(0,0,0,0.05)");
    vignette.addColorStop(0.62, "rgba(0,0,0,0.20)");
    vignette.addColorStop(1, "rgba(0,0,0,0.64)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, width, height);

    const palette = paletteAt(themeProgress);
    const accent = palette[0];
    const logoColor = mixHex("#FFFFFF", palette[2], 0.48);
    const entrance = easeOutCubic(clamp(seconds / 1.55, 0, 1));
    drawRays(context, width, height, seconds, accent, entrance);
    drawLogo(context, width, height, {
      progressForPath: (path) => easeOutCubic(clamp((seconds * 1000 - path.delay * 0.34) / 980, 0, 1)),
      color: logoColor,
      glowColor: accent,
      opacity: 0.98,
      scaleFactor: 0.76 + Math.sin(seconds * 0.72) * 0.008,
    });
    drawEdgeRunner(context, width, height, seconds, mixHex("#FFFFFF", accent, 0.58));
    drawViCaption(context, width, height, themeProgress, palette);

    const startFade = 1 - easeOutCubic(clamp(seconds / 0.28, 0, 1));
    const endFade = easeInOutCubic(clamp((seconds - 7.62) / 0.38, 0, 1));
    const fade = Math.max(startFade, endFade);
    if (fade > 0) {
      context.fillStyle = `rgba(2,4,4,${fade})`;
      context.fillRect(0, 0, width, height);
    }
  }

  function drawLogo(context, width, height, options) {
    const scale = Math.min((width * options.scaleFactor) / LOGO_VIEWBOX.width, (height * 0.78) / LOGO_VIEWBOX.height);
    const offsetX = (width - LOGO_VIEWBOX.width * scale) / 2;
    const offsetY = (height - LOGO_VIEWBOX.height * scale) / 2 - height * 0.01;

    context.save();
    context.translate(offsetX, offsetY);
    context.scale(scale, scale);
    context.globalAlpha = options.opacity;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = options.color;
    context.lineWidth = 8.75;
    context.shadowColor = options.glowColor;
    context.shadowBlur = 18 / Math.max(scale, 0.5);
    sampledPaths.forEach((path) => drawPartialPolyline(context, path.points, options.progressForPath(path)));
    context.restore();
  }

  function drawEdgeRunner(context, width, height, seconds, color) {
    const frame = sampledPaths[0];
    const scale = Math.min((width * (0.76 + Math.sin(seconds * 0.72) * 0.008)) / LOGO_VIEWBOX.width, (height * 0.78) / LOGO_VIEWBOX.height);
    const offsetX = (width - LOGO_VIEWBOX.width * scale) / 2;
    const offsetY = (height - LOGO_VIEWBOX.height * scale) / 2 - height * 0.01;
    const start = (seconds * 0.19) % 1;
    context.save();
    context.translate(offsetX, offsetY);
    context.scale(scale, scale);
    context.strokeStyle = color;
    context.lineWidth = 13;
    context.lineCap = "round";
    context.shadowColor = color;
    context.shadowBlur = 28 / Math.max(scale, 0.5);
    drawPolylineWindow(context, frame.points, start, 0.095);
    context.restore();
  }

  function drawRays(context, width, height, seconds, accent, entrance) {
    const centerX = width * 0.5;
    const centerY = height * 0.43;
    const radius = Math.min(width, height) * 0.55;
    context.save();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    for (let index = 0; index < 9; index += 1) {
      const angle = -Math.PI * 0.88 + index * (Math.PI * 1.76 / 8) + Math.sin(seconds * 0.6 + index) * 0.025;
      const inner = radius * (0.38 + (index % 2) * 0.055);
      const length = radius * (0.30 + (index % 3) * 0.055) * entrance;
      context.beginPath();
      context.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
      context.lineTo(centerX + Math.cos(angle) * (inner + length), centerY + Math.sin(angle) * (inner + length));
      context.strokeStyle = rgba(accent, 0.09 + (index % 3) * 0.025);
      context.lineWidth = Math.max(1, height * 0.0017);
      context.stroke();
    }
    context.restore();
  }

  function drawManualBeam(context, width, height, seconds, accent) {
    const angle = seconds * 0.78 - 1.2;
    const x = width * (0.5 + Math.cos(angle) * 0.08);
    const y = height * (0.46 + Math.sin(angle) * 0.06);
    const gradient = context.createLinearGradient(x - width * 0.42, y - height * 0.38, x + width * 0.42, y + height * 0.38);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.47, "rgba(0,0,0,0)");
    gradient.addColorStop(0.5, rgba(accent, 0.10));
    gradient.addColorStop(0.53, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  function drawViCaption(context, width, height, progress, palette) {
    const active = THEMES[Math.min(THEMES.length - 1, Math.floor(clamp(progress, 0, 0.999) * THEMES.length))];
    const margin = Math.max(24, width * 0.035);
    context.save();
    context.textAlign = "left";
    context.fillStyle = mixHex("#FFFFFF", palette[2], 0.42);
    context.font = `900 ${Math.max(13, Math.round(height * 0.019))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.fillText(`SEASNAKE / ${active.label}`, margin, height - margin * 1.15);
    context.fillStyle = "rgba(255,255,255,0.52)";
    context.font = `700 ${Math.max(9, Math.round(height * 0.0105))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.fillText("CYAN  →  ACID  →  ROSE", margin, height - margin * 0.64);
    context.restore();
  }

  function sampleLogoPaths() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`);
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    document.body.append(svg);

    const result = PATH_DEFS.map((definition) => {
      const shape = document.createElementNS(SVG_NS, definition.kind);
      if (definition.kind === "path") {
        shape.setAttribute("d", definition.data);
      } else {
        const [x1, y1, x2, y2] = definition.data;
        shape.setAttribute("x1", x1);
        shape.setAttribute("y1", y1);
        shape.setAttribute("x2", x2);
        shape.setAttribute("y2", y2);
      }
      svg.append(shape);
      const length = shape.getTotalLength();
      const count = Math.max(2, Math.ceil(length / 2.2));
      const points = Array.from({ length: count + 1 }, (_, index) => {
        const point = shape.getPointAtLength(length * index / count);
        return { x: point.x, y: point.y };
      });
      return { ...definition, length, points };
    });
    svg.remove();
    return result;
  }

  function drawPartialPolyline(context, points, amount) {
    const clamped = clamp(amount, 0, 1);
    if (clamped <= 0 || points.length < 2) return;
    const endFloat = clamped * (points.length - 1);
    const endIndex = Math.min(points.length - 1, Math.floor(endFloat));
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index <= endIndex; index += 1) context.lineTo(points[index].x, points[index].y);
    if (endIndex < points.length - 1) {
      const local = endFloat - endIndex;
      context.lineTo(
        mixNumber(points[endIndex].x, points[endIndex + 1].x, local),
        mixNumber(points[endIndex].y, points[endIndex + 1].y, local),
      );
    }
    context.stroke();
  }

  function drawPolylineWindow(context, points, start, size) {
    const startIndex = Math.floor(start * (points.length - 1));
    const count = Math.max(2, Math.floor(size * (points.length - 1)));
    context.beginPath();
    for (let index = 0; index <= count; index += 1) {
      const point = points[(startIndex + index) % points.length];
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.stroke();
  }

  function smoothThemeProgress(raw) {
    const progress = clamp(raw, 0, 1);
    if (progress < 0.18) return 0;
    if (progress < 0.42) return easeInOutCubic((progress - 0.18) / 0.24) * 0.5;
    if (progress < 0.58) return 0.5;
    if (progress < 0.84) return 0.5 + easeInOutCubic((progress - 0.58) / 0.26) * 0.5;
    return 1;
  }

  function paletteAt(progress) {
    const scaled = clamp(progress, 0, 1) * (THEMES.length - 1);
    const index = Math.min(THEMES.length - 2, Math.floor(scaled));
    const amount = scaled - index;
    return THEMES[index].colors.map((color, colorIndex) => mixHex(color, THEMES[index + 1].colors[colorIndex], amount));
  }

  function activeAccent() {
    const state = window.SEASNAKE_EXPORT_STUDIO?.getState?.();
    const active = state?.colors?.find((color) => color.id === state.activeColorId);
    return active?.hex || "#D9F01A";
  }

  function hexToRgb(hex) {
    const value = String(hex).replace("#", "");
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
    };
  }

  function mixHex(left, right, amount) {
    const a = hexToRgb(left);
    const b = hexToRgb(right);
    const mixed = [a.r, a.g, a.b].map((channel, index) => {
      const target = [b.r, b.g, b.b][index];
      return Math.round(mixNumber(channel, target, clamp(amount, 0, 1))).toString(16).padStart(2, "0");
    });
    return `#${mixed.join("")}`;
  }

  function rgba(hex, alpha) {
    const color = hexToRgb(hex);
    return `rgba(${color.r},${color.g},${color.b},${alpha})`;
  }

  function showProgress(visible, title = "", detail = "", percent = 0) {
    elements.overlay.hidden = !visible;
    if (!visible) return;
    elements.progressTitle.textContent = title;
    elements.progressDetail.textContent = detail;
    elements.progressBar.style.width = `${clamp(percent, 0, 100)}%`;
  }

  function showToast(message, type = "info", duration = 4600) {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " error" : ""}`;
    toast.textContent = message;
    elements.toastRegion.append(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function setButtonsDisabled(disabled) {
    elements.manualButton.disabled = disabled;
    elements.viButton.disabled = disabled;
    elements.resolution.disabled = disabled;
    elements.fps.disabled = disabled;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function dateStamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function mixNumber(a, b, amount) {
    return a + (b - a) * amount;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function easeOutCubic(value) {
    return 1 - (1 - value) ** 3;
  }

  function easeInOutCubic(value) {
    return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
  }

  function arrivalEase(value) {
    return cubicBezier(value, 0.18, 0.82, 0.2, 1);
  }

  function cssEase(value) {
    return cubicBezier(value, 0.25, 0.1, 0.25, 1);
  }

  function cubicBezier(value, x1, y1, x2, y2) {
    const target = clamp(value, 0, 1);
    let lower = 0;
    let upper = 1;
    let parameter = target;
    for (let index = 0; index < 14; index += 1) {
      const x = bezierCoordinate(parameter, x1, x2);
      if (Math.abs(x - target) < 0.00001) break;
      if (x < target) lower = parameter;
      else upper = parameter;
      parameter = (lower + upper) / 2;
    }
    return bezierCoordinate(parameter, y1, y2);
  }

  function bezierCoordinate(parameter, control1, control2) {
    const inverse = 1 - parameter;
    return 3 * inverse * inverse * parameter * control1
      + 3 * inverse * parameter * parameter * control2
      + parameter * parameter * parameter;
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
})();
