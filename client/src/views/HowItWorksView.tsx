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
/** Every drive from one stop to the next takes this long, however the page was scrolled. */
const DRIVE_MS = 800;
/** Used instead when the car is more than one stop behind, so it never lags far behind the page. */
const CATCH_UP_DRIVE_MS = 350;
/** Frame gaps are clamped so a slow frame cannot make the car jump. */
const MIN_FRAME_MS = 8;
const MAX_FRAME_MS = 50;
const FIRST_FRAME_MS = 16;
/** The car's place before the first stop, at the START tag. */
const AT_START = -1;
interface Drive {
  from: number;
  to: number;
  toStop: number;
  duration: number;
  elapsed: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Pulls away gently, cruises, and brakes gently. */
function easeDrive(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

/** The stop the car should be at: the last one scrolled past the trigger line. */
function destinationStop(scrolled: number, stopCentres: number[], currentStop: number): number {
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

function isScrolledToBottom(): boolean {
  const { scrollHeight } = document.documentElement;
  return (
    scrollHeight > window.innerHeight && window.scrollY + window.innerHeight >= scrollHeight - 2
  );
}

/**
 * The How it works page: a road with six houses, one per step. Scrolling a stop into place sends
 * the car on a fixed drive to that house, and when it parks the stop lights up and a sticky status
 * bar says what is happening there. The drive looks the same however the page was scrolled. With
 * reduced motion on, the page is a plain ordered list (the car stays at the top, nothing is
 * highlighted, and the status bar is not shown).
 */
export default function HowItWorksView() {
  const roadRef = useRef<HTMLDivElement>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const stopRefs = useRef<(HTMLLIElement | null)[]>([]);
  const markerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [carFlying, setCarFlying] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    let currentStop = AT_START;
    let drive: Drive | null = null;
    let frame = 0;
    let frameQueued = false;
    let lastTime: number | null = null;

    function readRoad() {
      const road = roadRef.current;
      const car = carRef.current;
      if (!road || !car) return null;

      const rect = road.getBoundingClientRect();
      const carHeight = car.getBoundingClientRect().height || CAR_HEIGHT;
      const stopCentres = stopRefs.current.map((stop, index) => {
        const marker = markerRefs.current[index];
        const markerCentre = marker ? marker.offsetTop + marker.offsetHeight / 2 : 0;
        return (stop?.getBoundingClientRect().top ?? 0) - rect.top + markerCentre;
      });
      const start = car.offsetTop + carHeight / 2;
      const scrolled = window.innerHeight * TRIGGER_LINE - rect.top;
      const destination = isScrolledToBottom()
        ? stopCentres.length - 1
        : destinationStop(scrolled, stopCentres, currentStop);
      const centreOf = (stop: number) => (stop === AT_START ? start : stopCentres[stop]);
      const placeCar = (carCentre: number) => {
        const carTop = carCentre - carHeight / 2 - car.offsetTop;
        car.style.transform = `translate3d(0, ${carTop.toFixed(2)}px, 0)`;
      };
      return { destination, centreOf, placeCar };
    }

    function tick(now: number) {
      frameQueued = false;
      const road = readRoad();
      if (!road) return;
      const { destination, centreOf, placeCar } = road;

      if (!drive) {
        if (destination === currentStop) {
          // Nothing to drive to. Keep the car on its stop if the layout shifted.
          placeCar(centreOf(currentStop));
          lastTime = null;
          return;
        }
        const direction = destination > currentStop ? 1 : -1;
        const toStop = currentStop + direction;
        drive = {
          from: centreOf(currentStop),
          to: centreOf(toStop),
          toStop,
          duration: Math.abs(destination - currentStop) > 1 ? CATCH_UP_DRIVE_MS : DRIVE_MS,
          elapsed: 0,
        };
      }

      const gap =
        lastTime === null ? FIRST_FRAME_MS : clamp(now - lastTime, MIN_FRAME_MS, MAX_FRAME_MS);
      lastTime = now;
      drive.elapsed = Math.min(drive.duration, drive.elapsed + gap);
      const progress = easeDrive(drive.elapsed / drive.duration);
      placeCar(drive.from + (drive.to - drive.from) * progress);

      if (drive.elapsed >= drive.duration) {
        currentStop = drive.toStop;
        drive = null;
        setActiveIndex(Math.max(currentStop, 0));
      }
      queueFrame();
    }

    function queueFrame() {
      if (frameQueued) return;
      frameQueued = true;
      frame = requestAnimationFrame(tick);
    }

    const initial = readRoad();
    if (initial) {
      currentStop = initial.destination;
      initial.placeCar(initial.centreOf(currentStop));
      setActiveIndex(Math.max(currentStop, 0));
    }

    window.addEventListener('scroll', queueFrame, { passive: true });
    window.addEventListener('resize', queueFrame);
    return () => {
      window.removeEventListener('scroll', queueFrame);
      window.removeEventListener('resize', queueFrame);
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
