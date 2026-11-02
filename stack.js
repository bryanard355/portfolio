// ===== The stack: a pinned section where giant words slide past behind a heading =====
// As the section comes up the screen a row of huge, faint words (one drawn as a blue outline) starts sliding from
// right to left. The section then pins for 1.8 screens while the row keeps sliding: the heading scales in, the blue
// bar under it fills from left to right and the paragraph lights up word by word.
// Everything is scrubbed by the scroll, so it plays backwards on the way up.
// The words and the text are plain HTML in index.html (#stack). Without GSAP, or with reduced motion, nothing pins
// or moves: the section is one still screen with everything in place (stack.css).
// missions.js and process.js already refresh ScrollTrigger once the fonts and images are in, which re-measures this too.
// Wrapped in its own scope so its names can't clash with the other scripts.
(() => {
  const section = document.getElementById('stack');
  const { gsap, ScrollTrigger } = window;
  if (!section || !gsap || !ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  section.classList.add('is-live');

  const row = section.querySelector('.s-row');
  const label = section.querySelector('.s-label');
  const title = section.querySelector('.s-title');
  const fill = section.querySelector('.s-bar > span');
  const text = section.querySelector('.s-text');

  // ===== Word-by-word reveal =====
  // Each word becomes its own span (the spaces stay plain text, so screen readers still read one sentence).
  // They're dimmed here rather than in the CSS, so without JS the text is simply there.
  function splitWords(el, dim) {
    const words = el.textContent.trim().split(/\s+/);
    el.replaceChildren();
    const spans = words.map((word, i) => {
      if (i) el.append(' ');
      const span = document.createElement('span');
      span.textContent = word;
      el.append(span);
      return span;
    });
    gsap.set(spans, { opacity: dim });
    return spans;
  }
  const words = text ? splitWords(text, 0.16) : [];

  // ===== Scroll =====
  // Like Years in scroll-fx.js: one timeline for the whole pass, measured in screens:
  // 0–1 coming up the screen, 1–2.8 pinned.
  const PIN = 1.8;
  const pin = ScrollTrigger.create({ trigger: section, start: 'top top', end: `+=${PIN * 100}%`, pin: true });
  const tl = gsap.timeline({
    defaults: { ease: 'power3.out' },
    scrollTrigger: { trigger: section, start: 'top bottom', end: () => pin.end, scrub: 1, invalidateOnRefresh: true },
  });
  // The row travels from just inside the right edge until its last word is almost past the left one.
  // Function values, so a resize (or the font arriving) measures it again.
  tl.fromTo(row, { x: () => window.innerWidth * 0.15 }, {
    x: () => -(row.offsetWidth - window.innerWidth * 0.85), duration: 1 + PIN, ease: 'none',
  }, 0)
    .fromTo(title, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8 }, 0.55)
    .fromTo(label, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.8)
    .fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'none' }, 1);
  if (words.length) tl.to(words, { opacity: 1, duration: 0.25, ease: 'none', stagger: 1 / words.length }, 1.3);
})();
