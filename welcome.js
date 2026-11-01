// ===== Welcome screen =====
// Shown before the page: thousands of particles swirl in like a galaxy and assemble into a 3D "WELCOME"
// that leans with the cursor and parts around it. "Enter the site", a scroll or swipe down, or the Enter key
// sends the particles rushing past the camera while the page fades in behind them.
// The words are HTML in index.html (#welcome). script.js waits for window.welcomeDone before it plays the
// hero, so your name animates in as the welcome leaves.
// Loads right after three.js and before the rest of the page's scripts, so the particles start straight away.
// Wrapped in its own scope so its names can't clash with script.js.
(() => {
  // ===== Settings: edit these =====
  const WORD = 'WELCOME';          // the word the particles form
  const ONCE_PER_VISIT = false;    // true: show it only on the first page load of a browser session
  const PHONE = window.matchMedia('(max-width: 720px)').matches;
  const PARTICLES = PHONE ? 7000 : 15000; // particles that form the word
  const DUST = PHONE ? 900 : 2000;        // particles that stay behind as drifting stars
  const ASSEMBLE = 2.6;            // seconds the particles take to form the word
  const LEAVE = 1.3;               // seconds the fly-through takes once the visitor enters

  const root = document.documentElement;
  const el = document.getElementById('welcome');
  const page = document.querySelector('.page');
  let finish;
  window.welcomeDone = new Promise((resolve) => { finish = resolve; });
  root.classList.add('welcome-ready'); // tells the CSS failsafe this script is running

  let seen = false;
  try { seen = sessionStorage.getItem('welcomed') === '1'; sessionStorage.setItem('welcomed', '1'); } catch (e) { /* storage blocked: show it */ }
  if (!el || (ONCE_PER_VISIT && seen)) {
    if (el) el.hidden = true;
    finish();
    return;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const button = el.querySelector('.welcome-enter');
  const canvas = el.querySelector('.welcome-canvas');
  const copy = el.querySelector('.welcome-copy');
  const listeners = new AbortController(); // every listener below goes away together once the welcome is gone
  const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: listeners.signal });
  let leaving = false, leftAt = 0, particles = null;
  let scrollFrom = Infinity; // scrolling only lets the visitor in once the words have been on screen for a moment
  root.classList.add('welcome-open');
  if (page) page.inert = true; // the page underneath can't be tabbed into while it's covered
  el.focus({ preventScroll: true }); // screen readers announce the welcome; Tab then reaches the button

  // ===== Entering: the button, a scroll or swipe down, or Enter / Space / ↓ / Esc =====
  function enter() {
    if (leaving) return;
    leaving = true;
    leftAt = performance.now();
    el.classList.add('is-leaving');
    root.classList.remove('welcome-open');
    if (page) page.inert = false;
    setTimeout(finish, reduced ? 0 : 350); // script.js starts the hero as the welcome's background starts to fade
    setTimeout(() => {
      el.hidden = true;
      if (particles) particles.dispose();
      listeners.abort();
    }, reduced ? 400 : LEAVE * 1000 + 300);
  }
  on(button, 'click', enter);
  // Scrolling down means "let me in". Until the welcome is gone the page underneath doesn't scroll,
  // or the rest of a trackpad flick would carry the visitor straight past the hero.
  on(window, 'wheel', (e) => {
    if (e.ctrlKey) return; // ctrl + wheel is the browser's zoom: leave it alone
    e.preventDefault();
    e.stopImmediatePropagation(); // nor does Lenis (smooth.js), which would otherwise glide the page along anyway
    if (e.deltaY > 0 && performance.now() > scrollFrom) enter();
  }, { passive: false });
  let touchY = null;
  on(window, 'touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  on(window, 'touchmove', (e) => {
    e.preventDefault();
    if (touchY !== null && touchY - e.touches[0].clientY > 40 && performance.now() > scrollFrom) enter();
  }, { passive: false });
  on(window, 'keydown', (e) => {
    if (leaving) return;
    if (['Enter', ' ', 'ArrowDown', 'PageDown', 'End', 'Escape'].includes(e.key)) { e.preventDefault(); enter(); }
    else if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) e.preventDefault();
  });

  // The words come in while the particles are still forming the word (with reduced motion, straight away)
  function showWords() {
    el.classList.add('is-ready');
    scrollFrom = performance.now() + 500;
  }
  if (reduced) showWords();
  else setTimeout(showWords, 1100);

  // three.js is loaded just before this file (if it failed to load, the words on their own are fine)
  if (window.THREE) particles = makeParticles(window.THREE);

  // ===== The particles =====
  function makeParticles(THREE) {
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) return null; // no WebGL: the words on their own are fine
    THREE.ColorManagement.enabled = false; // hex colours then render exactly like the CSS ones
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const CAM = 10;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.z = CAM;
    const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();
    const fg = new THREE.Color(cssVar('--fg')), red = new THREE.Color(cssVar('--accent'));

    // Each particle: where it starts in the galaxy (radius, angle, height), where it ends up in the word,
    // random numbers (when it sets off, twinkle phase, size, exit speed) and a colour
    const total = PARTICLES + DUST;
    const start = new Float32Array(total * 3), target = new Float32Array(total * 3);
    const rand = new Float32Array(total * 4), color = new Float32Array(total * 3);
    for (let i = 0; i < total; i++) {
      const r = 0.1 + Math.random() ** 0.75 * 1.05;
      start.set([r, (i % 3) * 2.094 + r * 4.2 + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.06], i * 3);
      rand.set([i < PARTICLES ? Math.random() : 2, Math.random(), 0.6 + Math.random() * 0.8, Math.random()], i * 4);
      const c = Math.random() < 0.16 ? red : fg; // a sprinkle of the accent red
      color.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(start, 3));
    geo.setAttribute('aTarget', new THREE.BufferAttribute(target, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uProgress: { value: reduced ? 1 : 0 }, uExit: { value: 0 },
        uSize: { value: 2 }, uPixelRatio: { value: 1 }, uCam: { value: CAM }, uAspect: { value: 1 }, uLift: { value: 0 },
        uMouse: { value: new THREE.Vector2(9, 9) }, uMouseOn: { value: 0 }, uPush: { value: 0.5 },
      },
      vertexShader: `
        uniform float uTime, uProgress, uExit, uSize, uPixelRatio, uCam, uAspect, uMouseOn, uPush, uLift;
        uniform vec2 uMouse;
        attribute vec3 aTarget, aColor;
        attribute vec4 aRand;
        varying vec3 vColor;
        varying float vAlpha;
        vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
        void main() {
          // the galaxy: a tilted spiral disc, inner parts turning faster
          float r = position.x, a = position.y + uTime * 0.35 / (r + 0.35);
          vec3 galaxy = vec3(cos(a) * r, sin(a) * r * 0.32 + position.z, sin(a) * r * 0.85 - 0.15);
          // word particles swirl in from the galaxy, left letters first; dust (aRand.x = 2) stays out there
          float t = aRand.x > 1.5 ? 0.0 : clamp((uProgress - aRand.x * 0.55) / 0.45, 0.0, 1.0);
          float e = 1.0 - pow(1.0 - t, 3.0);
          vec3 p = rotZ(mix(galaxy, aTarget, e), (1.0 - e) * 2.4);
          p += vec3(sin(uTime * 1.3 + aRand.y * 6.3), cos(uTime * 1.1 + aRand.y * 4.0), sin(uTime * 0.9 + aRand.y * 5.0)) * 0.003 * e;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          // the cursor pushes nearby particles aside and towards you
          vec4 clip = projectionMatrix * mv;
          vec2 d = (clip.xy / clip.w - uMouse) * vec2(uAspect, 1.0);
          float push = (1.0 - smoothstep(0.0, 0.3, length(d))) * uMouseOn * uPush;
          mv.xy += normalize(d + 1e-4) * push;
          mv.z += push * 1.5;
          // entering: everything drifts to the middle of the screen and bursts outwards past the camera
          float x = clamp((uExit - aRand.w * 0.35) / 0.65, 0.0, 1.0);
          mv.y -= uLift * min(x * 2.0, 1.0);
          mv.xy *= 1.0 + x * x * 0.6;
          mv.z += x * x * (uCam + 4.0) * (0.8 + aRand.w * 0.6);
          gl_Position = projectionMatrix * mv;
          float depth = max(-mv.z, 0.05);
          gl_PointSize = min(uSize * aRand.z * uPixelRatio * uCam / depth, 48.0 * uPixelRatio);
          vColor = aColor;
          vAlpha = (aRand.x > 1.5 ? 0.45 : 0.95) * (0.75 + 0.25 * sin(uTime * 3.0 + aRand.y * 40.0))
            * (1.0 - smoothstep(-1.5, -0.2, mv.z)) * (1.0 - smoothstep(0.75, 1.0, uExit));
        }`,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(vColor, (1.0 - smoothstep(0.1, 0.5, d)) * vAlpha);
        }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false; // 'position' holds galaxy coordinates, not real positions

    // A soft red glow behind the word
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = glowCanvas.height = 128;
    const g2 = glowCanvas.getContext('2d');
    const grad = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: red, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.scale.set(1.5, 0.5, 1);
    glow.position.z = -0.3;
    const group = new THREE.Group();
    group.add(glow, points);
    scene.add(group);

    // Draw the word on a hidden canvas (in the site's font) and give each particle a spot inside a letter
    let wordRatio = 0.15; // word height / width, set once the word has been drawn
    function placeWord() {
      const c = document.createElement('canvas'), g = c.getContext('2d');
      const size = 160;
      const font = () => { g.font = `900 ${size}px Archivo, system-ui, sans-serif`; if ('fontStretch' in g) g.fontStretch = 'expanded'; };
      font();
      const w = Math.ceil(g.measureText(WORD).width + size * 0.2), h = size;
      c.width = w;
      c.height = h;
      font(); // resizing a canvas resets its settings
      g.textAlign = 'center';
      g.fillStyle = '#fff';
      g.fillText(WORD, w / 2, h * 0.5 + size * 0.35); // capitals end up centred vertically
      const data = g.getImageData(0, 0, w, h).data, spots = [];
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 140) spots.push(x, y);
      if (!spots.length) return;
      wordRatio = h / w;
      for (let i = 0; i < PARTICLES; i++) {
        const k = Math.floor(Math.random() * (spots.length / 2)) * 2;
        const px = (spots[k] + Math.random() * 2) / w - 0.5;
        target.set([px, -((spots[k + 1] + Math.random() * 2) / h - 0.5) * wordRatio, (Math.random() - 0.5) * 0.05], i * 3);
        rand[i * 4] = 0.6 * (px + 0.5) + 0.4 * Math.random(); // set-off time: the word forms left to right
      }
      geo.attributes.aTarget.needsUpdate = true;
      geo.attributes.aRand.needsUpdate = true;
      resize();
    }

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const viewH = 2 * CAM * Math.tan((35 / 2) * (Math.PI / 180)), viewW = viewH * camera.aspect;
      const s = Math.min(viewW * (PHONE ? 0.9 : 0.74), (viewH * 0.26) / wordRatio); // word width in 3D units
      group.scale.setScalar(s);
      // The word sits just above the words: the CSS makes room for it (--word-space), then it goes in that room
      const wordH = ((s * wordRatio) / viewH) * h, gap = Math.min(Math.max(h * 0.035, 18), 36);
      el.style.setProperty('--word-space', `${Math.round(wordH + gap)}px`);
      group.position.y = viewH * (0.5 - (copy.offsetTop - gap - wordH / 2) / h);
      const u = mat.uniforms, wordPx = (s / viewW) * w;
      u.uSize.value = Math.min(Math.max(Math.sqrt((wordPx * wordPx * 0.05) / PARTICLES) * 1.15, 1.3), 3.2);
      u.uPixelRatio.value = renderer.getPixelRatio();
      u.uAspect.value = camera.aspect;
      u.uPush.value = s * 0.07;
      u.uLift.value = group.position.y;
      if (reduced && formingSince !== null) renderer.render(scene, camera); // still frame, once the word is placed
    }

    const mouse = { x: 9, y: 9, tx: 9, ty: 9, on: 0 };
    on(window, 'pointermove', (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
      if (mouse.x > 2) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
      mouse.on = e.pointerType === 'touch' ? 0 : 1;
    });
    on(window, 'resize', resize);

    let raf = 0, last = performance.now(), time = 0, formingSince = null;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      const u = mat.uniforms;
      u.uTime.value = time;
      u.uProgress.value = formingSince === null ? 0 : Math.min((now - formingSince) / 1000 / ASSEMBLE, 1);
      u.uExit.value = leaving ? Math.min((now - leftAt) / 1000 / LEAVE, 1) : 0;
      u.uMouse.value.set(mouse.x, mouse.y);
      u.uMouseOn.value += ((leaving ? 0 : mouse.on) - u.uMouseOn.value) * 0.1;
      const mx = mouse.x > 2 ? 0 : mouse.x, my = mouse.y > 2 ? 0 : mouse.y;
      group.rotation.y = Math.sin(time * 0.45) * 0.2 + mx * 0.28; // sways, and leans towards the cursor
      group.rotation.x = -my * 0.16 + Math.sin(time * 0.33) * 0.04;
      glow.material.opacity = 0.3 * u.uProgress.value * (1 - u.uExit.value);
      renderer.render(scene, camera);
    }

    resize();
    // Wait for the site font (at most 1.2s) so the word is drawn in it
    const fontIn = document.fonts ? document.fonts.load('900 160px Archivo').catch(() => {}) : Promise.resolve();
    Promise.race([fontIn, new Promise((r) => setTimeout(r, 1200))]).then(() => {
      if (leaving) return;
      placeWord();
      formingSince = performance.now();
      if (reduced) { glow.material.opacity = 0.3; renderer.render(scene, camera); }
    });
    if (!reduced) raf = requestAnimationFrame(frame);

    return {
      dispose() {
        cancelAnimationFrame(raf);
        geo.dispose();
        mat.dispose();
        glow.material.dispose();
        glowTex.dispose();
        renderer.dispose();
        renderer.forceContextLoss(); // hand the GPU memory back (the Process section has its own 3D)
      },
    };
  }
})();
