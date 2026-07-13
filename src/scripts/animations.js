import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Subtle, tasteful motion. Gentle distances, soft easing.
 * Respects prefers-reduced-motion — no motion for users who ask for less.
 */
export function initAnimations() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    gsap.set("[data-hero], [data-reveal], [data-card]", { opacity: 1, y: 0 });
    return;
  }

  // Hero: staggered entrance on load.
  if (document.querySelector("[data-hero]")) {
    gsap.to("[data-hero]", {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.12,
      startAt: { y: 24 },
    });
  }

  // Sections: reveal as they scroll into view.
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

  // Cards / gallery items: gentle stagger as each group enters.
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
