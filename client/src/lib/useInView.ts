import { useEffect, useRef, useState } from 'react';
import { canAnimateOnScroll } from './motion';

/**
 * Reports when an element first scrolls into view, and stays true after that. Without scroll
 * animation (reduced motion, or no observer) it is true from the start, so nothing stays hidden.
 */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => !canAnimateOnScroll());

  useEffect(() => {
    const element = ref.current;
    if (inView || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView]);

  return { ref, inView };
}
