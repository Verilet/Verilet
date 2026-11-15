/** Whether the visitor has asked their system for less animation. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Whether scroll-triggered animations can run: needs the browser's observer and no reduced motion. */
export function canAnimateOnScroll(): boolean {
  return typeof IntersectionObserver === 'function' && !prefersReducedMotion();
}
