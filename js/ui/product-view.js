"use strict";

(function (shop) {
  const initialYaw = -0.4;
  const initialPitch = 0.16;
  const modelCache = new Map();
  const views = new WeakMap();

  function prepareFace({ points, color }) {
    const [nx, ny, nz] = points.reduce(([x, y, z], current, index) => {
      const next = points[(index + 1) % points.length];
      return [
        x + (current[1] - next[1]) * (current[2] + next[2]),
        y + (current[2] - next[2]) * (current[0] + next[0]),
        z + (current[0] - next[0]) * (current[1] + next[1])
      ];
    }, [0, 0, 0]);
    const length = Math.hypot(nx, ny, nz);
    const rgb = Number.parseInt(color.slice(1), 16);
    return {
      points,
      normal: length ? [nx / length, ny / length, nz / length] : [0, 0, 0],
      rgb: [rgb >> 16, (rgb >> 8) & 255, rgb & 255]
    };
  }

  function draw(view) {
    const { stage, canvas, ctx } = view;
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return;

    const density = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * density);
    const pixelHeight = Math.round(height * density);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    ctx.setTransform(density, 0, 0, density, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width * 0.44, height * 0.36);
    const originX = width * 0.5;
    const originY = height * 0.485;

    ctx.save();
    ctx.translate(originX, originY + scale * 0.99);
    ctx.scale(scale * 0.92, scale * 0.19);
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    shadow.addColorStop(0, "rgba(48,34,25,0.26)");
    shadow.addColorStop(1, "rgba(48,34,25,0)");
    ctx.fillStyle = shadow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();

    const cy = Math.cos(view.yaw);
    const sy = Math.sin(view.yaw);
    const cp = Math.cos(view.pitch);
    const sp = Math.sin(view.pitch);
    function rotate([x, y, z]) {
      const depth = z * cy - x * sy;
      return [x * cy + z * sy, y * cp - depth * sp, y * sp + depth * cp];
    }

    const faces = [];
    const projections = new Map();
    for (const face of view.faces) {
      const [nx, ny, nz] = rotate(face.normal);
      if (nz < -0.1) continue;
      const points = face.points.map((vertex) => {
        if (!projections.has(vertex)) {
          const [x, y, z] = rotate(vertex);
          const perspective = 4.8 / (4.8 - z);
          projections.set(vertex, [originX + x * scale * perspective, originY - y * scale * perspective, z]);
        }
        return projections.get(vertex);
      });
      const depth = points.reduce((sum, point) => sum + point[2], 0) / points.length;
      const diffuse = Math.max(0, nx * -0.47 + ny * 0.55 + nz * 0.69);
      const shine = Math.max(0, nx * -0.26 + ny * 0.3 + nz * 0.92) ** 12 * 28;
      const rgb = face.rgb.map((component) => Math.min(255, Math.round(component * (0.53 + 0.59 * diffuse) + shine)));
      faces.push({ points, depth, fill: `rgb(${rgb.join(",")})` });
    }

    faces.sort((a, b) => a.depth - b.depth);
    ctx.lineJoin = "round";
    ctx.lineWidth = 0.55;
    for (const { points, fill } of faces) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.strokeStyle = fill;
      ctx.fill();
      ctx.stroke();
    }
    stage.dataset.modelReady = "true";
  }

  function requestDraw(view) {
    if (view.frame) return;
    view.frame = window.requestAnimationFrame(() => {
      view.frame = 0;
      draw(view);
    });
  }

  const resize = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
    for (const { target } of entries) requestDraw(views.get(target));
  }) : null;

  function activate(view) {
    const { stage, id, name } = view;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!modelCache.has(id)) modelCache.set(id, shop.productModels[id]().map(prepareFace));
    Object.assign(view, { canvas, ctx, faces: modelCache.get(id), yaw: initialYaw, pitch: initialPitch, frame: 0 });
    canvas.className = "model-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `${name}. 3D-модель. Вращайте стрелками, Home возвращает исходный ракурс.`);
    stage.prepend(canvas);

    let drag = null;
    canvas.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      drag = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!drag || !canvas.hasPointerCapture(event.pointerId)) return;
      view.yaw = (view.yaw + (event.clientX - drag.x) * 0.012) % (2 * Math.PI);
      view.pitch = Math.max(-1.1, Math.min(1.1, view.pitch + (event.clientY - drag.y) * 0.01));
      drag = { x: event.clientX, y: event.clientY };
      requestDraw(view);
    });
    canvas.addEventListener("lostpointercapture", () => {
      drag = null;
    });
    canvas.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowLeft": view.yaw -= 0.16; break;
        case "ArrowRight": view.yaw += 0.16; break;
        case "ArrowUp": view.pitch = Math.max(-1.1, view.pitch - 0.13); break;
        case "ArrowDown": view.pitch = Math.min(1.1, view.pitch + 0.13); break;
        case "Home": view.yaw = initialYaw; view.pitch = initialPitch; break;
        default: return;
      }
      event.preventDefault();
      requestDraw(view);
    });

    if (resize) resize.observe(stage);
    else window.addEventListener("resize", () => requestDraw(view));
    requestDraw(view);
  }

  const visible = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      visible.unobserve(entry.target);
      activate(views.get(entry.target));
    }
  }, { rootMargin: "180px" }) : null;

  function mount(stage, id, name) {
    if (!stage || !Object.hasOwn(shop.productModels, id) || views.has(stage)) return;
    const view = { stage, id, name };
    views.set(stage, view);
    if (visible) visible.observe(stage);
    else activate(view);
  }

  shop.productView = { mount };
  const hero = document.querySelector("[data-hero-model]");
  if (hero) mount(hero, hero.dataset.heroModel, hero.dataset.modelName);
})(window.Shop);
