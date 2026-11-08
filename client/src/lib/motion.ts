export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Scroll-triggered animations need the browser's observer and a visitor who wants motion. */
export function canAnimateOnScroll(): boolean {
  return typeof IntersectionObserver === 'function' && !prefersReducedMotion();
}
