import { useEffect, useRef, useState } from 'react';
import CarFlightLink from '../components/CarFlightLink';
import { CarIcon, HouseIcon } from '../components/RoadIcons';
import { GUIDE } from '../content/guide';
import { prefersReducedMotion } from '../lib/motion';

const HOUSE_COLORS = ['#ead7b5', '#d8e3d3', '#ecd1cb', '#d3dee9', '#e6dcef', '#f3d9cd'];
const CAR_HEIGHT = 62;
/** Scrolling a stop past this point of the screen sends the car to it. */
const TRIGGER_LINE = 0.6;
/** How far a stop must drop back below the trigger line before the car reverses, in pixels. */
const REVERSE_MARGIN = 40;
/** A drive to the next stop takes this long, however the page was scrolled. */
const DRIVE_MS = 800;
/** Each extra stop adds this much to a drive, up to the longest drive below. */
const EXTRA_STOP_MS = 150;
const LONGEST_DRIVE_MS = 1400;
/** Frame gaps are clamped so a slow frame cannot make the car jump. */
const MIN_FRAME_MS = 8;
const MAX_FRAME_MS = 50;
const FIRST_FRAME_MS = 16;
/** The car's place before the first stop, at the START tag. */
const AT_START = -1;

/** Road measurements, cached because reading layout on every frame is slow. */
interface RoadLayout {
  /** The top of the road, measured from the top of the page. */
  roadTop: number;
  pageHeight: number;
  carHeight: number;
  carOffset: number;
  startCentre: number;
  stopCentres: number[];
}

interface Drive {
  from: number;
  to: number;
  toStop: number;
  duration: number;
  elapsed: number;
  ease: (progress: number) => number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pulls away gently, cruises, and brakes gently. */
function easeDrive(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

/** Eases out only, for a car that is already moving when its destination changes. */
function easeRetarget(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

/** The stop the car should be at: the last one scrolled past the trigger line. */
function destinationStop(layout: RoadLayout, currentStop: number): number {
  const { roadTop, pageHeight, stopCentres } = layout;
  const viewport = window.innerHeight;
  if (pageHeight > viewport && window.scrollY + viewport >= pageHeight - 2) {
    return stopCentres.length - 1;
  }

  const scrolled = viewport * TRIGGER_LINE - (roadTop - window.scrollY);
  let destination = AT_START;
  stopCentres.forEach((centre, index) => {
    if (centre <= scrolled) destination = index;
  });
  // Stay put near the line so small scrolls back and forth don't restart the drive.
  if (
    destination < currentStop &&
    currentStop !== AT_START &&
    scrolled >= stopCentres[currentStop] - REVERSE_MARGIN
  ) {
    return currentStop;
  }
  return destination;
}

/**
 * The How it works page: a road with six houses, one per step. Scrolling a stop into place sends
 * the car on one fixed drive to that house, and as it reaches each stop the stop lights up and a sticky status
 * bar says what is happening there. The drive looks the same however the page was scrolled. With
 * reduced motion on, the page is a plain ordered list (the car stays at the top, nothing is
 * highlighted, and the status bar is not shown).
 */
export default function AboutView() {
  const roadRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const stopRefs = useRef<(HTMLLIElement | null)[]>([]);
  const markerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [carFlying, setCarFlying] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let layout = null as RoadLayout | null;
    let currentStop = AT_START;
    let position = 0;
    let drive: Drive | null = null;
    let frame = 0;
    let frameQueued = false;
    let lastTime: number | null = null;

    function measure() {
      const road = roadRef.current;
      const car = carRef.current;
      if (!road || !car) return;

      const roadBox = road.getBoundingClientRect();
      const carHeight = car.getBoundingClientRect().height || CAR_HEIGHT;
      const carOffset = car.offsetTop;
      layout = {
        roadTop: roadBox.top + window.scrollY,
        pageHeight: document.documentElement.scrollHeight,
        carHeight,
        carOffset,
        startCentre: carOffset + carHeight / 2,
        stopCentres: stopRefs.current.map((stop, index) => {
          const marker = markerRefs.current[index];
          const markerCentre = marker ? marker.offsetTop + marker.offsetHeight / 2 : 0;
          return (stop?.getBoundingClientRect().top ?? 0) - roadBox.top + markerCentre;
        }),
      };
    }

    function centreOf({ startCentre, stopCentres }: RoadLayout, stop: number) {
      return stop === AT_START ? startCentre : stopCentres[stop];
    }

    function placeCar({ carHeight, carOffset }: RoadLayout, carCentre: number) {
      position = carCentre;
      const carTop = carCentre - carHeight / 2 - carOffset;
      if (carRef.current) {
        carRef.current.style.transform = `translate3d(0, ${carTop.toFixed(2)}px, 0)`;
      }
    }

    /** Lights up the last stop the car has reached, whichever way it is going. */
    function markReachedStop({ stopCentres }: RoadLayout, forwards: boolean) {
      const reached = forwards
        ? stopCentres.reduce((last, centre, index) => (centre <= position ? index : last), AT_START)
        : stopCentres.findIndex((centre) => centre >= position);
      setActiveIndex(Math.max(reached, 0));
    }

    function startDrive(current: RoadLayout, fromStop: number, toStop: number, moving: boolean) {
      const stops = Math.abs(toStop - fromStop);
      const to = centreOf(current, toStop);
      const sameWay = drive !== null && drive.to > drive.from === to > position;
      lastTime = moving ? lastTime : null;
      return {
        from: position,
        to,
        toStop,
        duration: Math.min(LONGEST_DRIVE_MS, DRIVE_MS + (stops - 1) * EXTRA_STOP_MS),
        elapsed: 0,
        ease: moving && sameWay ? easeRetarget : easeDrive,
      };
    }

    function tick(now: number) {
      frameQueued = false;
      if (!layout) return;

      const destination = destinationStop(layout, drive ? drive.toStop : currentStop);
      if (drive && destination !== drive.toStop) {
        drive = startDrive(layout, drive.toStop, destination, true);
      }
      if (!drive) {
        if (destination === currentStop) {
          // Nothing to drive to. Keep the car on its stop if the layout shifted.
          placeCar(layout, centreOf(layout, currentStop));
          lastTime = null;
          return;
        }
        drive = startDrive(layout, currentStop, destination, false);
      }

      const gap =
        lastTime === null ? FIRST_FRAME_MS : clamp(now - lastTime, MIN_FRAME_MS, MAX_FRAME_MS);
      lastTime = now;
      drive.elapsed = Math.min(drive.duration, drive.elapsed + gap);
      placeCar(
        layout,
        drive.from + (drive.to - drive.from) * drive.ease(drive.elapsed / drive.duration),
      );
      markReachedStop(layout, drive.to > drive.from);

      if (drive.elapsed >= drive.duration) {
        currentStop = drive.toStop;
        drive = null;
      }
      queueFrame();
    }

    function queueFrame() {
      if (frameQueued) return;
      frameQueued = true;
      frame = requestAnimationFrame(tick);
    }

    function remeasure() {
      measure();
      if (drive && layout) drive.to = centreOf(layout, drive.toStop);
      queueFrame();
    }

    measure();
    if (layout) {
      currentStop = destinationStop(layout, AT_START);
      placeCar(layout, centreOf(layout, currentStop));
      setActiveIndex(Math.max(currentStop, 0));
    }

    window.addEventListener('scroll', queueFrame, { passive: true });
    window.addEventListener('resize', remeasure);
    // Catches layout changes without a window resize, like web fonts or the status bar appearing.
    const pageSize = typeof ResizeObserver === 'function' ? new ResizeObserver(remeasure) : null;
    pageSize?.observe(document.documentElement);
    return () => {
      window.removeEventListener('scroll', queueFrame);
      window.removeEventListener('resize', remeasure);
      pageSize?.disconnect();
      if (frameQueued) cancelAnimationFrame(frame);
    };
  }, []);

  const lastIndex = GUIDE.stops.length - 1;

  return (
    <main className="guide">
      <div className="guide__column guide__column--road">
        <header className="road-intro">
          <p className="eyebrow">HOW IT WORKS</p>
          <h1 className="road-intro__title">Follow the road to your risk rating</h1>
          <p className="road-intro__text">
            Every listing takes the same trip. Here is what we check at each stop.
          </p>
        </header>

        <div className="road-trip">
          {activeIndex !== null && (
            <div className="trip-status" aria-hidden="true">
              <p className="trip-status__text">
                <span className="trip-status__label">{GUIDE.stops[activeIndex].label}</span>
                {GUIDE.stops[activeIndex].status}
              </p>
              <div className="trip-status__legs">
                {GUIDE.stops.map((stop, index) => (
                  <span
                    key={stop.title}
                    className="trip-status__leg"
                    data-done={index <= activeIndex ? 'true' : 'false'}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="road" ref={roadRef}>
            <div className="road__lane" aria-hidden="true">
              <span className="road__tag road__tag--start">START</span>
              <span className="road__tag road__tag--finish">FINISH</span>
            </div>

            <ol className="road__stops">
              {GUIDE.stops.map((stop, index) => (
                <li
                  key={stop.title}
                  ref={(element) => {
                    stopRefs.current[index] = element;
                  }}
                  className={`stop ${index % 2 === 0 ? 'stop--left' : 'stop--right'}`}
                  data-active={activeIndex === index ? 'true' : 'false'}
                  data-passed={activeIndex !== null && index < activeIndex ? 'true' : 'false'}
                >
                  <span
                    className={`stop__marker${index === lastIndex ? ' stop__marker--finish' : ''}`}
                    ref={(element) => {
                      markerRefs.current[index] = element;
                    }}
                    aria-hidden="true"
                  >
                    {index === lastIndex ? null : index + 1}
                  </span>
                  <div className="stop__content">
                    <article className="stop__card">
                      <p className="stop__label">{stop.label}</p>
                      <h2 className="stop__title">{stop.title}</h2>
                      <p className="stop__what">{stop.what}</p>
                      <p className="stop__why">
                        <span className="stop__why-label">Why it matters: </span>
                        {stop.why}
                      </p>
                    </article>
                    <HouseIcon color={HOUSE_COLORS[index]} />
                  </div>
                </li>
              ))}
            </ol>

            <div
              className="road__car"
              ref={carRef}
              aria-hidden="true"
              data-flying={carFlying ? 'true' : undefined}
            >
              <CarIcon />
              <span className="road__you">You</span>
            </div>
          </div>
        </div>

        <section className="closing closing--plain" aria-labelledby="road-cta-heading">
          <h2 className="closing__title" id="road-cta-heading">
            Ready to take the trip?
          </h2>
          <CarFlightLink
            to="/check"
            className="button button--accent"
            startFrom={carRef}
            onFlightStart={() => setCarFlying(true)}
          >
            {GUIDE.ctaLabel}
          </CarFlightLink>
          <p className="guide__footnote">{GUIDE.footnote}</p>
        </section>
      </div>
    </main>
  );
}
