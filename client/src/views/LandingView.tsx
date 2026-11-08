import { animate } from 'motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CarDriveLink from '../components/CarDriveLink';
import ChevronIcon from '../components/ChevronIcon';
import { RatingChip, StatusChip } from '../components/Chip';
import Reveal from '../components/Reveal';
import { CarIcon, HouseIcon } from '../components/RoadIcons';
import { GUIDE } from '../content/guide';
import { canAnimateOnScroll } from '../lib/motion';
import { useInView } from '../lib/useInView';
import type { CheckStatus } from '../types';

/** Pause before the car sets off, and the time between stops (an 800ms drive, then parked). */
const TRIP_START_MS = 250;
const TRIP_LEG_MS = 1100;
const SCORE_COUNT_SECONDS = 1.2;
const DEMO_PHOTO_COLOR = '#ead7b5';

/** The example result, whose score counts up the first time it comes into view. */
function ExampleResult() {
  const target = GUIDE.example.score;
  const { ref, inView } = useInView<HTMLElement>();
  const [animated] = useState(canAnimateOnScroll);
  const [score, setScore] = useState(animated ? 0 : target);

  useEffect(() => {
    if (!animated || !inView) return;
    const controls = animate(0, target, {
      duration: SCORE_COUNT_SECONDS,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (value) => setScore(Math.round(value)),
    });
    return () => controls.stop();
  }, [animated, inView, target]);

  return (
    <section ref={ref} className="guide-card example" aria-labelledby="example-heading">
      <h2 className="eyebrow eyebrow--muted" id="example-heading">
        EXAMPLE RESULT
      </h2>
      <p className="example__meta">{GUIDE.example.meta}</p>
      <div className="example__score">
        <RatingChip rating="HIGH" />
        <p className="example__figure">
          <span className="example__value">{score}</span>
          <span className="example__max">/ 100</span>
        </p>
        <div className="example__bar" aria-hidden="true">
          <div className="example__bar-fill" style={{ width: `${target}%` }} />
        </div>
      </div>
      <ul className="example__reasons">
        {GUIDE.example.reasons.map((reason) => (
          <li key={reason.title} className="example__reason">
            <span className="example__reason-text">
              <span className="example__reason-title">{reason.title}</span>
              <span className="example__reason-detail">{reason.detail}</span>
            </span>
            <StatusChip status={reason.status as CheckStatus} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The four checks beside a mock listing. Choosing a check highlights what it looks at. */
function WhatWeCheck() {
  const [selectedId, setSelectedId] = useState<string>(GUIDE.checks[0].id);
  const demo = GUIDE.listingDemo;
  const highlight = (checkId: string) => (selectedId === checkId ? 'true' : 'false');

  return (
    <section className="inspect" aria-labelledby="checks-heading">
      <h2 className="guide__heading" id="checks-heading">
        What we check, and why
      </h2>
      <div className="inspect__grid">
        <ul className="inspect__checks">
          {GUIDE.checks.map((check) => {
            const selected = selectedId === check.id;
            const reasonId = `check-reason-${check.id}`;
            return (
              <li key={check.id} className="inspect__check" data-selected={selected}>
                <h3 className="inspect__title">
                  <button
                    type="button"
                    className="inspect__button"
                    aria-expanded={selected}
                    aria-controls={reasonId}
                    onClick={() => setSelectedId(check.id)}
                  >
                    {check.title}
                  </button>
                </h3>
                <p className="inspect__why" id={reasonId} hidden={!selected}>
                  {check.why}
                </p>
              </li>
            );
          })}
        </ul>

        <article className="guide-card listing-demo" aria-label={demo.label}>
          <p className="eyebrow eyebrow--muted">{demo.label}</p>
          <div className="listing-demo__part" data-highlight={highlight('details')}>
            <div className="listing-demo__photo">
              <HouseIcon color={DEMO_PHOTO_COLOR} />
            </div>
            <p className="listing-demo__title">{demo.title}</p>
            <p className="listing-demo__description">{demo.description}</p>
          </div>
          <p className="listing-demo__part listing-demo__rent" data-highlight={highlight('rent')}>
            {demo.rent}
            <span className="listing-demo__location">{demo.location}</span>
          </p>
          <p className="listing-demo__part" data-highlight={highlight('landlord')}>
            {demo.poster}
          </p>
          <p
            className="listing-demo__part listing-demo__message"
            data-highlight={highlight('payment')}
          >
            {demo.message}
          </p>
        </article>
      </div>
    </section>
  );
}

/** The three steps under a road. The car drives past each one, once, when they come into view. */
function StepsTrip() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [animated] = useState(canAnimateOnScroll);
  const [tripStep, setTripStep] = useState<number | null>(null);

  useEffect(() => {
    if (!animated || !inView) return;
    const timers = GUIDE.steps.map((_step, index) =>
      setTimeout(() => setTripStep(index), TRIP_START_MS + index * TRIP_LEG_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [animated, inView]);

  return (
    <div ref={ref}>
      <div className="steps-road" aria-hidden="true">
        {GUIDE.steps.map((step, index) => (
          <span
            key={step.title}
            className="steps-road__marker"
            data-index={index}
            data-reached={tripStep !== null && index <= tripStep ? 'true' : 'false'}
          >
            {index + 1}
          </span>
        ))}
        <div className="steps-road__car" data-step={tripStep ?? 'start'}>
          <CarIcon />
        </div>
      </div>
      <ol className="steps">
        {GUIDE.steps.map((step, index) => (
          <li
            key={step.title}
            className="steps__item"
            data-active={tripStep === index ? 'true' : 'false'}
          >
            <h3 className="steps__title">
              <span className="steps__number" aria-hidden="true">
                {index + 1}
              </span>
              {step.title}
            </h3>
            <p className="steps__text">{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Logged-out home: shows what Verilet does and sends visitors to the form at /check. */
export default function LandingView() {
  const [before, after] = GUIDE.headline.split(GUIDE.headlineAccent);

  return (
    <main className="guide">
      <div className="guide__column guide__column--landing">
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero__copy">
            <p className="eyebrow">{GUIDE.eyebrow}</p>
            <h1 className="hero__title" id="hero-heading">
              {before}
              <span className="hero__accent">{GUIDE.headlineAccent}</span>
              {after}
            </h1>
            <p className="hero__text">{GUIDE.pitch}</p>
            <div className="hero__actions">
              <CarDriveLink to="/check" className="button button--accent">
                {GUIDE.ctaLabel}
              </CarDriveLink>
              <Link to="/how-it-works" className="button button--secondary">
                {GUIDE.howLabel}
              </Link>
            </div>
            <p className="hero__reassurance">{GUIDE.reassurance}</p>
          </div>
          <ExampleResult />
        </section>

        <Reveal>
          <WhatWeCheck />
        </Reveal>

        <Reveal>
          <section className="trip" aria-labelledby="steps-heading">
            <h2 className="guide__heading" id="steps-heading">
              How it works
            </h2>
            <StepsTrip />
            <Link to="/how-it-works" className="trip__link">
              {GUIDE.tripLinkLabel}
            </Link>
          </section>
        </Reveal>

        <Reveal>
          <div className="honest">
            <section className="honest__faq" aria-labelledby="faq-heading">
              <h2 className="guide__heading" id="faq-heading">
                Quick answers
              </h2>
              <p className="guide__note">{GUIDE.disclaimer}</p>
              <ul className="faq">
                {GUIDE.faq.map((item) => (
                  <li key={item.question}>
                    <details className="faq__item">
                      <summary className="faq__summary">
                        <h3 className="faq__question">{item.question}</h3>
                        <ChevronIcon />
                      </summary>
                      <p className="faq__answer">{item.answer}</p>
                    </details>
                  </li>
                ))}
              </ul>
            </section>

            <section className="closing" aria-labelledby="closing-heading">
              <h2 className="closing__title" id="closing-heading">
                Check a listing before you send money
              </h2>
              <p className="closing__text">No account needed.</p>
              <CarDriveLink to="/check" className="button button--accent">
                {GUIDE.ctaLabel}
              </CarDriveLink>
            </section>

            <p className="guide__footnote">{GUIDE.footnote}</p>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
