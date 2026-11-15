// Motion layer: scroll reveals (with stagger), count-up numbers, scroll-progress fallback.
// No library, no third party, no HTML injection. Everything here is optional: the page is complete without it.
(() => {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return; // reduced motion: static page, nothing animates

  const supports = (q) => typeof CSS !== "undefined" && CSS.supports && CSS.supports(q);

  // ---- 1. scroll progress bar: only needed where native scroll-driven animation is missing ----
  const bar = document.querySelector(".progress");
  if (bar && !supports("animation-timeline: scroll()")) {
    let queued = false;
    const paint = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
    paint();
  }

  // ---- 1b. hero foil parallax: only needed where native scroll-driven animation is missing ----
  const tex = document.querySelector(".hero__tex img");
  if (tex && !supports("animation-timeline: scroll()")) {
    let queued = false;
    const paint = () => {
      queued = false;
      const p = Math.min(1, window.scrollY / window.innerHeight);
      tex.style.translate = `0 ${(p * 9).toFixed(2)}%`;
      tex.style.scale = String(1 + p * 0.1);
    };
    window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
  }

  // ---- 2. reveals ----
  const SELECTORS = [
    ".reveal", ".scores > li", ".teamlist__item", ".stats__cell", ".roster li", ".news-card", ".sponsor-slot",
    ".photowall li", ".facts__row", ".people__item", ".pcard", ".leaders__cell", ".split > *", ".band__head", ".league-group__h",
  ];
  // Browsers without native view() timelines get the big headings as ordinary reveals instead of the wipe.
  if (!supports("animation-timeline: view()")) SELECTORS.push(".band .display-l", ".band .display-m", ".band .statement");

  if (!("IntersectionObserver" in window)) return;

  const doneAfter = (el) => setTimeout(() => {
    // Hand the element back to its own CSS (hover transforms, transitions) once the entrance is over.
    el.classList.remove("reveal", "is-in", "is-arming");
    el.style.removeProperty("--d");
  }, 1000);

  const pending = new Set();
  const reveal = new IntersectionObserver(
    (entries) => {
      const batch = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
      batch.forEach((en, i) => {
        const el = en.target;
        reveal.unobserve(el);
        pending.delete(el);
        el.style.setProperty("--d", `${Math.min(i, 7) * 70}ms`);
        el.classList.add("is-in");
        doneAfter(el);
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.06 }
  );

  // Arm many elements at once: all class writes together, observers on the next frame.
  // (A forced reflow per element made the 74-card squads page do 74 layouts.)
  const armMany = (els) => {
    const list = els.filter((el) => !el.closest("[hidden]") && !el.classList.contains("is-in"));
    list.forEach((el) => el.classList.add("reveal", "is-arming"));
    // commit the hidden state without a transition, on the next frame (no synchronous reflow)
    requestAnimationFrame(() => {
      list.forEach((el) => {
        el.classList.remove("is-arming");
        pending.add(el);
        reveal.observe(el);
      });
    });
  };

  // A fast flick can carry an element from below the screen to above it between two frames, so the
  // observer never sees it cross. Anything already scrolled past is shown at once (it is off screen).
  let sweeping = false;
  window.addEventListener("scroll", () => {
    if (sweeping || !pending.size) return;
    sweeping = true;
    requestAnimationFrame(() => {
      sweeping = false;
      pending.forEach((el) => {
        if (el.getBoundingClientRect().bottom < 0) {
          reveal.unobserve(el);
          pending.delete(el);
          el.classList.add("is-in");
          doneAfter(el);
        }
      });
    });
  }, { passive: true });

  const armAll = (root) => {
    const found = [...new Set(root.querySelectorAll(SELECTORS.join(",")))];
    // reads first: anything already in the first screen stays as painted (no hide-then-show flash)
    const limit = window.innerHeight * 0.92;
    const todo = found.filter((el) => !(root === document && !el.classList.contains("reveal") && el.getBoundingClientRect().top < limit));
    armMany(todo);
  };
  armAll(document);

  // the league selector shows another set of groups: replay the entrance for the cards now on screen
  document.addEventListener("sr:refresh", (e) => {
    const root = e.target instanceof Element ? e.target : document;
    const els = [...root.querySelectorAll("[data-league]:not([hidden]) :is(.scores > li, .league-group__h, .pcard, .leaders__cell, .stats__cell)")];
    els.forEach((el) => el.classList.remove("reveal", "is-in"));
    armMany(els);
  });

  // ---- 3. count-up numbers (final value is always in the text; the animation only starts from 0 in view) ----
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    const run = (el) => {
      const end = Number(el.dataset.count);
      if (!Number.isFinite(end) || end <= 0) return;
      const t0 = performance.now();
      const dur = 900 + Math.min(end, 30) * 12;
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        el.textContent = String(Math.round(end * ease(t)));
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = String(end);
      };
      el.textContent = "0";
      requestAnimationFrame(tick);
    };
    const count = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        count.unobserve(en.target);
        run(en.target);
      }),
      { threshold: 0.6 }
    );
    counters.forEach((el) => count.observe(el));
  }
})();
