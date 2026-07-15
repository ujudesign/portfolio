import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

// Flip to false to skip the intro loader while building other pages.
const ENABLE_LOADER = true;

// Set once Lenis is created; used by other effects that want scroll velocity.
let lenisInstance = null;

// Entry point. Everything honors reduced-motion.
export function initAnimations() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  initSmoothScroll(reduce);
  initIntro(reduce);
  initScrollReveals(reduce);
  initPortrait(reduce);
  initHeroBackground(reduce);
  initFeatured(reduce);
  initSectionStretch(reduce);
  initSplitReveals(reduce);
}

// SplitText line reveal for headings, triggered when they scroll into view.
function initSplitReveals(reduce) {
  const els = gsap.utils.toArray("[data-split-reveal]");
  if (!els.length) return;

  if (reduce) {
    gsap.set(els, { opacity: 1 });
    return;
  }

  const run = () => {
    els.forEach((el) => {
      ScrollTrigger.create({
        trigger: el,
        start: "top 85%",
        once: true,
        onEnter: () => {
          gsap.set(el, { opacity: 1 });
          const split = new SplitText(el, { type: "lines", mask: "lines" });
          gsap.from(split.lines, {
            yPercent: 110,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
            onComplete: () => split.revert(),
          });
        },
      });
    });
  };

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  else run();
}

// Elastic top edge on the featured section: an SVG curve that bows up with
// scroll velocity near the seam, then springs back flat.
function initSectionStretch(reduce) {
  const section = document.querySelector("[data-featured]");
  const path = section && section.querySelector("[data-stretch-path]");
  if (!section || !path || reduce || !lenisInstance) return;

  const MAX = 58; // max bow in viewBox units
  let bow = 0;
  let vel = 0;

  gsap.ticker.add(() => {
    const rect = section.getBoundingClientRect();
    const near = rect.top > -80 && rect.top < window.innerHeight;
    const v = Math.abs(lenisInstance.velocity || 0);
    const target = near ? Math.min(MAX, v * 1.15) : 0;

    // spring toward target (overshoots slightly for the elastic snap)
    vel += (target - bow) * 0.1;
    vel *= 0.72;
    bow += vel;

    // settle exactly flat once it's basically at rest
    if (target === 0 && Math.abs(bow) < 0.05 && Math.abs(vel) < 0.05) {
      if (bow !== 0) {
        bow = 0;
        vel = 0;
        path.setAttribute("d", "M0,100 Q500,100 1000,100 Z");
      }
      return;
    }
    path.setAttribute("d", `M0,100 Q500,${(100 - 2 * bow).toFixed(1)} 1000,100 Z`);
  });
}

// Featured work: sticky left column whose title/desc swap (SplitText) as each
// thumbnail reaches the middle; sliding dot indicator; subtle scroll ripple.
function initFeatured(reduce) {
  const section = document.querySelector("[data-featured]");
  if (!section) return;

  const items = gsap.utils.toArray("[data-fw-item]");
  const titleEl = section.querySelector("[data-fw-title]");
  const descEl = section.querySelector("[data-fw-desc]");
  const active = section.querySelector("[data-fw-active]");
  const label = section.querySelector("[data-fw-label]");
  const DOT = 17; // px between dot centers
  let current = -1;
  let tSplit, dSplit;

  const setContent = (index, item) => {
    if (index === current) return;
    current = index;
    const title = item.dataset.title || "";
    const desc = item.dataset.desc || "";

    if (active) gsap.to(active, { x: index * DOT, duration: reduce ? 0 : 0.4, ease: "power3.out" });

    if (reduce) {
      gsap.set([titleEl, descEl], { opacity: 1 });
      titleEl.textContent = title;
      descEl.textContent = desc;
      return;
    }

    if (tSplit) tSplit.revert();
    titleEl.textContent = title;
    gsap.set(titleEl, { opacity: 1 });
    tSplit = new SplitText(titleEl, { type: "lines", mask: "lines" });
    gsap.from(tSplit.lines, {
      yPercent: 110,
      duration: 0.7,
      stagger: 0.1,
      ease: "power3.out",
      onComplete: () => tSplit && tSplit.revert(),
    });

    if (dSplit) dSplit.revert();
    descEl.textContent = desc;
    gsap.set(descEl, { opacity: 1 });
    dSplit = new SplitText(descEl, { type: "lines", mask: "lines" });
    gsap.from(dSplit.lines, {
      yPercent: 110,
      duration: 0.6,
      stagger: 0.05,
      delay: 0.1,
      ease: "power3.out",
      onComplete: () => dSplit && dSplit.revert(),
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setContent(parseInt(e.target.dataset.index, 10), e.target);
      });
    },
    { rootMargin: "-50% 0px -50% 0px", threshold: 0 }
  );
  items.forEach((it) => io.observe(it));

  // SplitText reveal for the "Featured Work" label (once, on enter).
  const revealLabel = () => {
    if (!label) return;
    gsap.set(label, { opacity: 1 });
    if (reduce) return;
    const s = new SplitText(label, { type: "lines", mask: "lines" });
    gsap.from(s.lines, {
      yPercent: 110,
      duration: 0.6,
      ease: "power3.out",
      onComplete: () => s.revert(),
    });
  };

  // Reveal the label + first project as the section starts scrolling into view.
  const enterIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && current === -1) {
          revealLabel();
          setContent(0, items[0]);
        }
      });
    },
    { threshold: 0, rootMargin: "0px 0px -20% 0px" }
  );
  enterIO.observe(section);
}

// Faint dot grid behind the hero that lights up near the cursor.
function initHeroBackground(reduce) {
  const bg = document.querySelector("[data-hero-bg]");
  const canvas = document.querySelector("[data-hero-dots]");
  if (!bg || !canvas) return;
  const section = bg.parentElement;
  const ctx = canvas.getContext("2d");

  const GAP = 34; // spacing between dots
  const RADIUS = 160; // cursor influence radius
  const BASE_A = 0.14; // resting dot alpha
  const BOOST_A = 0.85; // extra alpha near cursor
  const PULL = 0.35; // magnetic pull toward the cursor

  let w = 0;
  let h = 0;
  let dpr = 1;
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, ton: 0 };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = bg.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  new ResizeObserver(resize).observe(bg);

  const render = (time) => {
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    mouse.on += (mouse.ton - mouse.on) * 0.08;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";

    // subtle breathing at rest
    const pulse = reduce ? 0 : 0.012 * (0.5 + 0.5 * Math.sin(time * 1.2));
    const base = BASE_A + pulse;

    for (let x = 0; x <= w; x += GAP) {
      for (let y = 0; y <= h; y += GAP) {
        let a = base;
        let s = 1.4;
        let dx = x;
        let dy = y;
        if (mouse.on > 0.001) {
          const ox = mouse.x - x;
          const oy = mouse.y - y;
          const d = Math.hypot(ox, oy);
          if (d < RADIUS) {
            const f = 1 - d / RADIUS;
            const e = f * f;
            a += BOOST_A * e * mouse.on;
            s += 1.4 * e * mouse.on;
            dx += ox * PULL * e * mouse.on; // pull toward cursor
            dy += oy * PULL * e * mouse.on;
          }
        }
        ctx.globalAlpha = a;
        ctx.fillRect(dx - s / 2, dy - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
  };

  // reduced motion: one static grid, no interaction
  if (reduce) {
    render(0);
    return;
  }

  section.addEventListener("pointermove", (e) => {
    const rect = bg.getBoundingClientRect();
    mouse.tx = e.clientX - rect.left;
    mouse.ty = e.clientY - rect.top;
    mouse.ton = 1;
  });
  section.addEventListener("pointerleave", () => {
    mouse.ton = 0;
  });

  gsap.ticker.add(render);
}

// WebGL hover shader on the portrait (lazy-loaded).
async function initPortrait(reduce) {
  const portrait = document.querySelector("[data-portrait]");
  if (!portrait || reduce) return; // otherwise keep the static image

  try {
    const { initPortraitShader } = await import("./portraitShader.js");
    initPortraitShader(portrait);
  } catch (e) {
    // on failure, keep the plain <img>
  }
}

// Lenis smooth scroll, synced to GSAP's ticker.
function initSmoothScroll(reduce) {
  if (reduce) return; // native scroll for reduced-motion

  const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
  lenisInstance = lenis;

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // smooth-scroll in-page anchor links
  document.querySelectorAll('a[href*="#"]').forEach((a) => {
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = url.hash === "#top" ? 0 : document.querySelector(url.hash);
    if (target === null) return;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      lenis.scrollTo(target);
      history.pushState(null, "", url.hash);
    });
  });
}

// Intro loader -> curtain reveal -> hero content.
function initIntro(reduce) {
  const loader = document.querySelector("[data-loader]");
  const heroBg = document.querySelector("[data-hero-bg]");

  // No loader wanted (disabled / reduced-motion / not the homepage): drop it
  // and show the content straight away.
  if (reduce || !ENABLE_LOADER || !loader) {
    loader?.remove();
    document.querySelectorAll("[data-loader-panel]").forEach((p) => p.remove());
    document.querySelector("[data-loader-line]")?.remove();
    document.querySelector("[data-portrait]")?.removeAttribute("data-loading");
    revealHeroContent(reduce);
    return;
  }

  // Pin to the top and lock scrolling for the intro.
  lockScroll();
  if (heroBg) gsap.set(heroBg, { opacity: 0 });

  runLoader(loader).then(() => {
    unlockScroll();
    if (heroBg) gsap.to(heroBg, { opacity: 1, duration: 1.2, ease: "power2.out" });
    revealHeroContent(false);
  });
}

function lockScroll() {
  document.documentElement.classList.add("is-loading");
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { immediate: true });
    lenisInstance.stop();
  } else {
    window.scrollTo(0, 0);
  }
}

function unlockScroll() {
  document.documentElement.classList.remove("is-loading");
  if (lenisInstance) lenisInstance.start();
}

// Counter + grainy fill, then a two-panel curtain slides up to reveal the portrait.
function runLoader(loader) {
  return new Promise((resolve) => {
    const num = loader.querySelector("[data-loader-num]");
    const panels = gsap.utils.toArray("[data-loader-panel]");
    const line = document.querySelector("[data-loader-line]");
    const counter = { v: 0 };

    const tl = gsap.timeline();
    tl.to(
      counter,
      {
        v: 100,
        duration: 3.2,
        ease: "power1.inOut",
        onUpdate: () => {
          if (num) num.textContent = String(Math.round(counter.v));
        },
      },
      0
    );
    if (line) tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 3.2, ease: "power1.inOut" }, 0);

    tl.to({}, { duration: 0.2 }); // brief hold at 100%
    if (line) tl.to(line, { opacity: 0, duration: 0.4 }, "<");
    tl.to(loader, { yPercent: -100, duration: 0.7, ease: "power4.inOut" });
    if (panels.length) {
      tl.to(panels, { yPercent: -100, duration: 0.7, ease: "power4.inOut", stagger: 0.1 }, "<0.12");
    }
    tl.add(() => {
      loader.style.display = "none";
      panels.forEach((p) => (p.style.display = "none"));
      if (line) line.style.display = "none";
      loader.closest("[data-portrait]")?.removeAttribute("data-loading");
      resolve();
    });
  });
}

// Status bar + heading/paragraph reveal.
function revealHeroContent(reduce) {
  const statusItems = gsap.utils.toArray("[data-status-item]");
  const heading = document.querySelector("[data-split-heading]");
  const paragraph = document.querySelector("[data-split-paragraph]");

  if (reduce) {
    gsap.set([...statusItems, heading, paragraph], { opacity: 1, clearProps: "transform" });
    return;
  }

  const build = () => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // status bar
    if (statusItems.length) {
      tl.to(statusItems, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, startAt: { y: -6 } }, 0);
    }

    // heading — line-by-line reveal, then revert to natural text
    if (heading) {
      gsap.set(heading, { opacity: 1 });
      const split = new SplitText(heading, { type: "lines", mask: "lines" });
      tl.from(split.lines, { yPercent: 110, duration: 0.9, stagger: 0.12, onComplete: () => split.revert() }, 0.05);
    }

    // paragraph
    if (paragraph) {
      gsap.set(paragraph, { opacity: 1 });
      const splitP = new SplitText(paragraph, { type: "lines", mask: "lines" });
      tl.from(splitP.lines, { yPercent: 110, duration: 0.8, stagger: 0.06, onComplete: () => splitP.revert() }, 0.3);
    }
  };

  // wait for the webfont so line breaks measure correctly
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(build);
  } else {
    build();
  }
}

// Scroll reveals for the sections below the hero.
function initScrollReveals(reduce) {
  if (reduce) {
    gsap.set("[data-reveal], [data-card]", { opacity: 1, clearProps: "transform" });
    return;
  }

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power3.out",
      startAt: { y: 32 },
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });

  gsap.utils.toArray("[data-card-group]").forEach((group) => {
    gsap.to(group.querySelectorAll("[data-card]"), {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.08,
      startAt: { y: 24 },
      scrollTrigger: { trigger: group, start: "top 85%" },
    });
  });
}
