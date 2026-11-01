// ===== Missions completed: a pinned section whose cards slide sideways as you scroll down =====
// The section pins for as long as the row of cards is wide, the scroll slides the row to the left and the counter
// follows. The cards rise in, slightly tilted, as the section comes up the screen.
// The cards are plain HTML in index.html (#missions). Each card's visual is a canvas: a faint blue grid with either a
// moving signal wave or a little network orbiting its centre (data-visual="wave" | "network"). It only animates while
// the card is on screen, and stands still while "Pause motion" is on.
// Without GSAP, or with reduced motion, nothing pins: the cards stay a normal grid (missions.css) and the visuals still.
// Wrapped in its own scope so its names can't clash with the other scripts.
(() => {
  const section = document.getElementById('missions');
  const track = section && section.querySelector('.m-track');
  if (!track) return;
  const { gsap, ScrollTrigger } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionToggle = document.getElementById('motion-toggle'); // script.js sets aria-pressed="false" while paused
  const paused = () => motionToggle && motionToggle.getAttribute('aria-pressed') === 'false';
  const cards = [...track.querySelectorAll('.m-card')];
  const n = cards.length;
  const pad = (v) => String(v).padStart(2, '0');

  // ===== Card visuals =====
  const BLUE = '30,144,255', ORANGE = '#ff6a2b', WHITE = '#f2f5fb';
  const TAU = Math.PI * 2;
  const visuals = cards.map((card, i) => {
    const canvas = card.querySelector('.m-canvas');
    return canvas && {
      box: card.querySelector('.m-visual'), canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1,
      kind: canvas.dataset.visual || (i % 2 ? 'network' : 'wave'),
      seed: i * 1.7, // so neighbouring cards don't move in step
    };
  }).filter((v) => v && v.ctx);

  function wave({ ctx, w, h, seed }, t) { // one 2px line: two sine waves added together, travelling at different speeds
    ctx.strokeStyle = `rgb(${BLUE})`;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let x = 0; x <= w + 4; x += 4) {
      const u = x / w;
      const y = h * 0.5 + Math.sin(u * TAU * 1.6 + t * 1.4 + seed) * h * 0.16 + Math.sin(u * TAU * 4.3 - t * 2.3) * h * 0.06;
      if (x) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  function network({ ctx, w, h, seed }, t) { // 14 nodes going round a white centre dot on an ellipse; every 5th is orange
    const cx = w * 0.5, cy = h * 0.5, rx = w * 0.32, ry = h * 0.3;
    const nodes = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + t * 0.35 + seed;
      nodes.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    ctx.strokeStyle = `rgba(${BLUE},.28)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [x, y] of nodes) { ctx.moveTo(cx, cy); ctx.lineTo(x, y); }
    ctx.stroke();
    nodes.forEach(([x, y], i) => {
      ctx.fillStyle = (i + 1) % 5 === 0 ? ORANGE : `rgb(${BLUE})`;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, TAU);
    ctx.fill();
  }

  function draw(v, t) {
    const { ctx, w, h } = v;
    if (!w || !h) return;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = `rgba(${BLUE},.12)`; // the grid, every 24px
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0.5; x < w; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0.5; y < h; y += 24) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    if (v.kind === 'network') network(v, t);
    else wave(v, t);
  }

  // The canvases follow their boxes (sharp on high-density screens, at most 2x) and redraw straight away,
  // so a still frame is there even when nothing animates
  let time = 0;
  const resizer = new ResizeObserver((entries) => {
    for (const e of entries) {
      const v = visuals.find((x) => x.canvas === e.target);
      v.w = v.canvas.clientWidth;
      v.h = v.canvas.clientHeight;
      v.dpr = Math.min(window.devicePixelRatio || 1, 2);
      v.canvas.width = Math.round(v.w * v.dpr);
      v.canvas.height = Math.round(v.h * v.dpr);
      draw(v, time);
    }
  });
  visuals.forEach((v) => resizer.observe(v.canvas));

  // One loop for every visual on screen; it stops altogether when none are, to save battery
  if (!reduced) {
    const onScreen = new Set();
    let raf = 0, last = 0;
    const frame = (now) => {
      raf = onScreen.size ? requestAnimationFrame(frame) : 0;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (paused()) return;
      time += dt;
      for (const v of onScreen) draw(v, time);
    };
    const watcher = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = visuals.find((x) => x.box === e.target);
        if (e.isIntersecting) onScreen.add(v);
        else onScreen.delete(v);
      }
      if (onScreen.size && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    visuals.forEach((v) => watcher.observe(v.box));
  }

  // ===== Scroll =====
  if (!gsap || !ScrollTrigger || reduced) return; // the normal grid
  gsap.registerPlugin(ScrollTrigger);
  section.classList.add('is-live');
  const count = section.querySelector('.m-count');
  const setCount = (p) => { count.textContent = `${pad(Math.min(n, 1 + Math.floor(p * n)))} / ${pad(n)}`; };
  setCount(0);
  const gutter = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;

  // Coming in (plays once, not scrubbed): the cards rise and straighten one after another, the heading fades up.
  // gsap.from sets the start states here, so without JS the cards are simply there. clearProps: GSAP leaves
  // translate: none on the cards, which would cancel their hover lift (missions.css)
  gsap.timeline({ scrollTrigger: { trigger: section, start: 'top 70%' } })
    .from(cards, { opacity: 0, y: 80, rotate: 2, duration: 1, stagger: 0.08, ease: 'expo.out', clearProps: 'all' }, 0)
    .from(section.querySelectorAll('.m-label, .m-title, .m-count'), { opacity: 0, y: 30, duration: 1, stagger: 0.1, ease: 'expo.out' }, 0);

  // Pinned: the scroll slides the row left until the last card is in. Function values, so a resize measures again.
  gsap.timeline({
    scrollTrigger: {
      trigger: section, start: 'top top', end: () => `+=${track.scrollWidth}`,
      pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate: (self) => setCount(self.progress),
    },
  }).to(track, { x: () => -Math.max(0, track.scrollWidth - window.innerWidth + gutter() * 2), ease: 'none' });

  // The fonts and images change the height of the page above: measure again once they're in
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  if (document.readyState !== 'complete') window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
