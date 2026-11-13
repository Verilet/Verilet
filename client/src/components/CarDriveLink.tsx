import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DRIVE_ARRIVAL_STATE } from '../lib/carArrival';
import { prefersReducedMotion } from '../lib/motion';
import { CarIcon } from './RoadIcons';

const DRIVE_MS = 880;
const CAR_START_DELAY_MS = 80;
const PAGE_FADE_DELAY_MS = 450;
const PAGE_FADE_MS = 350;
const ROAD_HEIGHT = 48;
const ROAD_GAP = 12;
const ROAD_EDGE_MARGIN = 12;
const CAR_HALF_HEIGHT = 31;
/** Far enough past each screen edge that the car is fully hidden. */
const OFF_SCREEN = 90;
const CAR_POSE = 'rotate(-90deg) scale(0.62)';

interface CarDriveLinkProps {
  to: string;
  className?: string;
  children: ReactNode;
}

/**
 * A link where a plain click lays a road under the link's section and sends a car across it while
 * the page fades, then opens the next page. Other clicks (like opening a new tab), reduced motion,
 * and browsers without Web Animations get a normal link.
 */
export default function CarDriveLink({ to, className, children }: CarDriveLinkProps) {
  const veilRef = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [roadTop, setRoadTop] = useState<number | null>(null);

  useEffect(() => {
    const veil = veilRef.current;
    const road = roadRef.current;
    const car = carRef.current;
    if (roadTop === null || !veil || !road || !car) return;

    const drive = car.animate(
      [
        { transform: `translateX(-${OFF_SCREEN}px) ${CAR_POSE}` },
        { transform: `translateX(${window.innerWidth + OFF_SCREEN}px) ${CAR_POSE}` },
      ],
      {
        delay: CAR_START_DELAY_MS,
        duration: DRIVE_MS - CAR_START_DELAY_MS,
        easing: 'cubic-bezier(0.45, 0, 0.75, 0.6)',
        fill: 'both',
      },
    );
    drive.onfinish = () => navigate(to, { state: DRIVE_ARRIVAL_STATE });
    const animations = [
      drive,
      road.animate(
        [
          { transform: 'scaleX(0)', opacity: 1, easing: 'ease-out' },
          { transform: 'scaleX(1)', opacity: 1, offset: 0.2 },
          { transform: 'scaleX(1)', opacity: 1, offset: 0.8 },
          { transform: 'scaleX(1)', opacity: 0 },
        ],
        { duration: DRIVE_MS, fill: 'forwards' },
      ),
      veil.animate([{ opacity: 0 }, { opacity: 1 }], {
        delay: PAGE_FADE_DELAY_MS,
        duration: PAGE_FADE_MS,
        easing: 'ease-in',
        fill: 'both',
      }),
    ];
    return () => animations.forEach((animation) => animation.cancel());
  }, [roadTop, navigate, to]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const plainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    const link = event.currentTarget;
    if (!plainClick || typeof link.animate !== 'function' || prefersReducedMotion()) return;

    event.preventDefault();
    if (roadTop !== null) return;

    const area = link.closest('section')?.getBoundingClientRect() ?? link.getBoundingClientRect();
    const lowest = window.innerHeight - ROAD_HEIGHT - ROAD_EDGE_MARGIN;
    setRoadTop(Math.max(ROAD_EDGE_MARGIN, Math.min(lowest, area.bottom + ROAD_GAP)));
  }

  return (
    <>
      <Link to={to} className={className} onClick={handleClick}>
        {children}
      </Link>
      {roadTop !== null && (
        <div className="car-drive" aria-hidden="true">
          <div className="car-drive__veil" ref={veilRef} />
          <div
            className="car-drive__road"
            ref={roadRef}
            style={{ top: roadTop, height: ROAD_HEIGHT }}
          />
          <div
            className="car-drive__car"
            ref={carRef}
            style={{ top: roadTop + ROAD_HEIGHT / 2 - CAR_HALF_HEIGHT }}
          >
            <CarIcon />
          </div>
        </div>
      )}
    </>
  );
}
