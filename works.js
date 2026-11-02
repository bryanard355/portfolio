// ===== Selected works: pinned, scroll-driven showcase =====
// The section pins for one screen of scrolling per project, and scrolling moves through the projects.
// Each project is a scene: a big visual that slowly zooms and drifts, a huge headline that rises in line by line,
// a blue subtitle, and an optional sentence that wipes in and lights up word by word as you scroll.
// A segmented bar tracks progress (its chapter labels jump to their projects) and "View project" follows the scene.
// Everything is built from PROJECTS below; without GSAP the projects show as a plain stacked list.
// Wrapped in its own scope so its names can't clash with the other scripts.
(() => {
  // ===== Projects: edit these =====
  // title: "\n" starts a new line. subtitle: role or category. description: optional, 2–3 lines.
  // image: a screenshot or mockup (or video: 'file.mp4' plus poster: 'file.jpg'); alt describes it.
  // chapter: neighbouring projects with the same chapter share one label in the progress bar.
  // align: where the headline sits, 'left', 'right' or 'center'. link: where "View project" goes.
  const PROJECTS = [
    {
      title: 'Immersive\nweb', subtitle: 'WebGL site · [YEAR]', chapter: 'Web', align: 'left', link: '#',
      image: 'works/immersive-web.svg', alt: 'Wireframe globe inside a browser window',
      description: '[Two or three lines about the project: the brief, what you built and the result.]',
    },
    {
      title: 'MediCore', subtitle: 'Web app · [YEAR]', chapter: 'Web', align: 'right', link: '#',
      image: 'works/medicore.png', alt: 'MediCore admin dashboard: revenue chart, patient and appointment stats and a weekly calendar',
      description: 'A hospital admin console that brings patients, staff, appointments, records and supplies into one dashboard, with revenue and analytics at a glance.',
    },
    {
      title: 'Brand\nredesign', subtitle: 'Brand + web · [YEAR]', chapter: 'Branding', align: 'center', link: '#',
      image: 'works/brand-redesign.svg', alt: 'Logo construction grid, colour swatches and a type specimen',
      description: '[Two or three lines about the project: the brief, what you built and the result.]',
    },
    {
      title: 'Interactive\nstory', subtitle: 'Interactive · [YEAR]', chapter: 'Lab', align: 'left', link: '#',
      image: 'works/interactive-story.svg', alt: 'Tablet showing a branching story path',
    },
    {
      title: 'Code\nexperiment', subtitle: 'Experiment · [YEAR]', chapter: 'Lab', align: 'right', link: '#',
      image: 'works/code-experiment.svg', alt: 'Flow field of glowing lines next to a terminal window',
      description: '[Two or three lines about the project: the brief, what you built and the result.]',
    },
  ];
  const STEPS = 4;   // progress-bar segments per project
  const SCREENS = 1; // scrolling per project, in screen heights

  const section = document.getElementById('works');
  const stage = section && section.querySelector('.works-stage');
  if (!stage) return;
  const { gsap, ScrollTrigger } = window;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = PROJECTS.length;
  const pad = (n) => String(n).padStart(2, '0');
  const clamp01 = (n) => Math.min(Math.max(n, 0), 1);
  const make = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };

  // ===== Build one scene per project =====
  const bar = stage.querySelector('.w-bar');
  const scenes = PROJECTS.map((p, i) => {
    const scene = make('article', 'w-scene');
    scene.dataset.align = p.align || ['left', 'right', 'center'][i % 3];
    const figure = make('figure', 'w-visual');
    const inner = make('div', 'w-visual-inner');
    const media = make(p.video ? 'video' : 'img');
    if (p.video) {
      Object.assign(media, { muted: true, loop: true, playsInline: true, preload: 'none' });
      if (p.alt) media.setAttribute('aria-label', p.alt);
    } else {
      Object.assign(media, { alt: p.alt || '', decoding: 'async' });
    }
    inner.append(media);
    figure.append(inner);

    const text = make('div', 'w-text');
    const head = make('div', 'w-head');
    const num = make('p', 'w-ui w-num', `${pad(i + 1)} — ${p.chapter}`);
    const title = make('h3', 'w-title');
    const lines = p.title.split('\n').map((line) => {
      const mask = make('span', 'w-line');
      const span = make('span', null, line);
      mask.append(span);
      title.append(mask, ' ');
      return span;
    });
    const sub = make('p', 'w-sub');
    const subIn = make('span', null, p.subtitle);
    sub.append(subIn);
    head.append(num, title, sub);
    text.append(head);

    const s = { i, p, scene, figure, inner, media, num, lines, sub: subIn, desc: null, wipe: null, wipeIn: null, words: [], loaded: false };
    if (p.description) {
      // the sentence sits in a window (wipe) that slides in from the left while the words inside stay put
      s.desc = make('p', 'w-desc');
      s.wipe = make('span', 'w-wipe');
      s.wipeIn = make('span', 'w-wipe-in');
      p.description.split(/\s+/).forEach((word, k) => {
        if (k) s.wipeIn.append(' ');
        const w = make('span', 'w-word', word);
        s.wipeIn.append(w);
        s.words.push(w);
      });
      s.wipe.append(s.wipeIn);
      s.desc.append(s.wipe);
      text.append(s.desc);
    }
    scene.append(figure, text);
    stage.insertBefore(scene, bar);
    return s;
  });
  stage.querySelector('.w-count-all').textContent = pad(N);

  function load(i) { // visuals load just before they're needed: the scene on screen and its neighbours
    for (const s of [scenes[i], scenes[i + 1], scenes[i - 1]]) {
      if (!s || s.loaded) continue;
      s.loaded = true;
      if (s.p.video) {
        if (s.p.poster) s.media.poster = s.p.poster;
        s.media.preload = 'auto';
        s.media.src = s.p.video;
      } else {
        s.media.src = s.p.image;
      }
    }
  }

  if (!gsap || !ScrollTrigger) { // no GSAP: keep the stacked list, with every visual loaded
    scenes.forEach((s) => load(s.i));
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  section.classList.add('is-live');
  new IntersectionObserver((entries, io) => { // start loading a screen before the section arrives
    if (!entries[0].isIntersecting) return;
    load(0);
    io.disconnect();
  }, { rootMargin: '100% 0px' }).observe(section);

  // ===== Progress bar: a label for each chapter, followed by its segments =====
  const chapters = [];
  PROJECTS.forEach((p, i) => {
    const last = chapters[chapters.length - 1];
    if (last && last.name === p.chapter) last.end = i + 1;
    else chapters.push({ name: p.chapter, start: i, end: i + 1 });
  });
  const segs = [];
  for (const c of chapters) {
    c.tab = make('button', 'w-tab');
    c.tab.type = 'button';
    c.tab.setAttribute('aria-label', `${c.name}: go to project ${c.start + 1}`);
    c.tab.append(make('span', null, c.name));
    bar.append(c.tab);
    for (let k = c.start * STEPS; k < c.end * STEPS; k++) {
      const seg = make('i', 'w-seg');
      seg.setAttribute('aria-hidden', 'true');
      bar.append(seg);
      segs.push(seg);
    }
  }
  const cta = stage.querySelector('.w-cta');
  const countNow = stage.querySelector('.w-count-now');

  // ===== Switching scenes: the old headline leaves through its mask, the new one rises in line by line,
  // and the visuals cross-fade through a slight blur =====
  let current = -1;
  const parts = (s) => [s.scene, s.figure, s.num, s.sub, s.desc, ...s.lines].filter(Boolean);
  function hide(s) {
    gsap.killTweensOf(parts(s));
    gsap.set(s.scene, { autoAlpha: 0 });
  }
  function enter(s, dir) {
    gsap.killTweensOf(parts(s));
    gsap.set(s.scene, { autoAlpha: 1, zIndex: 2 });
    if (reduced) {
      gsap.fromTo(s.scene, { opacity: 0 }, { opacity: 1, duration: 0.4 });
      return;
    }
    // clearProps: once sharp, drop the filter entirely (even blur(0px) keeps the browser filtering every frame)
    gsap.fromTo(s.figure, { opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)', duration: 1, ease: 'power2.out', clearProps: 'filter' });
    gsap.fromTo(s.lines, { yPercent: 110 * dir, opacity: 1 }, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.12 });
    gsap.fromTo(s.sub, { yPercent: 110 * dir }, { yPercent: 0, duration: 0.8, ease: 'expo.out', delay: 0.32 });
    gsap.fromTo([s.num, s.desc].filter(Boolean), { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.25 });
  }
  function leave(s, dir) {
    gsap.killTweensOf(parts(s));
    gsap.set(s.scene, { zIndex: 1 });
    if (reduced) {
      gsap.to(s.scene, { autoAlpha: 0, duration: 0.4 });
      return;
    }
    gsap.to(s.lines, { yPercent: -110 * dir, opacity: 0, duration: 0.55, ease: 'power3.in', stagger: 0.05 });
    gsap.to(s.sub, { yPercent: -110 * dir, duration: 0.45, ease: 'power3.in' });
    gsap.to([s.num, s.desc].filter(Boolean), { opacity: 0, duration: 0.3 });
    gsap.to(s.figure, { opacity: 0, filter: 'blur(8px)', duration: 0.8, ease: 'power2.inOut', onComplete: () => hide(s) });
  }
  function show(next) {
    if (next === current) return;
    const prev = current;
    const dir = next > prev ? 1 : -1; // scrolling back plays the switch the other way round
    current = next;
    for (const s of scenes) if (s.i !== prev && s.i !== next) hide(s);
    if (prev >= 0) leave(scenes[prev], dir);
    if (next < 0) return;
    const s = scenes[next];
    enter(s, dir);
    load(next);
    countNow.textContent = pad(next + 1);
    cta.href = s.p.link || '#';
    cta.setAttribute('aria-label', `View project: ${s.p.title.replace(/\n/g, ' ')}`);
    for (const v of scenes) {
      if (!v.p.video) continue;
      if (v === s && !reduced) v.media.play().catch(() => {});
      else v.media.pause();
    }
  }

  // ===== Scrubbed by the scroll: zoom + drift, the sentence's wipe and word-by-word light-up, the bar =====
  function scrub(P) {
    const x = P * N; // 0 → N across the pinned scroll; project i owns x from i to i + 1
    for (const s of scenes) {
      if (x < s.i - 1.2 || x > s.i + 2.2) continue; // off screen: nothing to update
      const local = clamp01(x - s.i);
      if (!reduced) s.inner.style.transform = `translate3d(0, ${((0.5 - local) * 5).toFixed(2)}%, 0) scale(${(1.1 - 0.1 * local).toFixed(4)})`;
      if (!s.words.length) continue;
      const w = reduced ? 1 : clamp01((local - 0.04) / 0.2);
      s.wipe.style.transform = `translate3d(${((w - 1) * 100).toFixed(2)}%, 0, 0)`;
      s.wipeIn.style.transform = `translate3d(${((1 - w) * 100).toFixed(2)}%, 0, 0)`;
      s.words.forEach((word, k) => {
        const t = reduced ? 1 : clamp01((local - 0.12 - (k / s.words.length) * 0.5) / 0.12);
        word.style.opacity = (0.2 + 0.8 * t).toFixed(3);
      });
    }
    segs.forEach((seg, k) => seg.style.setProperty('--fill', clamp01(P * N * STEPS - k).toFixed(3)));
    for (const c of chapters) {
      const on = current >= c.start && current < c.end;
      c.tab.classList.toggle('is-active', on);
      c.tab.style.setProperty('--fill', on ? clamp01((x - c.start) / (c.end - c.start)).toFixed(3) : '0');
      if (on) c.tab.setAttribute('aria-current', 'step');
      else c.tab.removeAttribute('aria-current');
    }
  }

  // ===== Scroll wiring =====
  let pin = null, arrive = null;
  function render() {
    if (!pin || !arrive) return; // still being set up
    // progress straight from the scroll position: on a big jump the triggers update one after the other
    const P = clamp01((pin.scroll() - pin.start) / (pin.end - pin.start || 1));
    show(arrive.isActive ? Math.min(N - 1, Math.floor(P * N)) : -1);
    scrub(P);
  }
  // the first scene arrives as the section comes up the screen, before it pins
  arrive = ScrollTrigger.create({ trigger: section, start: 'top 60%', end: 'max', onToggle: render });
  pin = ScrollTrigger.create({
    trigger: section, start: 'top top', end: () => `+=${window.innerHeight * N * SCREENS}`,
    pin: stage, invalidateOnRefresh: true, onUpdate: render, onRefresh: render,
  });
  render();

  for (const c of chapters) {
    c.tab.addEventListener('click', () => {
      const y = pin.start + (pin.end - pin.start) * ((c.start + 0.05) / N);
      if (window.lenis) window.lenis.scrollTo(y, { duration: 1.4 });
      else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    });
  }
})();
