// ===== Smooth scrolling (Lenis), wired into GSAP's ScrollTrigger =====
// Lenis turns mouse-wheel steps into one smooth glide; ScrollTrigger (works.js, process.js) follows the same scroll.
// Anchor links (#works, #contact…) glide too. Phones keep their own native momentum scrolling, and visitors
// who prefer reduced motion get plain browser scrolling. Other scripts reach it as window.lenis.
(() => {
  const { Lenis, gsap, ScrollTrigger } = window;
  if (!Lenis || !gsap || !ScrollTrigger || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ autoRaf: false, lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000)); // GSAP's clock drives Lenis, so both move in the same frame
  gsap.ticker.lagSmoothing(0);
  window.lenis = lenis;
  // #anchor links glide there instead of the browser's instant jump
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    const target = a && a.hash.length > 1 && document.getElementById(decodeURIComponent(a.hash.slice(1)));
    if (!target || e.defaultPrevented) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.4 });
  });
})();
