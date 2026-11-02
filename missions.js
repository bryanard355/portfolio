// ===== Missions completed: a pinned section whose cards slide sideways as you scroll down =====
// Arriving (scrubbed by the scroll, so it plays backwards on the way up): a blue light line opens across the top of
// the section and the label decrypts itself. The heading itself is always there.
// Pinned: the section pins for as long as the row of cards is wide, the scroll slides the row to the left and the
// counter follows.
// The cards move with the scroll the whole way, rising up the screen at first and then sliding in from the right:
// - coming in, a card swings flat from a 3D turn, grows to full size and fades in (left-hand cards first)
// - just behind that it boots up: its tag wipes in, its visual draws itself (the grid fades up, the wave traces
//   across, the network unfolds node by node), its caption decrypts, then its title, text and chips rise in
// - going out past the left edge, it folds away and dims
// - the whole row leans into the direction it's sliding, harder the faster you scroll, and settles when you stop
// The cards are plain HTML in index.html (#missions). Each visual is a canvas: a faint blue grid with either a moving
// signal wave or a network orbiting its centre (data-visual="wave" | "network"). It only animates while its card is
// on screen, and stands still while "Pause motion" is on.
// Without GSAP, or with reduced motion, nothing pins or moves: the cards stay a normal grid (missions.css).
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
  const clamp = (lo, hi, v) => Math.min(Math.max(v, lo), hi);
  const clamp01 = (v) => clamp(0, 1, v);
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

  // ===== Each card, its visual and the parts that come in as it boots =====
  const BLUE = '30,144,255', ORANGE = '#ff6a2b', WHITE = '#f2f5fb';
  const TAU = Math.PI * 2;
  const items = cards.map((card, i) => {
    const canvas = card.querySelector('.m-canvas');
    return {
      card, canvas, ctx: canvas && canvas.getContext('2d'), box: card.querySelector('.m-visual'), w: 0, h: 0, dpr: 1,
      tag: card.querySelector('.m-tag'), caption: card.querySelector('.m-caption'),
      lines: [card.querySelector('.m-row'), card.querySelector('.m-desc')].filter(Boolean), // title + year, then the text
      chips: [...card.querySelectorAll('.m-chips li')],
      kind: (canvas && canvas.dataset.visual) || (i % 2 ? 'network' : 'wave'),
      seed: i * 1.7, // so neighbouring cards don't move in step
      boot: live ? 0 : 1, // how far the card has booted up: 0 = blank, 1 = all there
      next: live ? 0 : 1, // the boot value for this frame (see move)
      at: 0, top: 0, width: 0, // where the card sits in the row (see measure)
      pose: '', // the last transform written
    };
  });
  const drawn = items.filter((v) => v.ctx);

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

  // Booting, in order: the tag wipes in, the caption decrypts, the title line and the text rise in, then the chips
  // pop up one by one. (The visual draws itself from v.boot, see draw.)
  const captionAt = (v) => clamp01((v.boot - 0.35) / 0.4);
  const rise = (el, t, dist) => { // fades up into place; at t = 1 the inline styles are cleared again
    const e = ease(t);
    el.style.opacity = t < 1 ? e.toFixed(3) : '';
    el.style.translate = t < 1 ? `0 ${((1 - e) * dist).toFixed(1)}px` : '';
  };
  function bootParts(v) {
    if (v.tag) v.tag.style.clipPath = v.boot < 1 ? `inset(0 ${((1 - ease(clamp01(v.boot * 3))) * 100).toFixed(1)}% 0 0)` : '';
    if (v.caption) decrypt(v.caption, captionAt(v));
    v.lines.forEach((el, k) => rise(el, clamp01((v.boot - 0.3 - k * 0.12) / 0.35), 18));
    // however many chips, the last one is in place exactly as the boot ends
    v.chips.forEach((el, k) => rise(el, clamp01((v.boot - 0.5 - (k / Math.max(1, v.chips.length - 1)) * 0.25) / 0.25), 10));
  }
  if (live) items.forEach(bootParts);

  // ===== Card motion (only when live) =====
  // Where each card sits in the row, so a frame only has to read where the row is (GSAP slides it)
  function measure() {
    for (const v of items) {
      v.at = v.card.offsetLeft;
      v.top = v.card.offsetTop;
      v.width = v.card.offsetWidth;
    }
  }
  // enter: 0 = not in yet (turned, small, invisible), 1 = in place. out: 0 = in place, 1 = folded away past the left
  function pose(v, enter, out, skew) {
    const e = ease(enter), o = ease(out);
    let t = '', op = '', origin = '';
    if (e < 1) {
      t = `perspective(1100px) translate3d(${((1 - e) * v.width * 0.5).toFixed(1)}px, ${((1 - e) * 40).toFixed(1)}px, 0) `
        + `rotateY(${(-35 * (1 - e)).toFixed(2)}deg) scale(${(0.88 + 0.12 * e).toFixed(4)})`;
      op = clamp01(e * 1.4).toFixed(3);
      origin = '0% 50%';
    } else if (o > 0) {
      t = `perspective(1100px) rotateY(${(28 * o).toFixed(2)}deg) scale(${(1 - 0.1 * o).toFixed(4)})`;
      op = (1 - 0.75 * o).toFixed(3);
      origin = '100% 50%';
    }
    if (skew) t += ` skewX(${skew.toFixed(2)}deg)`;
    if (t === v.pose) return;
    v.pose = t;
    v.card.style.transform = t;
    v.card.style.opacity = op === '1.000' ? '' : op;
    v.card.style.transformOrigin = origin;
  }
  // Every card's state for this frame, from where it would sit on screen without its own animation:
  // it comes in while rising from the bottom of the screen to above the middle (cards further right a little later),
  // or while sliding in from the right edge until it's almost all in, whichever is further behind
  let lean = 0, lastLeft = null;
  function move() {
    const row = track.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const dx = lastLeft === null ? 0 : row.left - lastLeft;
    lastLeft = row.left;
    lean += (dx - lean) * 0.2; // smoothed pixels per frame the row is sliding: back to 0 when the scrolling stops
    const skew = Math.abs(lean) < 0.05 ? 0 : clamp(-6, 6, -lean * 0.18);
    for (const v of items) {
      const left = row.left + v.at, top = row.top + v.top;
      const up = (vh - top) / (vh * 0.5) - (left / vw) * 0.4;
      const across = (vw - left) / (v.width * 0.85);
      const raw = Math.min(up, across);
      v.next = Math.round(clamp01((raw - 0.3) / 0.7) * 400) / 400; // boots just behind coming in
      pose(v, clamp01(raw / 0.8), clamp01(-left / v.width), skew);
    }
  }

  // ===== One loop: card motion (while the section is in play), then the visuals on screen =====
  // It stops altogether when there's nothing to do, to save battery
  let time = 0, raf = 0, last = 0, inPlay = false;
  const onScreen = new Set();
  const running = () => (live ? inPlay : onScreen.size > 0);
  function frame(now) {
    raf = running() ? requestAnimationFrame(frame) : 0;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const still = paused();
    if (!still) time += dt;
    if (live) move();
    step(still);
  }
  function step(still) { // boot changes, the caption's flicker, then the canvases on screen
    for (const v of items) {
      const changed = v.next !== v.boot;
      v.boot = v.next;
      if (changed) bootParts(v);
      // the caption's scrambled letters keep flickering while it's half decrypted
      else if (v.caption && !still && captionAt(v) > 0 && captionAt(v) < 1) decrypt(v.caption, captionAt(v));
      if (v.ctx && onScreen.has(v) && (!still || changed)) draw(v, time);
    }
  }
  function wake() {
    if (raf || !running()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // The canvases follow their boxes (sharp on high-density screens, at most 2x) and redraw straight away,
  // so a still frame is there even when nothing animates
  const resizer = new ResizeObserver((entries) => {
    for (const e of entries) {
      const v = drawn.find((x) => x.canvas === e.target);
      v.w = v.canvas.clientWidth;
      v.h = v.canvas.clientHeight;
      v.dpr = Math.min(window.devicePixelRatio || 1, 2);
      v.canvas.width = Math.round(v.w * v.dpr);
      v.canvas.height = Math.round(v.h * v.dpr);
      draw(v, time);
    }
  });
  drawn.forEach((v) => resizer.observe(v.canvas));
  if (!reduced) {
    const watcher = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const v = drawn.find((x) => x.box === e.target);
        if (e.isIntersecting) onScreen.add(v);
        else onScreen.delete(v);
      }
      wake();
    });
    drawn.forEach((v) => watcher.observe(v.box));
  }

  // ===== Scroll =====
  if (!live) return; // the normal grid
  gsap.registerPlugin(ScrollTrigger);
  section.classList.add('is-live');
  const count = section.querySelector('.m-count');
  const setCount = (p) => { count.textContent = `${pad(Math.min(n, 1 + Math.floor(p * n)))} / ${pad(n)}`; };
  setCount(0);
  const gutter = () => parseFloat(getComputedStyle(track).paddingLeft) || 0;
  // the row's layout width: scrollWidth would also count the cards' own animation (shifted right, turned)
  const rowWidth = () => track.offsetWidth;

  const label = section.querySelector('.m-label');
  // The light line along the top edge and the glow under it
  const glow = make('span', 'm-glow'), edge = make('span', 'm-edge');
  glow.setAttribute('aria-hidden', 'true');
  edge.setAttribute('aria-hidden', 'true');
  section.prepend(glow, edge);
  const said = { p: 0 };
  decrypt(label, 0);

  // Arriving: over the screen of scrolling that brings the section up to the top. gsap.from / fromTo set the
  // start states here, so without JS everything is simply there.
  gsap.timeline({
    defaults: { ease: 'power3.out' },
    scrollTrigger: { trigger: section, start: 'top bottom', end: 'top top', scrub: 1 },
  })
    .fromTo(edge, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.4, ease: 'power2.inOut' }, 0)
    .to(edge, { opacity: 0, duration: 0.25, ease: 'none' }, 0.9)
    .fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'none' }, 0.1)
    .to(said, { p: 1, duration: 0.3, ease: 'none', onUpdate: () => decrypt(label, said.p) }, 0.08)
    .from(count, { opacity: 0, x: 24, duration: 0.25 }, 0.45);

  // Pinned: the scroll slides the row left until the last card is in. Function values, so a resize measures again.
  gsap.timeline({
    scrollTrigger: {
      trigger: section, start: 'top top', end: () => `+=${rowWidth()}`,
      pin: true, scrub: 1, invalidateOnRefresh: true,
      onUpdate: (self) => setCount(self.progress),
    },
  }).to(track, { x: () => -Math.max(0, rowWidth() - window.innerWidth + gutter() * 2), ease: 'none' });

  // The cards move while the section is in play: from its top reaching the bottom of the screen, through the pin,
  // until it has scrolled away (outside that they can't be seen). They start out not in yet.
  measure();
  items.forEach((v) => pose(v, 0, 0, 0));
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: () => `+=${window.innerHeight * 2 + rowWidth()}`,
    onToggle: (self) => {
      inPlay = self.isActive;
      if (inPlay) { // the row may have moved a long way since the last visit: that's not sliding speed
        lean = 0;
        lastLeft = null;
      }
      wake();
    },
    onRefresh: measure,
  });

  // The fonts and images change the height of the page above: measure again once they're in
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  if (document.readyState !== 'complete') window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
})();
