import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import barba from "@barba/core";
import barbaPrefetch from "@barba/prefetch";

gsap.registerPlugin(ScrollTrigger, SplitText);

// Flip to false to skip the intro loader while building other pages.
const ENABLE_LOADER = false;

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
  initSectionHandoff(reduce);
  initSplitReveals(reduce);
  initPageTransition(reduce);
  initProjectGallery(reduce);
}

// Infinite-loop horizontal project gallery. The track is rendered 3x in the
// markup (see ProjectGallery.astro); we scroll a copy-width in from the start
// and silently re-wrap the scroll position whenever it drifts into the first
// or third copy, so the loop reads as seamless (the copies are identical).
function initProjectGallery(reduce) {
  const section = document.querySelector("[data-gallery]");
  const viewport = document.querySelector("[data-gallery-viewport]");
  const track = document.querySelector("[data-gallery-track]");
  if (!section || !viewport || !track) return;

  // Below md, the gallery is a plain vertical stack (see global.css) — no
  // horizontal scroll, drag, loop, or track-height sync. Checked once at
  // init rather than kept in sync with resize; a live device doesn't cross
  // this breakpoint without a reload, and that's the case this is for.
  if (window.matchMedia("(max-width: 767px)").matches) return;

  const copies = gsap.utils.toArray("[data-gallery-copy]");
  const navLinks = gsap.utils.toArray("[data-gallery-link]");
  if (copies.length < 3) return;

  // The image heights come from a chain of flex `stretch` (viewport → track →
  // copy → project-group → image) so they fill whatever room the flex-column
  // layout leaves them. That multi-level implicit-stretch chain isn't resolved
  // consistently across engines (confirmed: fine in Chromium, but collapses to
  // the images' intrinsic size — i.e. near-square, ignoring the actual stretched
  // height — in WebKit/iOS). Setting the track's height explicitly in JS makes
  // that first link definite and unambiguous everywhere; stretch from a real
  // pixel height down through copy/group/image is ordinary flexbox after that.
  const syncTrackHeight = () => {
    const h = viewport.getBoundingClientRect().height;
    if (h > 0) track.style.height = `${h}px`;
  };
  syncTrackHeight();
  new ResizeObserver(syncTrackHeight).observe(viewport);

  let cycleWidth = copies[0].getBoundingClientRect().width;
  let isProgrammaticJump = false;
  let galleryLenis = null;

  // Whenever a project is aligned to the viewport's left edge (initial load,
  // or a nav click), it sits this many px in rather than flush against 0.
  const LEFT_GAP = 10;

  // A transient layout thrash elsewhere on the page (e.g. a SplitText mask
  // briefly resizing a flex sibling) can momentarily report a near-zero
  // cycleWidth. Treat anything below this as "not a real measurement yet"
  // and skip loop-correction rather than risk correcting toward it.
  const MIN_CYCLE_WIDTH = 100;
  const cycleWidthIsSane = () => cycleWidth >= MIN_CYCLE_WIDTH;

  // Offset of each project's first image from the start of one cycle
  // (measured against copy 0 only — copies 1/2 are identical, just shifted).
  const offsetInCycle = new Map();
  const trackStart = () => track.getBoundingClientRect().left;
  const measureOffsets = () => {
    const start = trackStart();
    gsap.utils.toArray("[data-project-group]", copies[0]).forEach((group) => {
      offsetInCycle.set(group.dataset.projectId, group.getBoundingClientRect().left - start);
    });
  };
  measureOffsets();

  // On a cache-bypassing reload, images (especially remote ones) haven't
  // loaded yet when we first measure, so cycleWidth is initially wrong and
  // the opening scroll position lands on the wrong project. Keep correcting
  // it as images finish loading (each one resizes copies[0]) until the user
  // actually scrolls — then leave their position alone.
  let hasUserInteracted = false;
  const markInteracted = () => {
    hasUserInteracted = true;
  };
  viewport.addEventListener("wheel", markInteracted, { passive: true, once: true });
  viewport.addEventListener("touchstart", markInteracted, { passive: true, once: true });

  const remeasure = () => {
    cycleWidth = copies[0].getBoundingClientRect().width;
    measureOffsets();
    if (hasUserInteracted || !cycleWidthIsSane()) return;
    const target = cycleWidth - LEFT_GAP;
    if (galleryLenis) galleryLenis.scrollTo(target, { immediate: true, force: true });
    else viewport.scrollLeft = target;
  };
  new ResizeObserver(remeasure).observe(copies[0]);

  // Reduced motion: no smoothing, but the loop and click-to-scroll still work,
  // driven directly against native scrollLeft instead of a Lenis instance.
  if (reduce) {
    viewport.scrollLeft = cycleWidth - LEFT_GAP;
    viewport.addEventListener("scroll", () => {
      if (isProgrammaticJump || !cycleWidthIsSane()) return;
      if (viewport.scrollLeft >= cycleWidth * 2) viewport.scrollLeft -= cycleWidth;
      else if (viewport.scrollLeft < cycleWidth) viewport.scrollLeft += cycleWidth;
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        markInteracted();
        const offset = offsetInCycle.get(link.dataset.projectId) ?? 0;
        isProgrammaticJump = true;
        viewport.scrollLeft = cycleWidth + offset - LEFT_GAP;
        isProgrammaticJump = false;
      });
    });

    initGalleryDrag(viewport, {
      getScroll: () => viewport.scrollLeft,
      setScroll: (v) => {
        viewport.scrollLeft = v;
      },
      markInteracted,
    });

    initGalleryHighlight(copies, navLinks);
    return;
  }

  galleryLenis = new Lenis({
    wrapper: viewport,
    content: track,
    orientation: "horizontal",
    gestureOrientation: "both",
    smoothWheel: true,
    syncTouch: true,
    infinite: false,
  });
  gsap.ticker.add((time) => galleryLenis.raf(time * 1000));
  galleryLenis.scrollTo(cycleWidth - LEFT_GAP, { immediate: true, force: true });

  galleryLenis.on("scroll", ({ animatedScroll }) => {
    if (isProgrammaticJump || !cycleWidthIsSane()) return;
    if (animatedScroll >= cycleWidth * 2) {
      galleryLenis.scrollTo(animatedScroll - cycleWidth, { immediate: true, force: true });
    } else if (animatedScroll < cycleWidth) {
      galleryLenis.scrollTo(animatedScroll + cycleWidth, { immediate: true, force: true });
    }
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (!cycleWidthIsSane()) return;
      markInteracted();
      const offset = offsetInCycle.get(link.dataset.projectId) ?? 0;
      const candidates = [offset, offset + cycleWidth, offset + cycleWidth * 2];
      const current = galleryLenis.animatedScroll;
      const best = candidates.reduce((a, b) => (Math.abs(current - b) < Math.abs(current - a) ? b : a)) - LEFT_GAP;

      isProgrammaticJump = true;
      galleryLenis.scrollTo(best, {
        duration: 1,
        easing: (t) => 1 - Math.pow(1 - t, 3),
        onComplete: () => {
          if (cycleWidthIsSane()) {
            let x = galleryLenis.animatedScroll;
            if (x < cycleWidth) x += cycleWidth;
            else if (x >= cycleWidth * 2) x -= cycleWidth;
            galleryLenis.scrollTo(x, { immediate: true, force: true });
          }
          isProgrammaticJump = false;
        },
      });
    });
  });

  initGalleryDrag(viewport, {
    getScroll: () => galleryLenis.animatedScroll,
    setScroll: (v) => galleryLenis.scrollTo(v, { immediate: true, force: true }),
    coast: (velocity) => {
      const distance = velocity * 180;
      if (Math.abs(distance) < 4) return;
      galleryLenis.scrollTo(galleryLenis.animatedScroll + distance, {
        duration: 0.8,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    },
    markInteracted,
  });

  initGalleryHighlight(copies, navLinks);
}

// Click-and-drag scrolling (mouse) alongside the existing wheel/touch handling —
// touch is skipped here since Lenis's syncTouch (or native scroll, in the
// reduced-motion path) already covers finger drags on the same element.
function initGalleryDrag(viewport, { getScroll, setScroll, coast, markInteracted }) {
  let isDragging = false;
  let dragStartX = 0;
  let dragStartScroll = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0; // px/ms

  const onPointerDown = (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    markInteracted();
    isDragging = true;
    dragStartX = lastX = e.clientX;
    dragStartScroll = getScroll();
    lastTime = performance.now();
    velocity = 0;
    viewport.classList.add("is-dragging");
    try {
      viewport.setPointerCapture(e.pointerId);
    } catch {
      // no-op: only happens for a pointerId the browser no longer considers active
    }
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const now = performance.now();
    const dt = now - lastTime;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastTime = now;
    setScroll(dragStartScroll - (e.clientX - dragStartX));
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    viewport.classList.remove("is-dragging");
    if (coast) coast(-velocity);
  };

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
}

// Whichever project's image group is at the horizontal middle of the screen
// gets `.is-active` on its matching nav button. Mirrors the vertical
// mid-screen detection initFeatured() used for the old Featured Work section.
function initGalleryHighlight(copies, navLinks) {
  const groups = copies.flatMap((copy) => gsap.utils.toArray("[data-project-group]", copy));
  let current = null;

  const setActive = (id) => {
    if (id === current) return;
    current = id;
    navLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.projectId === id));
  };

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setActive(e.target.dataset.projectId);
      });
    },
    { rootMargin: "0px -50% 0px -50%", threshold: 0 }
  );
  groups.forEach((g) => io.observe(g));
}

// Hold the final Featured Work frame in place while Philosophy scrolls over it.
function initSectionHandoff(reduce) {
  const featuredContent = document.querySelector("[data-featured-content]");
  const philosophy = document.querySelector("[data-philosophy]");
  if (!featuredContent || !philosophy || reduce) return;

  const createPin = () => {
    ScrollTrigger.create({
      trigger: philosophy,
      start: "top bottom",
      end: "top top",
      pin: featuredContent,
      pinSpacing: false,
    });
  };

  // The intro temporarily removes the vertical scrollbar. Wait until it has
  // returned so the pin is created at the final viewport width from the start.
  if (document.documentElement.classList.contains("is-loading")) {
    window.addEventListener("intro:unlocked", createPin, { once: true });
  } else {
    createPin();
  }
}

// Barba page transition: a project click covers the current page, holds it
// until the next document is ready, then swaps at the fully covered frame.
function initPageTransition(reduce) {
  const curtain = document.querySelector("[data-curtain]");
  if (!curtain) return;
  const panels = gsap.utils.toArray("[data-curtain-panel]");

  const revealDestinationContent = (delay = 0) => {
    const enterFades = gsap.utils.toArray("[data-enter-fade]");

    if (reduce) {
      gsap.set(enterFades, { opacity: 1, y: 0 });
      revealCaseContent(true);
      return;
    }

    revealCaseContent(false, delay);
    if (enterFades.length) {
      gsap.to(enterFades, {
        opacity: 1,
        y: 0,
        startAt: { y: 36 },
        duration: 0.9,
        stagger: 0.14,
        delay,
        ease: "power3.out",
      });
    }
  };

  const showDestinationImmediately = () => {
    gsap.killTweensOf(panels);
    gsap.set(panels, { y: 0, yPercent: 100 });
    revealDestinationContent();
  };

  const revealDestination = () =>
    new Promise((resolve) => {
      // Begin the case-study reveals behind the covered viewport. They become
      // visible progressively as the waterfall lifts away.
      revealDestinationContent(0.16);
      gsap.killTweensOf(panels);
      gsap.set(panels, { y: 0, yPercent: 0 });
      gsap.to(panels, {
        y: 0,
        yPercent: -100,
        duration: 0.6,
        ease: "power4.inOut",
        stagger: 0.07,
        onComplete: () => {
          gsap.set(panels, { y: 0, yPercent: 100 });
          resolve();
        },
      });
    });

  const coverSource = () =>
    new Promise((resolve) => {
      if (reduce) {
        resolve();
        return;
      }

      gsap.killTweensOf(panels);
      gsap.set(panels, { y: 0, yPercent: 100 });
      gsap.to(panels, {
        y: 0,
        yPercent: 0,
        duration: 0.6,
        ease: "power4.inOut",
        stagger: { each: 0.08, from: "end" },
        onComplete: resolve,
      });
    });

  // Direct case-study loads have no incoming curtain or artificial reveal wait.
  if (document.querySelector("[data-case-reveal]")) showDestinationImmediately();

  // Direct case-study loads do not need a client router. Barba is initialized
  // only on the homepage and only intercepts featured-project links.
  const container = document.querySelector('[data-barba="container"]');
  if (container?.dataset.barbaNamespace !== "home") return;

  barba.use(barbaPrefetch, {
    root: document.querySelector("[data-featured]") ?? document,
    limit: 0,
  });

  barba.init({
    prevent: ({ el }) => !el?.matches?.("a[data-curtain-link]"),
    preventRunning: true,
    transitions: [{
      name: "featured-case-study",
      leave() {
        return coverSource();
      },
      afterLeave() {
        ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      },
      beforeEnter({ current }) {
        // Barba keeps the outgoing container until `enter` resolves. Hide it
        // while the curtain fully covers the viewport so the upward reveal
        // exposes only the incoming case-study container.
        current.container.style.display = "none";
      },
      enter({ next }) {
        window.scrollTo(0, 0);
        if (lenisInstance) lenisInstance.scrollTo(0, { immediate: true });

        // Astro's page script does not run again when Barba swaps containers.
        // Initialize the below-the-fold reveals against the newly inserted
        // case-study DOM so those elements do not remain at their CSS opacity 0.
        initScrollReveals(reduce, next.container);
        initSplitReveals(reduce, next.container);
        if (lenisInstance) lenisInstance.resize();
        ScrollTrigger.refresh();

        return revealDestination();
      },
      after() {
        // Keep Barba scoped to this one transition. Header links and browser
        // history use normal document navigation from the case-study page.
        setTimeout(() => {
          barba.destroy();
          window.addEventListener("popstate", () => window.location.reload(), { once: true });
        }, 0);
      },
    }],
  });
}

// SplitText line reveal for the case-study left column (title, paragraph, meta).
function revealCaseContent(reduce, delay = 0) {
  const els = gsap.utils.toArray("[data-case-reveal]");
  if (!els.length) return;

  if (reduce) {
    gsap.set(els, { opacity: 1 });
    return;
  }

  const run = () => {
    els.forEach((el, i) => {
      gsap.set(el, { opacity: 1 });
      const split = new SplitText(el, { type: "lines", mask: "lines" });
      gsap.from(split.lines, {
        yPercent: 110,
        duration: 0.8,
        stagger: 0.08,
        delay: delay + i * 0.1,
        ease: "power3.out",
        onComplete: () => split.revert(),
      });
    });
  };

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  else run();
}

// SplitText line reveal for headings, triggered when they scroll into view.
function initSplitReveals(reduce, root = document) {
  const els = gsap.utils.toArray(root.querySelectorAll("[data-split-reveal]"));
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

  window.dispatchEvent(new Event("intro:unlocked"));
  ScrollTrigger.refresh();
}

// Counter + progress line, then a 3-tone curtain sweeps the whole page up.
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
      resolve();
    });
  });
}

// Status bar + heading/paragraph reveal.
function revealHeroContent(reduce) {
  const statusItems = gsap.utils.toArray("[data-status-item]");
  const heading = document.querySelector("[data-split-heading]");
  const paragraph = document.querySelector("[data-split-paragraph]");
  const portrait = document.querySelector("[data-hero-portrait]");
  const galleryLabel = document.querySelector("[data-gallery-reveal]");
  const galleryEntranceImages = gsap.utils.toArray("[data-gallery-entrance]");

  if (reduce) {
    gsap.set([...statusItems, heading, paragraph, portrait, galleryLabel, ...galleryEntranceImages], {
      opacity: 1,
      clearProps: "transform",
    });
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

    // portrait — fade in and up
    if (portrait) {
      tl.fromTo(
        portrait,
        { opacity: 0, y: 48 },
        { opacity: 1, y: 0, duration: 1.1, ease: "power3.out" },
        0.35
      );
    }

    // "Work '24 - '26" label — same line-mask treatment as the heading/paragraph.
    if (galleryLabel) {
      gsap.set(galleryLabel, { opacity: 1 });
      const splitLabel = new SplitText(galleryLabel, { type: "lines", mask: "lines" });
      tl.from(
        splitLabel.lines,
        { yPercent: 110, duration: 0.7, onComplete: () => splitLabel.revert() },
        0.45
      );
    }

    // Project nav — only the text lines animate; the button's own opacity is
    // left alone so the active/inactive state (set elsewhere) isn't clobbered.
    const galleryNavItems = gsap.utils.toArray("[data-gallery-link]");
    galleryNavItems.forEach((item, i) => {
      const split = new SplitText(item, { type: "lines", mask: "lines" });
      tl.from(
        split.lines,
        { yPercent: 110, duration: 0.6, onComplete: () => split.revert() },
        0.45 + i * 0.05
      );
    });

    // Gallery screens — a plain fade, each screen in on its own beat. Only the
    // first (real) copy carries this attribute; the two loop-duplicate copies
    // are identical and mostly off-screen at load, so animating them is unnecessary.
    if (galleryEntranceImages.length) {
      gsap.set(galleryEntranceImages, { opacity: 1 });
      tl.from(galleryEntranceImages, { opacity: 0, duration: 0.9, stagger: 0.08 }, 0.55);
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
function initScrollReveals(reduce, root = document) {
  const reveals = gsap.utils.toArray(root.querySelectorAll("[data-reveal]"));
  const cards = gsap.utils.toArray(root.querySelectorAll("[data-card]"));

  if (reduce) {
    gsap.set([...reveals, ...cards], { opacity: 1, clearProps: "transform" });
    return;
  }

  reveals.forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: "power3.out",
      startAt: { y: 32 },
      scrollTrigger: { trigger: el, start: "top bottom" },
    });
  });

  gsap.utils.toArray(root.querySelectorAll("[data-card-group]")).forEach((group) => {
    gsap.to(group.querySelectorAll("[data-card]"), {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.08,
      startAt: { y: 24 },
      scrollTrigger: { trigger: group, start: "top bottom" },
    });
  });
}
