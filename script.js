// ===== Settings =====
const PARTICLES = window.innerWidth < 700 ? 6000 : 9000; // fewer on phones
const DOT_COLOR = '237,237,237';

// ===== Elements =====
const scene = document.getElementById('scene');
const ctx = scene.getContext('2d');
const grain = document.getElementById('grain');
const gctx = grain.getContext('2d');
const toggle = document.getElementById('motion-toggle');
const hero = document.querySelector('.hero');
const headline = document.querySelector('.headline');
document.getElementById('year').textContent = new Date().getFullYear();

let motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===== Build a torus knot made of particles =====
function buildPoints(n) {
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.random() * Math.PI * 2;
    const r = Math.cos(3 * t) + 2.2;
    const cx = r * Math.cos(2 * t), cy = r * Math.sin(2 * t), cz = -Math.sin(3 * t) * 1.1;
    const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1);
    const rad = 0.42 * Math.cbrt(Math.random());
    pts[i * 3] = cx + rad * Math.sin(v) * Math.cos(u);
    pts[i * 3 + 1] = cy + rad * Math.sin(v) * Math.sin(u);
    pts[i * 3 + 2] = cz + rad * Math.cos(v);
  }
  return pts;
}
const pts = buildPoints(PARTICLES);

// ===== Mouse + drag =====
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
const drag = { on: false, lx: 0, ly: 0, vx: 0, vy: 0, rx: 0, ry: 0 };

scene.addEventListener('pointermove', (e) => {
  const r = scene.getBoundingClientRect();
  mouse.tx = (e.clientX - r.left) / r.width * 2 - 1;
  mouse.ty = (e.clientY - r.top) / r.height * 2 - 1;
  if (drag.on) {
    drag.vy = (e.clientX - drag.lx) * 0.006;
    drag.vx = (e.clientY - drag.ly) * 0.006;
    drag.lx = e.clientX; drag.ly = e.clientY;
  }
});
scene.addEventListener('pointerdown', (e) => {
  drag.on = true; drag.lx = e.clientX; drag.ly = e.clientY; scene.style.cursor = 'grabbing';
});
window.addEventListener('pointerup', () => { drag.on = false; scene.style.cursor = 'grab'; });

// ===== Render the 3D scene =====
const t0 = performance.now();
function renderScene(now) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = scene.clientWidth, H = scene.clientHeight;
  if (scene.width !== Math.round(W * dpr) || scene.height !== Math.round(H * dpr)) {
    scene.width = Math.round(W * dpr); scene.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const t = (now - t0) / 1000;
  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  drag.ry += 0.0025 + drag.vy; drag.rx += drag.vx;
  drag.vx *= 0.94; drag.vy *= 0.94;

  const scrollTilt = window.scrollY * 0.0015;
  const ay = drag.ry + mouse.x * 0.5;
  const ax = drag.rx + 0.5 + mouse.y * 0.35 + scrollTilt;
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const scale = Math.min(W, H) * 0.16 * (W < 700 ? 1.15 : 1);
  const ox = W / 2, oy = H / 2;
  const buckets = [[], [], [], []];

  for (let i = 0; i < PARTICLES; i++) {
    let x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
    const wob = 1 + 0.06 * Math.sin(y * 2.2 + t * 1.6) + 0.04 * Math.sin(x * 3 + t);
    x *= wob; y *= wob; z *= wob;
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
    const f = 6 / (6 + z2);
    const depth = (z2 + 3.4) / 6.8;
    const b = Math.max(0, Math.min(3, Math.floor((1 - depth) * 4)));
    buckets[b].push(ox + x1 * f * scale, oy + y2 * f * scale, f);
  }

  const alphas = [0.12, 0.28, 0.5, 0.85];
  for (let b = 0; b < 4; b++) {
    const arr = buckets[b];
    ctx.fillStyle = `rgba(${DOT_COLOR},${alphas[b]})`;
    ctx.beginPath();
    for (let j = 0; j < arr.length; j += 3) {
      const s = 1.1 * arr[j + 2];
      ctx.rect(arr[j], arr[j + 1], s, s);
    }
    ctx.fill();
  }
}

// ===== Film grain =====
const tile = document.createElement('canvas');
tile.width = tile.height = 160;
const tctx = tile.getContext('2d');
function drawGrain() {
  const w = Math.ceil(grain.clientWidth / 2), h = Math.ceil(grain.clientHeight / 2);
  if (grain.width !== w || grain.height !== h) { grain.width = w; grain.height = h; }
  const img = tctx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  tctx.putImageData(img, 0, 0);
  gctx.fillStyle = gctx.createPattern(tile, 'repeat');
  gctx.fillRect(0, 0, w, h);
}

// ===== Name: split into letters =====
// Each line is cut into words (at spaces and after hyphens, so "Owusu-Ansah" can stack on phones)
// and each word into letters, so every letter can move on its own.
const chars = [];
headline.setAttribute('aria-label', headline.textContent.trim().replace(/\s+/g, ' '));
headline.querySelectorAll('.headline-line').forEach((line) => {
  const words = line.textContent.trim().match(/[^\s-]*-|[^\s-]+/g);
  line.textContent = '';
  line.setAttribute('aria-hidden', 'true');
  words.forEach((word, w) => {
    if (w && !words[w - 1].endsWith('-')) line.append(' ');
    const wordEl = document.createElement('span');
    wordEl.className = 'word';
    for (const letter of word) {
      const el = document.createElement('span');
      el.className = 'char';
      el.textContent = letter;
      el.style.setProperty('--i', chars.length);
      wordEl.append(el);
      chars.push({ el, x: 0, y: 0, v: 0, shown: 0, drop: 0, kern: 0 });
    }
    line.append(wordEl);
  });
});

// Splitting loses the font's kerning (you'd see a gap in "YA"), so measure it and put it back as margins
function kernName() {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden';
  headline.append(probe);
  const width = (text) => { probe.textContent = text; return probe.getBoundingClientRect().width; };
  const size = parseFloat(getComputedStyle(headline).fontSize);
  for (const c of chars) {
    const a = c.el.textContent, next = c.el.nextElementSibling; // next letter in the same word
    c.kern = next ? (width(a + next.textContent) - width(a) - width(next.textContent)) / size : 0;
    shapeChar(c, c.shown, c.drop);
  }
  probe.remove();
}

// v: 0 = at rest, 1 = fully squeezed. drop: how far (%) the letter has sunk back into its mask.
function shapeChar(c, v, drop) {
  c.shown = v;
  c.drop = drop;
  c.el.style.fontStretch = `${125 - 63 * v}%`;
  c.el.style.fontWeight = 900 - 400 * v;
  c.el.style.marginRight = `${c.kern * (1 - v / 2)}em`; // narrower letters need less kerning
  c.el.style.translate = `0 ${drop}%`;
}

// ===== Name: intro =====
// Starts once the font has loaded (or after 1.5s), so the letters don't jump when it swaps in
const fontsIn = document.fonts ? document.fonts.load('900 1em Archivo').catch(() => {}) : Promise.resolve();
let nameLive = false, nameDirty = true, nameT0 = 0;
function startName() {
  kernName();
  hero.classList.add('is-in');
  if (motion) chars[chars.length - 1].el.addEventListener('animationend', goLive, { once: true });
  else goLive();
}
function goLive() { nameLive = true; nameDirty = true; nameT0 = performance.now(); }
// The welcome screen (welcome.js) covers the page first: the name animates in as it leaves
const welcomeDone = window.welcomeDone || Promise.resolve();
if (motion) Promise.all([Promise.race([fontsIn, new Promise((r) => setTimeout(r, 1500))]), welcomeDone]).then(startName);
else startName();
fontsIn.then(() => { kernName(); nameDirty = true; }); // again, in case the font arrived late

// ===== Name: letters squeeze near the cursor, and a wave runs through them every few seconds =====
const pointer = { x: -1e4, y: -1e4 };
window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) pointer.x = pointer.y = -1e4; });

let nameSize = 100, nameLeft = 0, nameRight = 0;
function restName() {
  for (const c of chars) { c.v = 0; shapeChar(c, 0, 0); }
}
function measureName() { // where each letter sits at rest, relative to the hero
  restName();
  const h = hero.getBoundingClientRect();
  for (const c of chars) {
    const r = c.el.getBoundingClientRect();
    c.x = r.left + r.width / 2 - h.left;
    c.y = r.top + r.height / 2 - h.top;
  }
  nameSize = parseFloat(getComputedStyle(headline).fontSize);
  nameLeft = Math.min(...chars.map((c) => c.x));
  nameRight = Math.max(...chars.map((c) => c.x));
  nameDirty = false;
}

function renderName(now) {
  const h = hero.getBoundingClientRect();
  if (h.bottom < 0) return;
  if (nameLive && nameDirty) measureName();
  const radius = nameSize * 1.6;
  const cycle = ((now - nameT0) / 1000 + 5) % 7; // a 2.2s wave every 7s, the first 2s after the intro
  const front = nameLeft - nameSize * 2 + (cycle / 2.2) * (nameRight - nameLeft + nameSize * 4);
  chars.forEach((c, i) => {
    let k = 0;
    if (nameLive) {
      const d = Math.hypot(pointer.x - h.left - c.x, pointer.y - h.top - c.y);
      k = Math.max(0, 1 - d / radius);
      k = k * k * (3 - 2 * k);
      if (cycle < 2.2) k = Math.max(k, 0.7 * Math.exp(-(((c.x - front) / (nameSize * 1.4)) ** 2)));
    }
    c.v += (k - c.v) * 0.12;
    // Scrolling clears the name: letter by letter, each one deflates and sinks back into its mask
    let e = clamp01((clear - (i / (chars.length - 1)) * 0.65) / 0.35);
    e = e * e * (3 - 2 * e);
    const v = Math.round(Math.max(c.v, e) * 200) / 200; // only touch the DOM when a value really changes
    const drop = Math.round(e * 200) / 2;
    if (v !== c.shown || drop !== c.drop) shapeChar(c, v, drop);
  });
}

// ===== Scroll: your name clears, then About rises up over the pinned hero =====
const intro = document.querySelector('.intro');
const heroMeta = document.querySelector('.hero-meta');
const clamp01 = (n) => Math.min(Math.max(n, 0), 1);
let clear = 0; // how far the name has cleared: 0 = all there, 1 = gone (eases after the scroll position)

// Every About word sits in a mask and rises out of it as it scrolls into view; the cards fade up
const reveals = [];
document.querySelectorAll('.about .label, .about-lead').forEach((block) => {
  const words = block.textContent.trim().split(/\s+/);
  block.textContent = '';
  words.forEach((word, i) => {
    if (i) block.append(' ');
    const mask = document.createElement('span');
    const inner = document.createElement('span');
    mask.className = 'mask';
    inner.textContent = word;
    mask.append(inner);
    block.append(mask);
    reveals.push({ box: mask, el: inner, top: 0, x: 0, shown: -1 });
  });
});
document.querySelectorAll('.svc-card').forEach((el) => reveals.push({ box: el, el, fade: true, top: 0, x: 0, shown: -1 }));

let introTop = 0, revealDirty = true, lastScroll = '';
fontsIn.then(() => { revealDirty = true; }); // the font changes where the text wraps
function measureReveals() { // where everything sits on the page, without its scroll offsets
  for (const r of reveals) r.el.style.translate = '';
  for (const r of reveals) {
    const b = r.box.getBoundingClientRect();
    r.top = b.top + scrollY;
    r.x = b.left;
    r.shown = -1;
  }
  introTop = intro.getBoundingClientRect().top + scrollY;
  revealDirty = false;
  lastScroll = '';
}

function renderScroll() {
  if (revealDirty) measureReveals();
  const vh = innerHeight, y = scrollY - introTop;
  const p = clamp01(y / (vh * 0.6)); // the name is gone after 60% of a screen of scrolling
  clear = motion && Math.abs(p - clear) > 0.001 ? clear + (p - clear) * 0.15 : p;
  const key = `${y} ${vh} ${motion}`;
  if (key === lastScroll) return; // nothing else changes until the page scrolls
  lastScroll = key;
  heroMeta.style.opacity = 1 - clamp01(y / (vh * 0.25));
  headline.style.opacity = motion ? '' : 1 - p; // with motion paused the name simply fades
  scene.style.opacity = 1 - 0.6 * clamp01((y - vh * 0.25) / (vh * 0.75)); // dim the knot behind About
  for (const r of reveals) {
    // Rises in while travelling from 92% to 72% of the screen height (words further right a touch later)
    const t = motion ? Math.round(clamp01((vh * 0.92 - (r.top - scrollY) - r.x * 0.05) / (vh * 0.2)) * 100) / 100 : 1;
    if (t === r.shown) continue;
    r.shown = t;
    const e = 1 - (1 - t) ** 3;
    if (r.fade) {
      r.el.style.opacity = e;
      r.el.style.translate = `0 ${(1 - e) * 40}px`;
    } else {
      r.el.style.translate = `0 ${(1 - e) * 110}%`;
    }
  }
}

// ===== Menu: the ☰ button opens a full-screen menu =====
const menuBtn = document.querySelector('.menu-btn');
const menu = document.getElementById('site-menu');
const page = document.querySelector('.page');
function setMenu(open, refocus) {
  menu.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  page.inert = open; // the page behind it can't be tabbed into
  if (window.lenis) { if (open) window.lenis.stop(); else window.lenis.start(); }
  else document.documentElement.style.overflow = open ? 'hidden' : '';
  if (open) menu.querySelector('a').focus({ preventScroll: true });
  else if (refocus) menuBtn.focus({ preventScroll: true });
}
if (menuBtn && menu) {
  menuBtn.addEventListener('click', () => setMenu(true));
  menu.querySelector('.menu-close').addEventListener('click', () => setMenu(false, true));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); }); // then the link scrolls there
  menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false, true); });
}

// ===== Main loop =====
let frame = 0;
let covered = !!window.welcomeDone; // the hero is hidden behind the welcome screen: no need to draw it yet
welcomeDone.then(() => { covered = false; });
function loop(now) {
  requestAnimationFrame(loop);
  renderScroll(); // runs even with motion paused: the visitor is the one scrolling
  if (!motion) return;
  if (!covered) {
    renderScene(now);
    renderName(now);
  }
  if (frame++ % 3 === 0) drawGrain();
}
renderScene(performance.now());
drawGrain();
requestAnimationFrame(loop);

window.addEventListener('resize', () => {
  renderScene(performance.now()); drawGrain(); nameDirty = true; revealDirty = true;
});

// ===== Motion toggle =====
function updateToggle() {
  toggle.textContent = motion ? '[ ..... Pause motion ]' : '[ · Play motion ]';
  toggle.setAttribute('aria-pressed', String(motion));
}
toggle.addEventListener('click', () => { motion = !motion; updateToggle(); if (!motion) restName(); });
updateToggle();
