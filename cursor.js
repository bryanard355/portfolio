// ===== Goo cursor =====
// A white liquid blob follows the mouse and leaves a trail. Every blob is a plain circle on one fixed
// canvas; the SVG "goo" filter (blur + alpha threshold) melts them together like metaballs, and
// mix-blend-mode: difference inverts whatever is underneath (see "Goo cursor" in style.css).
// Off on touch screens, with prefers-reduced-motion, and while the footer's "Pause motion" is on.
// Wrapped in its own scope so its names can't clash with script.js.
(() => {
  // ===== Settings: tweak these =====
  const TRAIL_DECAY = 0.88; // trail length: share of each blob's size kept per frame (0.8 = short … 0.95 = long)
  const BLOB_SIZE = 11;     // blob size: head radius in px; fast strokes leave blobs up to ~2.2x this
  const FOLLOW_LAG = 0.3;   // follow lag: share of the gap to the pointer the head closes per frame (lower = lazier)
  const GOO_STRENGTH = 7;   // goo strength: blur in px before the threshold (higher = gooier; keep it below BLOB_SIZE)

  // ===== Layer: one fixed canvas plus the SVG filter it uses =====
  const root = document.documentElement;
  const canvas = document.createElement('canvas');
  canvas.className = 'goo-cursor-layer';
  canvas.setAttribute('aria-hidden', 'true');
  const defs = document.createElement('div');
  // Blur, then alpha × 20 − 8: soft edges snap back to a crisp outline, and blobs close together fuse
  defs.innerHTML = `<svg aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0">
    <filter id="goo-cursor-filter" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="${GOO_STRENGTH}"/>
      <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"/>
    </filter>
  </svg>`;
  document.body.append(defs.firstElementChild, canvas);
  const ctx = canvas.getContext('2d');

  const pointer = { x: 0, y: 0 };
  const head = { x: 0, y: 0, r: 0 };
  let blobs = []; // trail blobs and droplets: { x, y, r, vx, vy, decay }
  let enabled = false, seen = false, inside = false, raf = 0, last = 0, w = 0, h = 0;

  function resize() { // backing store follows the layer's size and the screen's pixel density (max 2x)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function circle(x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    for (const b of blobs) circle(b.x, b.y, b.r);
    if (head.r > 0.5) circle(head.x, head.y, head.r);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  // ===== Animation =====
  function frame(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 1 / 240), 1 / 20);
    const f = dt * 60; // keeps the feel the same at 60, 120 or 144 Hz
    last = now;

    // The head chases the pointer with a little lag; it shrinks away when the pointer leaves or is over a text field
    const px = head.x, py = head.y;
    const follow = 1 - (1 - FOLLOW_LAG) ** f;
    head.x += (pointer.x - head.x) * follow;
    head.y += (pointer.y - head.y) * follow;
    head.r += ((inside ? BLOB_SIZE : 0) - head.r) * (1 - 0.7 ** f);

    // Leave blobs along the path the head just covered: the faster it moves, the bigger they are
    const dx = head.x - px, dy = head.y - py, dist = Math.hypot(dx, dy), speed = dist / dt;
    if (inside && dist > 0.5) {
      const r = BLOB_SIZE * (0.8 + 1.4 * Math.min(speed / 2000, 1));
      for (let s = 0; s < dist; s += r * 0.4) {
        blobs.push({ x: px + (dx * s) / dist, y: py + (dy * s) / dist, r, vx: 0, vy: 0, decay: TRAIL_DECAY });
      }
      // At high speed a droplet now and then flies off the side of the trail
      if (speed > 1400 && Math.random() < 0.12 * f) {
        const side = Math.random() < 0.5 ? -1 : 1, kick = speed * (0.15 + Math.random() * 0.2);
        blobs.push({
          x: px, y: py, r: GOO_STRENGTH * (1.4 + Math.random() * 0.5),
          vx: (dx / dist) * speed * 0.2 - (dy / dist) * side * kick,
          vy: (dy / dist) * speed * 0.2 + (dx / dist) * side * kick,
          decay: 0.95,
        });
      }
    }

    // Everything shrinks, so the trail dissolves once the mouse stops; droplets coast to a halt
    for (const b of blobs) {
      b.r *= b.decay ** f;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.9 ** f;
      b.vy *= 0.9 ** f;
    }
    blobs = blobs.filter((b) => b.r > GOO_STRENGTH * 0.5); // anything smaller is invisible after the filter anyway

    draw();
    const busy = blobs.length || Math.abs(pointer.x - head.x) + Math.abs(pointer.y - head.y) > 0.1 ||
      Math.abs((inside ? BLOB_SIZE : 0) - head.r) > 0.05;
    raf = busy ? requestAnimationFrame(frame) : 0; // sleep once everything has settled
  }
  function start() {
    if (raf || !enabled || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // ===== Pointer =====
  addEventListener('pointermove', (e) => {
    if (!enabled || e.pointerType === 'touch') return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!seen) { // first move (or back from outside the window): start right at the pointer
      seen = true;
      head.x = pointer.x;
      head.y = pointer.y;
      root.classList.add('goo-cursor'); // hide the real cursor only once ours is on screen
    }
    // Over a text field the real cursor takes over (see style.css) and the blob steps aside
    inside = !(e.target.isContentEditable || e.target.closest('input, textarea, select'));
    start();
  }, { passive: true });
  document.addEventListener('pointerout', (e) => {
    if (e.relatedTarget || e.pointerType === 'touch') return; // still inside the page
    seen = inside = false;
    start(); // let the head shrink away
  });

  // ===== On/off: desktop mice only, not with reduced motion, not while "Pause motion" is on =====
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionToggle = document.getElementById('motion-toggle'); // script.js sets aria-pressed="false" when paused
  function update() {
    enabled = finePointer.matches && !reducedMotion.matches && motionToggle?.getAttribute('aria-pressed') !== 'false';
    canvas.hidden = !enabled;
    if (enabled) { resize(); return; }
    stop();
    blobs = [];
    seen = inside = false;
    head.r = 0;
    root.classList.remove('goo-cursor');
  }
  finePointer.addEventListener('change', update);
  reducedMotion.addEventListener('change', update);
  if (motionToggle) new MutationObserver(update).observe(motionToggle, { attributeFilter: ['aria-pressed'] });
  addEventListener('resize', () => { if (enabled) resize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  update();
})();
