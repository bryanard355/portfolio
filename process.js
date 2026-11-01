// ===== Process: scroll-driven 3D story =====
// One pinned section, scrubbed by the scrollbar: a dotted globe → "two sides" → a dive into the globe →
// a blueprint grid where a wireframe server rack and laptop assemble → back out to the globe.
// Scrolling down plays it forward and scrolling up plays it in reverse, every time.
// Three.js (vendor/three.min.js), GSAP + ScrollTrigger (vendor/) and the land map (process-land.js) are plain
// scripts loaded just before this one, so it also works when index.html is opened straight from disk.
// The words are real HTML in index.html (#process). Without JS, WebGL or with reduced motion the
// section stays a plain stacked list (plus one still frame when WebGL works).
// Wrapped in its own scope so its names can't clash with script.js.
(() => {
  const { THREE, PROCESS_LAND } = window;
  const section = document.getElementById('process');
  const stage = section && section.querySelector('.process-stage');
  const canvas = section && section.querySelector('.process-canvas');
  if (!THREE || !PROCESS_LAND || !stage || !canvas) return; // keep the plain list

  // ===== Settings: edit these =====
  const SCROLL_LENGTH = 600;  // story length in % of the screen height (600 = six screens of scrolling)
  const SCRUB = 0.8;          // seconds the story takes to catch up with the scrollbar (0 = glued to it)
  const PHONE = window.matchMedia('(max-width: 720px)').matches;
  const GLOBE_POINTS = PHONE ? 16000 : 36000; // dots spread over the globe before the ocean is thinned out
  const OCEAN_KEEP = 0.16;    // share of ocean dots kept (every land dot is kept)
  // Progress bar stages (Plan, Build, Test, Ship): each fills its blocks until `end` and its button jumps
  // to `at` (both 0–1 through the story). The stage texts are the four .p-step items in index.html.
  const STAGES = [
    { end: 0.53, at: 0.48 },
    { end: 0.63, at: 0.58 },
    { end: 0.73, at: 0.68 },
    { end: 1, at: 0.79 },
  ];
  // 3D colours come from the theme variables in style.css (:root), so the scene always matches the page
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const COLOR = { bg: cssVar('--bg'), dots: cssVar('--fg'), accent: cssVar('--accent'), soft: cssVar('--fg') };

  const motionToggle = document.getElementById('motion-toggle'); // script.js sets aria-pressed="false" while paused
  const clamp01 = (n) => Math.min(Math.max(n, 0), 1);
  const backOut = (t) => 1 + 2.6 * (t - 1) ** 3 + 1.6 * (t - 1) ** 2; // overshoots a touch, then snaps in place
  const square = (x, y, z, s) => [
    [x - s, y - s, z, x + s, y - s, z], [x + s, y - s, z, x + s, y + s, z],
    [x + s, y + s, z, x - s, y + s, z], [x - s, y + s, z, x - s, y - s, z],
  ];

  // Everything the scroll timeline animates; render() turns it into the 3D scene
  const S = {
    gx: PHONE ? 0 : 1.05, gy: 0, gs: 1, // globe position and scale
    cy: 0, cz: 4.4, ly: PHONE ? 0.6 : 0, // globe camera height, distance and look-at height (phones: globe sits lower, under the text)
    spin: 0,                            // extra globe rotation driven by the scroll
    globe: 1,                           // globe visibility
    grid: 0,                            // blueprint grid + wireframe visibility
    build: 0,                           // how far the wireframe has assembled (0–1)
    orbit: -0.8, lift: 0, dist: 0,      // wireframe camera: angle around it, extra height, extra distance
  };
  let time = 0; // seconds of idle motion; stands still while "Pause motion" is on

  function radialTexture(stops) { // white radial gradient, used for round dots and the halo
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [at, alpha] of stops) grad.addColorStop(at, `rgba(255,255,255,${alpha})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  // ===== Globe: dots on a sphere (bright on land, sparse and faint on the ocean) with a glowing rim =====
  function makeGlobe() {
    const { width: LAND_W, height: LAND_H } = PROCESS_LAND;
    const bits = Uint8Array.from(atob(PROCESS_LAND.bits), (c) => c.charCodeAt(0));
    const isLand = (lat, lon) => {
      const x = Math.min(LAND_W - 1, Math.floor(((lon + Math.PI) / (Math.PI * 2)) * LAND_W));
      const y = Math.min(LAND_H - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * LAND_H));
      const i = y * LAND_W + x;
      return (bits[i >> 3] >> (7 - (i & 7))) & 1;
    };
    const pos = [], col = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < GLOBE_POINTS; i++) { // Fibonacci sphere: evenly spread points
      const y = 1 - (2 * i + 1) / GLOBE_POINTS;
      const lat = Math.asin(y), lon = ((i * golden) % (Math.PI * 2)) - Math.PI;
      const land = isLand(lat, lon);
      if (!land && Math.random() > OCEAN_KEEP) continue;
      const r = Math.cos(lat);
      pos.push(r * Math.sin(lon), y, r * Math.cos(lon));
      const b = land ? 0.75 + Math.random() * 0.25 : 0.2;
      col.push(b, b, b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const dots = new THREE.Points(geo, new THREE.PointsMaterial({
      color: COLOR.dots, vertexColors: true, size: 0.016, map: radialTexture([[0, 1], [0.4, 0.85], [1, 0]]),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    // A dark core hides the dots on the far side
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.985, 48, 32), new THREE.MeshBasicMaterial({ color: COLOR.bg, transparent: true }));
    core.renderOrder = -1;
    // Thin atmosphere: brighter the closer a point is to the edge of the sphere
    const rim = new THREE.Mesh(new THREE.SphereGeometry(1.02, 64, 48), new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(COLOR.soft) }, uOpacity: { value: 1 } },
      vertexShader: `
        varying vec3 vNormal; varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying vec3 vNormal; varying vec3 vView;
        void main() {
          float edge = 1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0);
          gl_FragColor = vec4(uColor, pow(edge, 5.0) * 1.3 * uOpacity);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    rim.renderOrder = 1;
    // Soft halo just outside the edge
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture([[0, 0], [0.62, 0], [0.69, 0.45], [0.76, 0.1], [1, 0]]), color: COLOR.soft,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.setScalar(2.9);
    halo.renderOrder = -2;
    dots.material.userData.base = core.material.userData.base = 1;
    halo.material.userData.base = 0.55;
    const group = new THREE.Group();
    group.add(halo, core, dots, rim);
    return { group, mats: [dots.material, core.material, halo.material], rim: rim.material };
  }

  // ===== Blueprint: perspective grid + a wireframe server rack, laptop and code panels that fly in =====
  function makeBuild() {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#000', 8, 26); // black fades the additive lines out into the distance
    const parts = [];
    const lineMat = (color, opacity) => {
      const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      m.userData.base = opacity;
      return m;
    };
    const box = (w, h, d, color, opacity) => new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), lineMat(color, opacity));
    const rect = (w, h, color, opacity) => new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), lineMat(color, opacity));
    const lines = (list, color, opacity) => { // [[x1, y1, z1, x2, y2, z2], ...]
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(list.flat(), 3));
      return new THREE.LineSegments(g, lineMat(color, opacity));
    };
    const code = (w, h, rows, z, seed) => { // rows of "code": indented lines of different lengths
      const soft = [], accent = [];
      for (let r = 0; r < rows; r++) {
        const y = h / 2 - 0.12 - r * ((h - 0.2) / rows);
        const x0 = -w / 2 + 0.08 + [0, 1, 2, 1, 2, 3, 1, 0][(r + seed) % 8] * 0.07;
        const x1 = Math.min(x0 + 0.25 + (((r * 7 + seed * 3) % 5) / 5) * w * 0.55, w / 2 - 0.08);
        ((r + seed) % 3 === 0 ? accent : soft).push([x0, y, z, x1, y, z]);
      }
      const g = new THREE.Group();
      g.add(lines(soft, COLOR.soft, 0.55), lines(accent, COLOR.accent, 0.95));
      return g;
    };
    const part = (obj, x, y, z, { rx = 0, ry = 0, float = false } = {}) => {
      obj.position.set(x, y, z);
      obj.rotation.set(rx, ry, 0);
      const i = parts.length, a = i * 2.4, mats = [];
      obj.traverse((o) => { if (o.material) mats.push(o.material); });
      parts.push({
        obj, mats, float, pos: obj.position.clone(), rot: obj.rotation.clone(),
        from: new THREE.Vector3(Math.cos(a) * 3.4, 1.6 + (i % 3) * 1.1, Math.sin(a) * 3.4), // where it flies in from
        spin: new THREE.Vector3(Math.sin(i * 1.7) * 1.3, Math.cos(i * 1.3) * 1.6, 0),
      });
      scene.add(obj);
    };
    const R = COLOR.accent, W = COLOR.soft;

    // Server rack: the frame, then seven units from the bottom up (vents + two status lights each)
    part(box(1.2, 2.5, 1, R, 0.95), -1.25, 1.25, 0);
    for (let k = 0; k < 7; k++) {
      const unit = new THREE.Group(), z = 0.445, vents = [];
      for (let v = 0; v < 3; v++) vents.push([-0.44, 0.06 - v * 0.06, z, 0.12, 0.06 - v * 0.06, z]);
      unit.add(box(1.04, 0.24, 0.88, W, 0.5), lines(vents, W, 0.35));
      unit.add(lines([...square(0.3, 0, z, 0.025), ...square(0.4, 0, z, 0.025)], k % 2 ? R : W, 0.9));
      part(unit, -1.25, 0.22 + k * 0.33, 0.04);
    }
    // Desk and laptop: keyboard grid, then the screen (hinged at the back) with code on it
    part(box(2.1, 0.8, 1.3, W, 0.25), 1.2, 0.4, 0.1);
    const base = new THREE.Group(), keys = [];
    for (let r = 0; r < 5; r++) keys.push([-0.62, 0.031, -0.38 + r * 0.1, 0.62, 0.031, -0.38 + r * 0.1]);
    for (let c = 0; c <= 12; c++) keys.push([-0.62 + c * 0.1033, 0.031, -0.38, -0.62 + c * 0.1033, 0.031, 0.02]);
    keys.push([-0.2, 0.031, 0.12, 0.2, 0.031, 0.12], [0.2, 0.031, 0.12, 0.2, 0.031, 0.4],
      [0.2, 0.031, 0.4, -0.2, 0.031, 0.4], [-0.2, 0.031, 0.4, -0.2, 0.031, 0.12]); // trackpad
    base.add(box(1.5, 0.06, 1, W, 0.8), lines(keys, W, 0.3));
    part(base, 1.2, 0.83, 0.15);
    const screen = new THREE.Group(), panel = new THREE.Group();
    panel.position.y = 0.5;
    panel.add(box(1.5, 1, 0.04, W, 0.85), code(1.5, 1, 9, 0.022, 0));
    screen.add(panel);
    part(screen, 1.2, 0.86, -0.33, { rx: -0.22 });
    // Floating code / log windows
    const win = (w, h, rows, seed) => {
      const g = new THREE.Group(), body = code(w, h - 0.12, rows, 0, seed);
      body.position.y = -0.06;
      g.add(rect(w, h, W, 0.75), lines([[-w / 2, h / 2 - 0.1, 0, w / 2, h / 2 - 0.1, 0]], W, 0.5), body);
      g.add(lines([...square(-w / 2 + 0.07, h / 2 - 0.05, 0, 0.018), ...square(-w / 2 + 0.13, h / 2 - 0.05, 0, 0.018)], R, 0.9));
      return g;
    };
    part(win(1.3, 0.85, 6, 2), -0.05, 2.75, -0.8, { ry: 0.3, float: true });
    part(win(1.05, 0.7, 5, 5), 2.6, 2.05, -0.55, { ry: -0.45, float: true });
    // Padlock on top: body, shackle and keyhole
    const lock = new THREE.Group(), shackle = [];
    for (let a = 0; a < 12; a++) {
      const t0 = (a / 12) * Math.PI, t1 = ((a + 1) / 12) * Math.PI;
      shackle.push([Math.cos(t0) * 0.11, 0.2 + Math.sin(t0) * 0.11, 0, Math.cos(t1) * 0.11, 0.2 + Math.sin(t1) * 0.11, 0]);
    }
    shackle.push([0.11, 0.135, 0, 0.11, 0.2, 0], [-0.11, 0.135, 0, -0.11, 0.2, 0]);
    lock.add(box(0.34, 0.27, 0.1, R, 1), lines(shackle, R, 1), lines([[0, 0.03, 0.051, 0, -0.07, 0.051]], W, 0.9));
    part(lock, 0.6, 3.25, -0.45, { float: true });

    // The floor: a fine grid plus a coarser blue one
    const minor = new THREE.GridHelper(60, 120, COLOR.soft, COLOR.soft);
    const major = new THREE.GridHelper(60, 30, COLOR.accent, COLOR.accent);
    const gridMats = [];
    for (const [grid, opacity] of [[minor, 0.2], [major, 0.42]]) {
      Object.assign(grid.material, { transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      grid.material.userData.base = opacity;
      gridMats.push(grid.material);
      scene.add(grid);
    }
    return { scene, parts, gridMats };
  }

  // "Secure by design" → one masked span per letter (screen readers get the plain text instead)
  function splitLetters(el) {
    const letters = [];
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    for (const line of el.querySelectorAll(':scope > span')) {
      const row = document.createElement('span');
      row.className = 'p-final-line';
      line.textContent.trim().split(/\s+/).forEach((word, i) => {
        if (i) row.append(' ');
        const w = document.createElement('span');
        w.className = 'p-nowrap';
        for (const ch of word) {
          const mask = document.createElement('span');
          const letter = document.createElement('span');
          mask.className = 'p-mask';
          letter.textContent = ch;
          mask.append(letter);
          w.append(mask);
          letters.push(letter);
        }
        row.append(w);
      });
      visual.append(row);
    }
    const plain = document.createElement('span');
    plain.className = 'sr-only';
    plain.textContent = el.textContent.replace(/\s+/g, ' ').trim();
    el.replaceChildren(plain, visual);
    return letters;
  }

  function init() {
    const gl = canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' });
    if (!gl) return; // no WebGL: keep the plain list
    THREE.ColorManagement.enabled = false; // hex colours then render exactly like the CSS ones
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.autoClear = false;
    renderer.setClearColor(COLOR.bg, 1);

    const globe = makeGlobe();
    const globeScene = new THREE.Scene();
    globeScene.add(globe.group);
    const globeCam = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    const build = makeBuild();
    const buildCam = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      globeCam.aspect = buildCam.aspect = w / h;
      globeCam.updateProjectionMatrix();
      // on wide screens, frame the wireframe in the right half so it stays clear of the stage text
      if (w > 720) buildCam.setViewOffset(w, h, -w * 0.17, 0, w, h);
      else buildCam.clearViewOffset();
    }

    function render() {
      const fit = Math.max(1, 0.95 / globeCam.aspect); // tall phone screens: step back so everything fits
      globe.group.position.set(S.gx, S.gy, 0);
      globe.group.scale.setScalar(S.gs);
      globe.group.rotation.set(0.3, time * 0.06 + S.spin, 0);
      globeCam.position.set(0, S.cy, 1 + (S.cz - 1) * fit);
      globeCam.lookAt(0, S.ly, 0);
      for (const m of globe.mats) m.opacity = m.userData.base * S.globe;
      globe.rim.uniforms.uOpacity.value = S.globe;

      build.parts.forEach((p, i) => { // each part flies in from its offset, spinning, then snaps into place
        const k = clamp01((S.build - (i / build.parts.length) * 0.75) / 0.25);
        const e = 1 - backOut(k);
        p.obj.position.set(p.pos.x + p.from.x * e, p.pos.y + p.from.y * e, p.pos.z + p.from.z * e);
        if (p.float) p.obj.position.y += Math.sin(time * 1.3 + i) * 0.05;
        p.obj.rotation.set(p.rot.x + p.spin.x * e, p.rot.y + p.spin.y * e, 0);
        const alpha = clamp01(k * 3) * S.grid;
        for (const m of p.mats) m.opacity = m.userData.base * alpha;
      });
      for (const m of build.gridMats) m.opacity = m.userData.base * S.grid;
      const a = S.orbit + Math.sin(time * 0.15) * 0.05, r = (8.6 + S.dist) * fit;
      buildCam.position.set(Math.sin(a) * r, 3.4 + S.lift, Math.cos(a) * r);
      buildCam.lookAt(0, PHONE ? 2.1 : 1.1, 0);

      renderer.clear();
      if (S.grid > 0.002) renderer.render(build.scene, buildCam);
      if (S.globe > 0.002) {
        renderer.clearDepth();
        renderer.render(globeScene, globeCam);
      }
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !window.gsap || !window.ScrollTrigger) { // one still frame of the finished wireframe
      section.classList.add('has-image');
      Object.assign(S, { globe: 0, grid: 1, build: 1, orbit: 0.45 });
      new ResizeObserver(() => { resize(); render(); }).observe(canvas);
      return;
    }
    live(resize, render);
  }

  // ===== The pinned, scrubbed story =====
  function live(resize, render) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    section.classList.add('is-live');
    const q = (sel) => section.querySelector(sel);
    const qa = (sel) => section.querySelectorAll(sel);
    const letters = splitLetters(q('.p-final'));
    const steps = qa('.p-step'), caps = qa('.p-cap');
    const [buildWord, secureWord] = qa('.p-word');
    const groups = [...qa('.p-groups li')];
    const blocks = groups.map((g) => [...g.querySelectorAll('.p-blocks i')]);
    const buttons = groups.map((g) => g.querySelector('button'));

    // Render only while the section is on screen; idle motion stops while "Pause motion" is on,
    // but the scene still follows the scrollbar
    let visible = false, raf = 0, last = 0;
    const paused = () => motionToggle?.getAttribute('aria-pressed') === 'false';
    function frame(now) {
      raf = 0;
      if (!visible) return;
      if (!paused()) {
        time += Math.min((now - last) / 1000, 0.05);
        last = now;
        raf = requestAnimationFrame(frame);
      }
      render();
    }
    function kick() {
      if (raf || !visible) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(section);
    if (motionToggle) new MutationObserver(kick).observe(motionToggle, { attributeFilter: ['aria-pressed'] });
    new ResizeObserver(() => { resize(); kick(); }).observe(canvas);

    // Progress bar: 4 blocks per stage fill in blue, the current stage's label lights up
    let lastScene = '';
    function progress(p) {
      let from = 0, active = 0;
      STAGES.forEach((s, k) => {
        const fill = clamp01((p - from) / (s.end - from));
        if (p >= from) active = k;
        blocks[k].forEach((b, j) => b.style.setProperty('--fill', clamp01(fill * 4 - j).toFixed(3)));
        from = s.end;
      });
      buttons.forEach((b, k) => {
        b.classList.toggle('is-active', k === active);
        if (k === active) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
      // which text is on screen (only that one catches the mouse, so it can be selected)
      const scene = p < 0.11 ? 'intro' : p < 0.34 ? 'sides' : p < 0.42 ? 'dive' : p < 0.86 ? `step${active}` : 'outro';
      if (scene !== lastScene) stage.dataset.scene = lastScene = scene;
    }

    // 1 · Intro: the label and headline rise line by line while the section scrolls into view
    gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 75%', end: 'top 10%', scrub: SCRUB } })
      .fromTo(q('.p-intro .p-label'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.3 }, 0)
      .fromTo(qa('.p-line > span'), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, stagger: 0.14, ease: 'power3.out' }, 0.1);

    // The pinned story. Positions are 0–1 of the scroll (the timeline is exactly 1 long)
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onUpdate: () => { progress(tl.progress()); kick(); } });
    tl
      // 2 · Two sides: the intro steps aside, the globe slides to the middle and the camera pushes in
      .to(q('.p-intro'), { opacity: 0, y: -40, duration: 0.04, ease: 'power2.in' }, 0.07)
      .to(S, { gx: 0, cz: 3, ly: 0, duration: 0.16 }, 0.09)
      .fromTo(q('.p-two .p-clip'), { clipPath: 'inset(100% 0% 0% 0%)', yPercent: 30 },
        { clipPath: 'inset(0% 0% 0% 0%)', yPercent: 0, duration: 0.045, ease: 'power3.out' }, 0.125)
      .to(q('.p-two .p-clip'), { clipPath: 'inset(0% 0% 100% 0%)', yPercent: -30, duration: 0.03, ease: 'power2.in' }, 0.2)
      .fromTo(buildWord, { clipPath: 'inset(0% 100% 0% 0%)', x: () => -window.innerWidth * 0.12 },
        { clipPath: 'inset(0% 0% 0% 0%)', x: 0, duration: 0.05, ease: 'power3.out' }, 0.21)
      .fromTo(secureWord, { clipPath: 'inset(0% 0% 0% 100%)', x: () => window.innerWidth * 0.12 },
        { clipPath: 'inset(0% 0% 0% 0%)', x: 0, duration: 0.05, ease: 'power3.out' }, 0.21)
      .fromTo(caps, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.03, stagger: 0.01 }, 0.24)
      .to(buildWord, { clipPath: 'inset(0% 100% 0% 0%)', x: () => -window.innerWidth * 0.05, duration: 0.03, ease: 'power2.in' }, 0.3)
      .to(secureWord, { clipPath: 'inset(0% 0% 0% 100%)', x: () => window.innerWidth * 0.05, duration: 0.03, ease: 'power2.in' }, 0.3)
      .to(caps, { opacity: 0, duration: 0.02 }, 0.3)
      // 3 · Zoom: dive into the globe until it fills the screen, then cross-fade into the blueprint grid
      .to(S, { cz: 1.07, duration: 0.1, ease: 'power2.in' }, 0.31)
      .to(S, { globe: 0, duration: 0.05, ease: 'none' }, 0.375)
      .fromTo(S, { grid: 0, lift: 7, dist: 5 }, { grid: 1, lift: 0, dist: 0, duration: 0.1, ease: 'power2.out', immediateRender: false }, 0.38)
      // 4 · Build-up: the wireframe assembles part by part while the camera orbits; one stage text at a time
      .to(S, { build: 1, duration: 0.36, ease: 'none' }, 0.44)
      .to(S, { orbit: 0.9, duration: 0.46, ease: 'none' }, 0.4);
    steps.forEach((step, k) => {
      const from = k ? STAGES[k - 1].end : 0.43, to = k < 3 ? STAGES[k].end : 0.85;
      tl.fromTo(step, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.03, ease: 'power2.out' }, from + 0.005)
        .to(step, { opacity: 0, y: -40, duration: 0.025, ease: 'power2.in' }, to - 0.03);
    });
    tl
      // 5 · Outro: pull back out to the dotted globe on the horizon; the last headline rises letter by letter
      .to(S, { grid: 0, dist: 6, lift: 3, duration: 0.06, ease: 'power2.in' }, 0.84)
      .set(S, { gx: 0, gy: -3.55, gs: 3.2, cy: 0.35, ly: 0.1, cz: 2.2 }, 0.855)
      .to(S, { globe: 1, duration: 0.06, ease: 'none' }, 0.86)
      .to(S, { cz: 4, duration: 0.12, ease: 'power2.out' }, 0.86)
      .fromTo(q('.p-outro .p-label'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.03 }, 0.89)
      .fromTo(letters, { yPercent: 110 }, { yPercent: 0, duration: 0.03, stagger: 0.004, ease: 'power3.out' }, 0.9)
      .to(S, { spin: 2.4, duration: 1, ease: 'none' }, 0) // the globe keeps turning as you scroll
      .set({}, {}, 1);

    const st = ScrollTrigger.create({
      trigger: section, start: 'top top', end: () => `+=${(window.innerHeight * SCROLL_LENGTH) / 100}`,
      pin: stage, scrub: SCRUB, animation: tl, invalidateOnRefresh: true,
    });
    buttons.forEach((b, k) => b.addEventListener('click', () => {
      const y = st.start + (st.end - st.start) * STAGES[k].at;
      if (window.lenis) window.lenis.scrollTo(y, { duration: 1.4 }); // smooth.js
      else window.scrollTo({ top: y, behavior: 'smooth' });
    }));
    // A refresh can jump the story (e.g. opening the page below it) without an update: sync the bar then too
    const sync = () => { progress(tl.progress()); kick(); };
    ScrollTrigger.addEventListener('refresh', sync);
    sync();
    resize();
    // Text reflows once the web fonts are in, which moves this section: measure again
    document.fonts.ready.then(() => requestAnimationFrame(() => ScrollTrigger.refresh()));
    // Pinning makes the page taller; if it was opened at an anchor below this section (#contact…), go back there
    const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && !section.contains(target) && section.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING) {
      ScrollTrigger.refresh();
      target.scrollIntoView({ behavior: 'instant' });
    }
  }

  init();
})();
