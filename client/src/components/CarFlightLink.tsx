import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { carArrivalState, type CarBox } from '../lib/carArrival';
import { CAR_HEIGHT, CAR_WIDTH } from '../lib/carShape';
import { prefersReducedMotion } from '../lib/motion';
import { CarIcon } from './RoadIcons';

const PAGE_FADE_MS = 180;

interface CarFlightLinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  /** The car on the page that sets off. */
  startFrom: RefObject<HTMLElement | null>;
  onFlightStart?: () => void;
}

/**
 * A link where a plain click fades the page away around a car, then opens the next page, where
 * `CarArrival` reshapes that car into the listing link box. Other clicks (like opening a new tab),
 * reduced motion, and browsers without Web Animations get a normal link.
 */
export default function CarFlightLink({
  to,
  className,
  children,
  startFrom,
  onFlightStart,
}: CarFlightLinkProps) {
  const veilRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [flight, setFlight] = useState<CarBox | null>(null);

  useEffect(() => {
    const veil = veilRef.current;
    if (!flight || !veil) return;

    const pageFade = veil.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: PAGE_FADE_MS,
      easing: 'ease-out',
      fill: 'forwards',
    });
    pageFade.onfinish = () => navigate(to, { state: carArrivalState(flight) });
    return () => pageFade.cancel();
  }, [flight, navigate, to]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const plainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    const link = event.currentTarget;
    const car = startFrom.current?.getBoundingClientRect();
    if (!plainClick || !car || typeof link.animate !== 'function' || prefersReducedMotion()) return;

    event.preventDefault();
    if (flight) return;

    const width = car.width || CAR_WIDTH;
    const height = width * (CAR_HEIGHT / CAR_WIDTH);
    const maxTop = Math.max(0, window.innerHeight - height);
    setFlight({ left: car.left, top: Math.min(maxTop, Math.max(0, car.top)), width, height });
    onFlightStart?.();
  }

  return (
    <>
      <Link to={to} className={className} onClick={handleClick}>
        {children}
      </Link>
      {flight && (
        <div className="car-flight" aria-hidden="true">
          <div className="car-flight__veil" ref={veilRef} />
          <div
            className="car-flight__car"
            style={{
              left: flight.left,
              top: flight.top,
              width: flight.width,
              height: flight.height,
            }}
          >
            <CarIcon />
          </div>
        </div>
      )}
    </>
  );
}
