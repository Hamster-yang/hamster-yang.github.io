/* Attributed anatomical point clouds; decoded locally without runtime requests. */
(() => {
  'use strict';
  const host = document.querySelector('.wallpaper');
  let canvas = document.getElementById('vascular-canvas');
  const geometry = window.VascularGeometry;
  const menu = document.getElementById('wallpaper-menu');
  if (!host || !canvas || !geometry || !menu) return;

  const scenes = {
    cerebral: { index: '01 / 02', title: 'WHOLE BRAIN / SURFACE STUDY', label: '整體大腦模型 · 解剖圖譜', credit: 'BodyParts3D 4.0 · CC BY 4.0', legend: [['大腦模型', '#a1bdcc'], ['腦血管', '#d1664d']] },
    pulmonary: { index: '02 / 02', title: 'PULMONARY ARTERIES / VEINS', label: '肺部動靜脈分割', credit: 'BodyParts3D 4.0 · CC BY 4.0', legend: [['動脈', '#7fb5d4'], ['靜脈', '#d99388']] }
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const narrowScreen = window.matchMedia('(max-width: 760px)');
  const motionButton = document.getElementById('wallpaper-motion');
  const previewButton = document.getElementById('wallpaper-preview');
  const info = document.querySelector('.wallpaper-info');
  const readPreference = key => { try { return localStorage.getItem(`hy.wallpaper.${key}`); } catch { return null; } };
  const savePreference = (key, value) => { try { localStorage.setItem(`hy.wallpaper.${key}`, String(value)); } catch { /* Private/file browsing can deny storage. */ } };
  let sceneName = readPreference('scene');
  if (sceneName === 'aneurysm') sceneName = 'cerebral';
  if (!Object.hasOwn(scenes, sceneName)) sceneName = 'cerebral';
  let paused = reducedMotion.matches || readPreference('paused') === 'true';
  let preview = false;
  let disposed = false;
  let contextLost = false;
  let phase = 0;
  let frame = null;
  let lastPaint = null;
  let width = 1;
  let height = 1;
  let density = null;
  let points;
  let renderer;
  const cache = new Map();
  const inertBeforePreview = new Map();
  const pointer = { x: 0, y: 0 };
  const camera = { x: 0, y: 0 };

  function webGLRenderer(target) {
    const gl = target.getContext('webgl', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const shaders = [];
    const buffers = [];
    let program;
    function shader(type, source) {
      const result = gl.createShader(type);
      shaders.push(result);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Unable to compile wallpaper shader');
      return result;
    }
    try {
      const vertex = shader(gl.VERTEX_SHADER, `
        attribute vec3 aPosition;
        attribute vec3 aNormal;
        attribute vec3 aColor;
        attribute float aSize;
        uniform vec2 uAngles;
        uniform vec2 uScale;
        uniform float uDpr;
        uniform float uOpacity;
        uniform float uSurface;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float cy = cos(uAngles.x), sy = sin(uAngles.x);
          float cx = cos(uAngles.y), sx = sin(uAngles.y);
          vec3 p = vec3(cy*aPosition.x + sy*aPosition.z, aPosition.y, -sy*aPosition.x + cy*aPosition.z);
          p = vec3(p.x, cx*p.y - sx*p.z, sx*p.y + cx*p.z);
          float perspective = 3.8 / (3.8 - p.z);
          float depth = clamp((p.z + 1.2) / 2.4, 0.0, 1.0);
          float light = 1.0;
          float facing = 1.0;
          if (uSurface > 0.5 && dot(aNormal, aNormal) > 0.1) {
            vec3 n = vec3(cy*aNormal.x + sy*aNormal.z, aNormal.y, -sy*aNormal.x + cy*aNormal.z);
            n = normalize(vec3(n.x, cx*n.y - sx*n.z, sx*n.y + cx*n.z));
            facing = smoothstep(-0.08, 0.28, n.z);
            light = 0.25 + 0.75*max(dot(n, normalize(vec3(-0.4, 0.55, 1.0))), 0.0);
          } else if (uSurface > 0.5) {
            facing = 0.40;
          }
          gl_Position = vec4(p.xy * uScale * perspective + vec2(0.06, 0.02), 0.0, 1.0);
          gl_PointSize = max(1.25, aSize * uDpr * 1.4 * (0.8 + depth * 0.5));
          vColor = aColor * (0.85 + depth * 0.25) * light;
          vAlpha = uOpacity * (0.4 + depth * 0.6) * facing;
        }
      `);
      const fragment = shader(gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5));
          if (radius > 0.5) discard;
          float edge = 1.0 - smoothstep(0.18, 0.5, radius);
          gl_FragColor = vec4(vColor, vAlpha * edge);
        }
      `);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Unable to link wallpaper shader');
      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.clearColor(0, 0, 0, 0);
      const locations = {};
      for (const key of ['uAngles', 'uScale', 'uDpr', 'uOpacity', 'uSurface']) locations[key] = gl.getUniformLocation(program, key);
      function attribute(name, components, data, index) {
        let buffer = buffers[index];
        if (!buffer) { buffer = gl.createBuffer(); buffers[index] = buffer; }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
      }
      return {
        kind: 'webgl',
        setScene(data) {
          gl.useProgram(program);
          attribute('aPosition', 3, data.positions, 0);
          attribute('aColor', 3, data.colors, 1);
          attribute('aSize', 1, data.sizes, 2);
          attribute('aNormal', 3, data.normals, 3);
        },
        resize(pixelWidth, pixelHeight) { gl.viewport(0, 0, pixelWidth, pixelHeight); },
        draw(data, yaw, pitch, scale, dpr, opacity) {
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.useProgram(program);
          gl.uniform2f(locations.uAngles, yaw, pitch);
          gl.uniform2f(locations.uScale, scale * 2 / width, scale * 2 / height);
          gl.uniform1f(locations.uDpr, dpr);
          gl.uniform1f(locations.uOpacity, opacity);
          gl.uniform1f(locations.uSurface, sceneName === 'cerebral' ? 1 : 0);
          gl.drawArrays(gl.POINTS, 0, data.count);
        },
        dispose() { buffers.forEach(buffer => gl.deleteBuffer(buffer)); shaders.forEach(item => gl.deleteShader(item)); gl.deleteProgram(program); }
      };
    } catch {
      buffers.forEach(buffer => gl.deleteBuffer(buffer));
      shaders.forEach(item => gl.deleteShader(item));
      if (program) gl.deleteProgram(program);
      return null;
    }
  }

  function canvasRenderer(target) {
    const context = target.getContext('2d', { alpha: true });
    if (!context) return null;
    let colors = [];
    return {
      kind: 'canvas',
      setScene(data) {
        colors = Array.from({ length: data.count }, (_, i) => {
          const color = data.colors.subarray(i * 3, i * 3 + 3);
          return `rgb(${Math.round(color[0]*255)},${Math.round(color[1]*255)},${Math.round(color[2]*255)})`;
        });
      },
      resize() {},
      draw(data, yaw, pitch, scale, dpr, opacity) {
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch);
        for (let i = 0; i < data.count; i++) {
          const j = i * 3;
          const x = cy * data.positions[j] + sy * data.positions[j+2];
          const z = -sy * data.positions[j] + cy * data.positions[j+2];
          const y = cx * data.positions[j+1] - sx * z;
          const depth = sx * data.positions[j+1] + cx * z;
          const perspective = 3.8 / (3.8 - depth);
          let illumination = 1;
          if (sceneName === 'cerebral' && data.normals && Math.hypot(data.normals[j], data.normals[j+1], data.normals[j+2]) > .1) {
            const nx = cy*data.normals[j] + sy*data.normals[j+2];
            const nz0 = -sy*data.normals[j] + cy*data.normals[j+2];
            const ny = cx*data.normals[j+1] - sx*nz0;
            const nz = sx*data.normals[j+1] + cx*nz0;
            const magnitude = Math.hypot(nx, ny, nz) || 1;
            const facing = Math.max(0, Math.min(1, (nz/magnitude+.08)/.36));
            const light = .25+.75*Math.max(0, (-.4*nx+.55*ny+nz)/(magnitude*Math.hypot(.4,.55,1)));
            illumination = facing*facing*(3-2*facing)*light;
            if (illumination < .005) continue;
          } else if (sceneName === 'cerebral' && data.normals) {
            illumination = .40;
          }
          context.globalAlpha = opacity * Math.max(0.2, Math.min(1, (depth+1.2)/2.4)) * illumination;
          context.fillStyle = colors[i];
          context.beginPath();
          context.arc(width*.53 + x*scale*perspective, height*.49 - y*scale*perspective, Math.max(.55, data.sizes[i]*.75), 0, Math.PI*2);
          context.fill();
        }
        context.globalAlpha = 1;
      },
      dispose() {}
    };
  }

  function makeRenderer() {
    let result = webGLRenderer(canvas);
    if (result) return result;
    // Canvas contexts cannot change type after WebGL creation/compilation.
    const replacement = canvas.cloneNode(false);
    canvas.replaceWith(replacement);
    canvas = replacement;
    result = canvasRenderer(canvas);
    return result;
  }

  function updateLabels() {
    const scene = scenes[sceneName];
    document.getElementById('wallpaper-scene-index').textContent = scene.index;
    document.getElementById('wallpaper-scene-name').textContent = scene.title;
    const legend = document.getElementById('wallpaper-legend');
    legend.replaceChildren();
    if (scene.legend) {
      for (const [label, color] of scene.legend) {
        const span = document.createElement('span');
        const dot = document.createElement('i');
        dot.style.setProperty('--legend-color', color);
        span.append(dot, document.createTextNode(label));
        legend.append(span);
      }
    } else legend.textContent = scene.label;
    document.getElementById('wallpaper-render-status').textContent = scene.credit;
    menu.querySelectorAll('[data-wallpaper-scene]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.wallpaperScene === sceneName)));
    motionButton.textContent = paused ? '播放旋轉' : '暫停旋轉';
    previewButton.textContent = preview ? '返回工作桌面' : '只看桌布';
    previewButton.setAttribute('aria-pressed', String(preview));
  }

  function loadScene() {
    const nextDensity = renderer.kind === 'canvas' ? .1 : (narrowScreen.matches ? .3 : 1);
    const key = `${sceneName}:${nextDensity}`;
    if (!cache.has(key)) cache.set(key, geometry.createScene(sceneName, nextDensity));
    points = cache.get(key);
    density = nextDensity;
    renderer.setScene(points);
    updateLabels();
  }

  function paint() {
    if (disposed || contextLost || !renderer || !points) return;
    const dpr = Math.min(window.devicePixelRatio || 1, narrowScreen.matches ? 1.25 : 1.5);
    const scale = Math.min(width*.4, height*.45);
    const initialYaw = sceneName === 'cerebral' ? -.5 : 0;
    renderer.draw(points, initialYaw + phase*.075 + camera.x, -.12 + Math.sin(phase*.12)*.05 + camera.y, scale, dpr, preview ? 1 : .6);
  }

  function resize() {
    if (disposed || contextLost || !renderer) return;
    const bounds = host.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    const dpr = Math.min(window.devicePixelRatio || 1, narrowScreen.matches ? 1.25 : 1.5);
    canvas.width = Math.round(width*dpr);
    canvas.height = Math.round(height*dpr);
    renderer.resize(canvas.width, canvas.height);
    const nextDensity = renderer.kind === 'canvas' ? .1 : (narrowScreen.matches ? .3 : 1);
    if (density !== nextDensity) loadScene();
    paint();
  }

  function tick(timestamp) {
    frame = null;
    if (disposed || contextLost || paused || document.hidden) return;
    const interval = narrowScreen.matches ? 1000/20 : 1000/30;
    if (lastPaint === null || timestamp-lastPaint >= interval) {
      if (lastPaint !== null) phase += Math.min((timestamp-lastPaint)/1000, .1);
      lastPaint = timestamp;
      camera.x += (pointer.x-camera.x)*.04;
      camera.y += (pointer.y-camera.y)*.04;
      paint();
    }
    frame = requestAnimationFrame(tick);
  }

  function reconcileAnimation() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastPaint = null;
    paint();
    if (!paused && !document.hidden && !disposed && !contextLost) frame = requestAnimationFrame(tick);
  }

  function setPreview(active) {
    preview = active;
    document.documentElement.classList.toggle('wallpaper-preview', preview);
    document.querySelectorAll('.app-window, .desktop-shortcuts').forEach(node => {
      if (preview) { if (!inertBeforePreview.has(node)) inertBeforePreview.set(node, node.inert); node.inert = true; }
      else { node.inert = inertBeforePreview.get(node) || false; }
    });
    if (!preview) inertBeforePreview.clear();
    updateLabels();
    paint();
  }

  try {
    renderer = makeRenderer();
    if (!renderer) return;
    resize();
  } catch {
    renderer?.dispose();
    return;
  }
  host.classList.add('is-rendered');
  menu.hidden = false;
  info.hidden = false;
  canvas.dataset.renderer = renderer.kind;

  menu.addEventListener('toggle', () => {
    if (menu.open) document.querySelector('.window-menu').open = false;
  });

  for (const button of menu.querySelectorAll('[data-wallpaper-scene]')) {
    button.addEventListener('click', () => {
      const requested = button.dataset.wallpaperScene === 'aneurysm' ? 'cerebral' : button.dataset.wallpaperScene;
      if (!Object.hasOwn(scenes, requested)) return;
      sceneName = requested;
      phase = 0;
      loadScene();
      savePreference('scene', sceneName);
      paint();
      menu.open = false;
      menu.querySelector('summary').focus({ preventScroll: true });
    });
  }
  motionButton.addEventListener('click', () => {
    paused = !paused;
    savePreference('paused', paused);
    updateLabels();
    reconcileAnimation();
  });
  previewButton.addEventListener('click', () => {
    setPreview(!preview);
    menu.open = false;
    menu.querySelector('summary').focus({ preventScroll: true });
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const restoreFocus = menu.open && menu.contains(document.activeElement);
      menu.open = false;
      if (preview) setPreview(false);
      if (restoreFocus) menu.querySelector('summary').focus();
    }
  });
  document.querySelector('.desktop').addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || paused) return;
    pointer.x = (event.clientX/width-.5)*.14;
    pointer.y = (event.clientY/height-.5)*.07;
  }, { passive: true });
  document.querySelector('.desktop').addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });
  document.addEventListener('desktop:window-open', () => { if (preview) setPreview(false); });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) paused = true;
    updateLabels();
    reconcileAnimation();
  });
  document.addEventListener('visibilitychange', reconcileAnimation);
  window.addEventListener('pageshow', reconcileAnimation);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(host);
  window.addEventListener('resize', resize);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    host.classList.remove('is-rendered');
    info.hidden = true;
    reconcileAnimation();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    if (disposed) return;
    renderer?.dispose();
    try { renderer = makeRenderer(); } catch { renderer = null; }
    contextLost = !renderer;
    if (!renderer) {
      host.classList.remove('is-rendered');
      if (preview) setPreview(false);
      menu.open = false;
      menu.hidden = info.hidden = true;
      canvas.dataset.renderer = 'none';
      observer?.disconnect();
      return;
    }
    canvas.dataset.renderer = renderer.kind;
    density = null;
    resize();
    host.classList.add('is-rendered');
    info.hidden = false;
    reconcileAnimation();
  });
  window.addEventListener('pagehide', event => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (event.persisted) return;
    disposed = true;
    observer?.disconnect();
    renderer?.dispose();
  });
  reconcileAnimation();
})();
