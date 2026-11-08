import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const FADE_MS = 300;

/**
 * Fades the page in after the landing page's car drive. Afterwards the router state is cleared so
 * a refresh or a trip back through history doesn't play it again.
 */
export default function PageFadeIn() {
  const veilRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const finish = () => navigate(pathname, { replace: true, state: null });
    const veil = veilRef.current;
    if (!veil || typeof veil.animate !== 'function') {
      finish();
      return;
    }
    const fade = veil.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: FADE_MS,
      easing: 'ease-out',
      fill: 'forwards',
    });
    fade.onfinish = finish;
    return () => fade.cancel();
  }, [navigate, pathname]);

  return (
    <div className="car-arrival" aria-hidden="true">
      <div className="car-arrival__veil" ref={veilRef} />
    </div>
  );
}
