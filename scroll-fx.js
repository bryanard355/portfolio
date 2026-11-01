// ===== Scroll effects for the rest of the page =====
// Everything here is scrubbed by the scrollbar: it moves while you scroll, stops when you stop, and plays
// backwards when you scroll back up.
// - Trusted by: "40+" rolls up like an odometer as the section comes in, the "+" pops on at the end, the client
//   cells rise in one by one, and the two columns drift at different speeds.
// - Years: the section pins; the big number spins round once and lands on 5 while it grows and its glow brightens,
//   then the labels slide in from both sides. It rises away and dims as you scroll on.
// - Marquee: follows the scroll (speed and direction) on top of its own slow drift, and leans when you scroll fast.
// - Let's talk: the letters rise out of a mask as the contact section comes in. The footer rows fade up.
// - The big numbers and "Let's talk" lean with your scroll speed and settle when you stop.
// With reduced motion everything stays still. Wrapped in its own scope so its names can't clash with other scripts.
(() => {
  const { gsap, ScrollTrigger } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };
  const clamp = (lo, hi, n) => Math.min(Math.max(n, lo), hi);

  // "Years of 5 Experience" should be read as one phrase, even with no animation
  const years = document.querySelector('.years');
  const yearsNum = years && years.querySelector('.years-num');
  if (yearsNum) {
    years.setAttribute('aria-label', `${yearsNum.textContent.trim()} years of experience`);
    years.querySelectorAll('span').forEach((s) => s.setAttribute('aria-hidden', 'true'));
  }
  if (!gsap || !ScrollTrigger || reduced) return;
  gsap.registerPlugin(ScrollTrigger);

  const toggle = document.getElementById('motion-toggle'); // "Pause motion" (script.js sets aria-pressed="false")
  const paused = () => toggle && toggle.getAttribute('aria-pressed') === 'false';
  const leaners = []; // elements that lean with scroll speed: { el, k, on, last }
  // area: where the element is on screen, as ScrollTrigger vars (it knows about the pinned sections)
  const lean = (el, k, area) => {
    const l = { el, k, on: false, last: 0 };
    ScrollTrigger.create({ ...area, onToggle: (self) => { l.on = self.isActive; } });
    leaners.push(l);
  };

  // ===== Odometer: a number whose digits roll like a counter =====
  // Each digit is a window onto two stacked digits (this one and the next) that slide up as the value grows;
  // the digits are swapped as they pass, so it stays two spans however far it rolls.
  // spin: a single digit goes round once (0–9) before landing on its value
  function odometer(el, spin) {
    const m = el.textContent.trim().match(/^(\D*)(\d+)(\D*)$/);
    if (!m) return null;
    const [, prefix, digits, suffix] = m;
    const target = parseInt(digits, 10);
    const end = spin && target < 10 ? target + 10 : target;
    const cols = target < 10 ? 1 : digits.length;
    const odo = make('span', 'odo');
    odo.setAttribute('aria-hidden', 'true');
    if (prefix) odo.append(make('span', 'odo-fix', prefix));
    const columns = [];
    for (let c = cols - 1; c >= 0; c--) {
      const col = make('span', 'odo-col');
      const strip = make('span', 'odo-strip');
      const now = make('span', null, '0'), next = make('span', null, '1');
      strip.append(now, next);
      col.append(strip);
      odo.append(col);
      columns.push({ unit: 10 ** c, strip, now, next, base: 0 });
    }
    const fix = suffix ? make('span', 'odo-fix', suffix) : null;
    if (fix) odo.append(fix);
    el.replaceChildren(make('span', 'sr-only', el.textContent.trim()), odo);
    el.classList.add('has-odo');
    const o = { odo, fix, end, v: 0 };
    // each step holds the digit still for most of the way, then flips it over (like a counter clicking round),
    // so the number usually reads cleanly wherever the scrolling stops
    const click = (f) => { const t = clamp(0, 1, (f - 0.65) / 0.35); return t * t * (3 - 2 * t); };
    o.set = () => {
      for (const col of columns) {
        // the ones column rolls with the value; a higher column turns over while the one below rolls past 9
        const p = col.unit === 1 ? o.v : Math.floor(o.v / col.unit) + clamp(0, 1, (o.v % col.unit) - (col.unit - 1));
        const base = Math.floor(p);
        if (base !== col.base) {
          col.base = base;
          col.now.textContent = base % 10;
          col.next.textContent = (base + 1) % 10;
        }
        col.strip.style.transform = `translate3d(0, ${(-click(p - base)).toFixed(3)}em, 0)`;
      }
    };
    o.set();
    return o;
  }
  const roll = (o) => ({ v: o.end, onUpdate: o.set });

  // ===== Trusted by =====
  const clients = document.querySelector('.clients');
  if (clients) {
    const stat = clients.querySelector('.clients-stat');
    const num = clients.querySelector('.clients-num');
    const grid = clients.querySelector('.clients-grid');
    const cells = grid.querySelectorAll('li');
    const o = odometer(num, false);
    const tl = gsap.timeline({ scrollTrigger: { trigger: clients, start: 'top 85%', end: 'center 55%', scrub: 1 } });
    tl.from(stat.querySelector('h2'), { y: 24, opacity: 0, duration: 0.2 }, 0)
      .from(num, { yPercent: 40, opacity: 0, duration: 0.3, ease: 'power3.out' }, 0.04);
    if (o) {
      tl.to(o, { ...roll(o), duration: 0.75, ease: 'power2.out' }, 0.08);
      if (o.fix) tl.from(o.fix, { scale: 0, opacity: 0, transformOrigin: '20% 75%', duration: 0.18, ease: 'back.out(3)' }, 0.72);
      lean(o.odo, 1, { trigger: clients, start: 'top bottom', end: 'bottom top' });
    }
    tl.from(stat.querySelectorAll('.clients-what, .clients-note'), { y: 24, opacity: 0, duration: 0.25, stagger: 0.08 }, 0.5)
      .from(cells, { y: 60, opacity: 0, duration: 0.35, stagger: 0.06, ease: 'power3.out' }, 0.12)
      .from(grid.querySelectorAll('img'), { scale: 0.8, duration: 0.35, stagger: 0.06, ease: 'power3.out' }, 0.12)
      .from(clients.querySelector('.clients-you a'), { scale: 0.6, duration: 0.3, ease: 'back.out(2)' }, 0.58);
    // depth: the two columns travel at different speeds the whole way through
    const drift = { trigger: clients, start: 'top bottom', end: 'bottom top', scrub: true };
    gsap.fromTo(stat, { y: 70 }, { y: -70, ease: 'none', scrollTrigger: drift });
    gsap.fromTo(grid, { y: 30 }, { y: -30, ease: 'none', scrollTrigger: { ...drift } });
  }

  // ===== Years =====
  // One timeline for the whole pass, so its phases never fight over the same values. Its length is in screens:
  // 0–1 coming up the screen, 1–2.5 pinned, 2.5–3.5 moving on.
  if (yearsNum) {
    const o = odometer(yearsNum, true);
    const [before, after] = years.querySelectorAll('.years-label');
    const glow = years.querySelector('.years-glow');
    const pin = ScrollTrigger.create({ trigger: years, start: 'top top', end: '+=150%', pin: true });
    const tl = gsap.timeline({
      scrollTrigger: { trigger: years, start: 'top bottom', end: () => pin.end + window.innerHeight, scrub: 1 },
    });
    // coming up the screen: the number rises in, still small
    tl.fromTo(yearsNum, { yPercent: 45, scale: 0.55, opacity: 0 }, { yPercent: 0, scale: 0.72, opacity: 1, duration: 1, ease: 'power2.out' }, 0)
      .fromTo(glow, { opacity: 0, scale: 0.5 }, { opacity: 0.35, scale: 0.8, duration: 1, ease: 'none' }, 0);
    // pinned: it spins round and lands on its value while it grows; then the labels slide in from both sides
    if (o) tl.to(o, { ...roll(o), duration: 0.9, ease: 'power3.out' }, 1);
    tl.to(yearsNum, { scale: 1, duration: 0.9, ease: 'power2.out' }, 1)
      .to(glow, { opacity: 1, scale: 1.15, duration: 0.9, ease: 'power2.out' }, 1)
      .fromTo(before, { xPercent: -80, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 1.65)
      .fromTo(after, { xPercent: 80, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 1.75)
      // moving on: it rises away a little faster than the page and dims
      .to(yearsNum, { yPercent: -25, opacity: 0.2, duration: 1, ease: 'none' }, 2.5)
      .to([before, after], { opacity: 0, duration: 1, ease: 'none' }, 2.5)
      .to(glow, { opacity: 0.15, duration: 1, ease: 'none' }, 2.5);
    if (o) lean(o.odo, 0.7, { trigger: years, start: 'top bottom', end: () => pin.end + window.innerHeight });
  }

  // ===== Contact + footer: created once process.js has pinned its section above them, so they measure right =====
  document.addEventListener('DOMContentLoaded', () => {
    const contact = document.querySelector('.contact');
    const cta = contact && contact.querySelector('.contact-cta');
    if (cta) {
      // "Let's talk" → one masked span per letter (the link keeps its name for screen readers)
      const words = cta.textContent.trim().split(/\s+/);
      cta.setAttribute('aria-label', words.join(' '));
      const inner = make('span', 'cta-in');
      inner.setAttribute('aria-hidden', 'true');
      const letters = [];
      words.forEach((word, i) => {
        if (i) inner.append(' ');
        const w = make('span', 'cta-word');
        for (const ch of word) {
          const mask = make('span', 'cta-mask');
          const letter = make('span', null, ch);
          mask.append(letter);
          w.append(mask);
          letters.push(letter);
        }
        inner.append(w);
      });
      cta.replaceChildren(inner);
      gsap.timeline({ scrollTrigger: { trigger: contact, start: 'top 85%', end: 'top 25%', scrub: 1 } })
        .from(contact.querySelector('p.upper'), { y: 24, opacity: 0, duration: 0.25 }, 0)
        .from(letters, { yPercent: 115, duration: 0.45, stagger: 0.04, ease: 'power3.out' }, 0.08)
        .from(contact.querySelector('.contact-mail'), { y: 24, opacity: 0, duration: 0.25 }, 0.6);
      lean(inner, 0.5, { trigger: contact, start: 'top bottom', end: 'bottom top' });
    }
    const footer = document.querySelector('.site-footer');
    if (footer) {
      gsap.from(footer.querySelectorAll('.foot-row > *, .foot-bottom > *'), {
        y: 32, opacity: 0, stagger: 0.08, ease: 'power2.out',
        scrollTrigger: { trigger: footer, start: 'top bottom', end: 'bottom bottom', scrub: 1 },
      });
    }
  });

  // ===== Marquee: drifts on its own, follows the scroll, leans with speed =====
  const marquee = document.querySelector('.marquee');
  const track = marquee && marquee.querySelector('.marquee-track');
  let mOn = false, mx = 0, mDir = 1, half = 0;
  if (track) {
    marquee.classList.add('is-js'); // turns off the CSS animation: this loop moves it now
    const measure = () => { half = track.scrollWidth / 2; };
    measure();
    new ResizeObserver(measure).observe(track);
    ScrollTrigger.create({ trigger: marquee, start: 'top bottom', end: 'bottom top', onToggle: (self) => { mOn = self.isActive; } });
  }

  // ===== One loop for everything that reacts to scroll speed =====
  let lastY = window.scrollY, vel = 0;
  gsap.ticker.add((time, dtMs) => {
    const y = window.scrollY, dy = y - lastY;
    lastY = y;
    vel += (dy - vel) * 0.18; // smoothed pixels per frame: eases back to 0 when the scrolling stops
    if (mOn && half) {
      if (Math.abs(dy) > 0.5) mDir = dy > 0 ? 1 : -1; // the drift follows the last scroll direction
      mx -= (paused() ? 0 : 60 * (dtMs / 1000) * mDir) + dy * 0.6;
      mx = ((mx % half) - half) % half;
      track.style.transform = `translate3d(${mx.toFixed(1)}px, 0, 0) skewX(${clamp(-14, 14, -vel * 0.5).toFixed(2)}deg)`;
    }
    const tilt = clamp(-10, 10, -vel * 0.35);
    for (const l of leaners) {
      if (!l.on) continue;
      const s = Math.abs(tilt) < 0.02 ? 0 : +(tilt * l.k).toFixed(2);
      if (s === l.last) continue;
      l.last = s;
      l.el.style.transform = s ? `skewY(${s}deg)` : '';
    }
  });
})();
