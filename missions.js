// ===== Missions completed: a pinned section whose cards slide sideways as you scroll down =====
// Arriving (scrubbed by the scroll, so it plays backwards on the way up): a blue light line opens across the top of
// the section, the label decrypts itself, the heading rises word by word and the cards are dealt in from the right,
// swinging flat as they land.
// Each card then boots up as it comes into view, rising up the screen or sliding in from the right: its tag wipes in,
// its visual draws itself (the grid fades up, the wave traces across, the network unfolds node by node) and its
// caption decrypts.
// Pinned: the section pins for as long as the row of cards is wide, the scroll slides the row to the left and the
// counter follows.
// The cards are plain HTML in index.html (#missions). Each visual is a canvas: a faint blue grid with either a moving
// signal wave or a network orbiting its centre (data-visual="wave" | "network"). It only animates while its card is
// on screen, and stands still while "Pause motion" is on.
// Without GSAP, or with reduced motion, nothing pins or arrives: the cards stay a normal grid (missions.css).
// Wrapped in its own scope so its names can't clash with the other scripts.
(() => {
  const section = document.getElementById('missions');
  const track = section && section.querySelector('.m-track');
  if (!track) return;
  const { gsap, ScrollTrigger } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const live = !!(gsap && ScrollTrigger) && !reduced; // pinned and scroll-driven; otherwise a still grid
  const motionToggle = document.getElementById('motion-toggle'); // script.js sets aria-pressed="false" while paused
  const paused = () => motionToggle && motionToggle.getAttribute('aria-pressed') === 'false';
  const cards = [...track.querySelectorAll('.m-card')];
  const n = cards.length;
  const pad = (v) => String(v).padStart(2, '0');
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const ease = (t) => 1 - (1 - t) ** 3;
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };

  // ===== Decrypting text: it types in from the left, its newest few letters still scrambled =====
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@';
  function decrypt(el, p) { // p: 0 = blank, 1 = the real text
    const text = el.dataset.text || (el.dataset.text = el.textContent);
    const done = Math.floor(p * text.length);
    let out = text.slice(0, done);
    if (p > 0 && p < 1) {
      for (let k = done; k < Math.min(text.length, done + 4); k++) {
        out += /[\s·/]/.test(text[k]) ? text[k] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
    }
    if (el.textContent !== out) el.textContent = out;
  }

  // ===== Card visuals =====
  const BLUE = '30,144,255', ORANGE = '#ff6a2b', WHITE = '#f2f5fb';
  const TAU = Math.PI * 2;
  const visuals = cards.map((card, i) => {
    const canvas = card.querySelector('.m-canvas');
    return canvas && {
      box: card.querySelector('.m-visual'), canvas, ctx: canvas.getContext('2d'), w: 0, h: 0, dpr: 1,
      tag: card.querySelector('.m-tag'), caption: card.querySelector('.m-caption'),
      kind: canvas.dataset.visual || (i % 2 ? 'network' : 'wave'),
      seed: i * 1.7, // so neighbouring cards don't move in step
      boot: live ? 0 : 1, // how far the card has booted up: 0 = blank, 1 = all there (see revealOf)
    };
  }).filter((v) => v && v.ctx);

  // 2px line: two sine waves added together, travelling at different speeds. Booting, it traces in from the left
  // behind a bright head.
  function wave({ ctx, w, h, seed, boot }, t) {
    const y = (x) => {
      const u = x / w;
      return h * 0.5 + Math.sin(u * TAU * 1.6 + t * 1.4 + seed) * h * 0.16 + Math.sin(u * TAU * 4.3 - t * 2.3) * h * 0.06;
    };
    const end = (w + 4) * ease(boot);
    ctx.strokeStyle = `rgb(${BLUE})`;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, y(0));
    for (let x = 4; x < end; x += 4) ctx.lineTo(x, y(x));
    ctx.lineTo(end, y(end));
    ctx.stroke();
    if (boot > 0 && boot < 1) {
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.arc(end, y(end), 3, 0, TAU);
      ctx.fill();
    }
  }

  // 14 nodes going round a white centre dot on an ellipse, every 5th one orange. Booting, the ellipse opens out
  // and the nodes appear one after another.
  function network({ ctx, w, h, seed, boot }, t) {
    const cx = w * 0.5, cy = h * 0.5, open = ease(boot), rx = w * 0.32 * open, ry = h * 0.3 * open;
    const nodes = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + t * 0.35 + seed;
      nodes.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, clamp01(boot * 18 - i)]);
    }
    ctx.lineWidth = 1;
    for (const [x, y, s] of nodes) {
      if (!s) continue;
      ctx.strokeStyle = `rgba(${BLUE},${(0.28 * s).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    nodes.forEach(([x, y, s], i) => {
      if (!s) return;
      ctx.fillStyle = (i + 1) % 5 === 0 ? ORANGE : `rgb(${BLUE})`;
      ctx.beginPath();
      ctx.arc(x, y, 3 * s, 0, TAU);
      ctx.fill();
    });
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * ease(clamp01(boot * 3)), 0, TAU);
    ctx.fill();
  }

  function draw(v, t) {
    const { ctx, w, h } = v;
    if (!w || !h) return;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = `rgba(${BLUE},${(0.12 * clamp01(v.boot * 2)).toFixed(3)})`; // the grid, every 24px
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0.5; x < w; x += 24) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0.5; y < h; y += 24) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    if (v.kind === 'network') network(v, t);
    else wave(v, t);
  }

  // The tag wipes in first; the caption decrypts over the second half of the boot
  function bootTag(v) {
    if (v.tag) v.tag.style.clipPath = v.boot < 1 ? `inset(0 ${((1 - ease(clamp01(v.boot * 3))) * 100).toFixed(1)}% 0 0)` : '';
  }
  const captionAt = (v) => clamp01((v.boot - 0.45) / 0.55);
  if (live) visuals.forEach((v) => { bootTag(v); if (v.caption) decrypt(v.caption, 0); });

  // A card boots while its visual comes into view: rising from the bottom of the screen to just above the middle,
  // or sliding in from the right edge until it's almost all in (whichever is further behind). Not "to the middle":
  // on a wide screen the last card stops before it gets there.
  function revealOf(v) {
    const r = v.box.getBoundingClientRect();
    const up = (window.innerHeight - r.top) / (window.innerHeight * 0.55);
    const across = (window.innerWidth - r.left) / (r.width * 0.85);
    return Math.round(clamp01(Math.min(up, across)) * 400) / 400;
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
      const still = paused();
      if (!still) time += dt;
      const boots = [...onScreen].map((v) => (live ? revealOf(v) : v.boot)); // measure everything, then draw
      [...onScreen].forEach((v, k) => {
        const changed = boots[k] !== v.boot;
        v.boot = boots[k];
        if (changed) bootTag(v);
        // the caption's scrambled letters keep flickering while it's half decrypted
        if (v.caption && (changed || (!still && captionAt(v) > 0 && captionAt(v) < 1))) decrypt(v.caption, captionAt(v));
        if (!still || changed) draw(v, time);
      });
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
  if (!live) return; // the normal grid
  gsap.registerPlugin(ScrollTrigger);
  section.classList.add('is-live');
  const count = section.querySelector('.m-count');
  const setCount = (p) => { count.textContent = `${pad(Math.min(n, 1 + Math.floor(p * n)))} / ${pad(n)}`; };
  setCount(0);
  const gutter = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
  // the row's layout width: scrollWidth would also count the cards' entrance transforms (shifted right, tilted)
  const rowWidth = () => track.offsetWidth;

  // The heading, one masked word at a time (it keeps its name for screen readers)
  const label = section.querySelector('.m-label');
  const title = section.querySelector('.m-title');
  const titleText = title.textContent.trim();
  title.setAttribute('aria-label', titleText);
  title.replaceChildren();
  const words = titleText.split(/\s+/).map((word, i) => {
    const mask = make('span', 'm-word');
    mask.setAttribute('aria-hidden', 'true');
    const inner = make('span', null, word);
    mask.append(inner);
    if (i) title.append(' ');
    title.append(mask);
    return inner;
  });
  // The light line along the top edge and the glow under it
  const glow = make('span', 'm-glow'), edge = make('span', 'm-edge');
  glow.setAttribute('aria-hidden', 'true');
  edge.setAttribute('aria-hidden', 'true');
  section.prepend(glow, edge);
  const said = { p: 0 };
  decrypt(label, 0);

  // Arriving: over the screen of scrolling that brings the section up to the top. gsap.from / fromTo set the
  // start states here, so without JS everything is simply there.
  // One tween per word and per card rather than a stagger: in a scrubbed timeline only a stagger's first element
  // gets its start state up front, so the others would sit in place until their turn and then jump.
  const arrive = gsap.timeline({
    defaults: { ease: 'power3.out' },
    scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: 1, invalidateOnRefresh: true },
  })
    .fromTo(edge, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.4, ease: 'power2.inOut' }, 0)
    .to(edge, { opacity: 0, duration: 0.25, ease: 'none' }, 0.9)
    .fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none' }, 0.1)
    .to(said, { p: 1, duration: 0.3, ease: 'none', onUpdate: () => decrypt(label, said.p) }, 0.08)
    .from(count, { opacity: 0, x: 24, duration: 0.25 }, 0.45);
  words.forEach((word, i) => {
    arrive.from(word, { yPercent: 120, rotate: 6, transformOrigin: '0% 100%', duration: 0.4 }, 0.14 + i * 0.1);
  });
  cards.forEach((card, i) => { // dealt in from the right: each swings flat as it lands (hover still lifts it, see missions.css)
    arrive.from(card, {
      x: () => window.innerWidth * 0.6, rotateY: -35, scale: 0.92, opacity: 0,
      transformPerspective: 1100, transformOrigin: '0% 50%', duration: 0.55,
    }, 0.3 + i * 0.08);
  });

  // Pinned: the scroll slides the row left until the last card is in. Function values, so a resize measures again.
  gsap.timeline({
    scrollTrigger: {
      trigger: section, start: 'top top', end: () => `+=${rowWidth()}`,
      pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate: (self) => setCount(self.progress),
    },
  }).to(track, { x: () => -Math.max(0, rowWidth() - window.innerWidth + gutter() * 2), ease: 'none' });

  // The fonts and images change the height of the page above: measure again once they're in
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  if (document.readyState !== 'complete') window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
