import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * Subtle, tasteful motion. Gentle distances, soft easing.
 * Respects prefers-reduced-motion — no motion for users who ask for less.
 */
export function initAnimations() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  initSmoothScroll(reduce);
  initHeroLoad(reduce);
  initScrollReveals(reduce);
  initPortrait(reduce);
}

/** WebGL hover-displacement shader on the hero portrait (lazy-loaded). */
async function initPortrait(reduce) {
  const portrait = document.querySelector("[data-portrait]");
  // Under reduced-motion (or no portrait) we simply keep the static image.
  if (!portrait || reduce) return;

  try {
    const { initPortraitShader } = await import("./portraitShader.js");
    initPortraitShader(portrait);
  } catch (e) {
    // Any failure leaves the plain <img> in place — no broken state.
  }
}

/** Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync. */
function initSmoothScroll(reduce) {
  // Smooth scroll is motion — leave native (instant) scrolling for reduced-motion.
  if (reduce) return;

  const lenis = new Lenis({ duration: 1.2, smoothWheel: true });

  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Route in-page anchor links (Work / About / Back to top) through Lenis.
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

/** Orchestrated page-load sequence for the hero. */
function initHeroLoad(reduce) {
  const statusItems = gsap.utils.toArray("[data-status-item]");
  const heading = document.querySelector("[data-split-heading]");
  const paragraph = document.querySelector("[data-split-paragraph]");
  const image = document.querySelector("[data-hero-image]");

  // Nothing to animate here on pages without a hero (e.g. case studies still
  // have the status bar, which we handle below).
  if (reduce) {
    gsap.set([...statusItems, heading, paragraph, image], {
      opacity: 1,
      clearProps: "transform",
    });
    return;
  }

  const build = () => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // 1. Status bar fades + gently staggers in.
    if (statusItems.length) {
      tl.to(
        statusItems,
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, startAt: { y: -6 } },
        0
      );
    }

    // 2. Heading reveals line by line (masked slide-up), then reverts to
    //    natural text so it reflows on resize and stays screen-reader friendly.
    if (heading) {
      gsap.set(heading, { opacity: 1 });
      const split = new SplitText(heading, { type: "lines", mask: "lines" });
      tl.from(
        split.lines,
        {
          yPercent: 110,
          duration: 0.9,
          stagger: 0.12,
          onComplete: () => split.revert(),
        },
        0.2
      );
    }

    // 3. Paragraph reveals its lines a touch quicker, slightly after the heading.
    if (paragraph) {
      gsap.set(paragraph, { opacity: 1 });
      const splitP = new SplitText(paragraph, { type: "lines", mask: "lines" });
      tl.from(
        splitP.lines,
        {
          yPercent: 110,
          duration: 0.8,
          stagger: 0.06,
          onComplete: () => splitP.revert(),
        },
        0.5
      );
    }

    // 4. Portrait fades in alongside the text.
    if (image) {
      tl.to(image, { opacity: 1, duration: 1.1, startAt: { yPercent: 4 }, yPercent: 0 }, 0.3);
    }
  };

  // Wait for the webfont so SplitText measures line breaks correctly.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(build);
  } else {
    build();
  }
}

/** Scroll-triggered reveals for the sections below the hero. */
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
