import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CarBox } from '../lib/carArrival';
import { CAR_BODY_INSET, CAR_BODY_RADIUS, CAR_WIDTH } from '../lib/carShape';
import { CarIcon } from './RoadIcons';

const MORPH_MS = 620;
/** The shape finishes here; the rest of the time the outline fades into the real input. */
const MORPH_SHAPE_DONE = 0.82;
const PAGE_REVEAL_DELAY_MS = 220;
const PAGE_REVEAL_MS = 380;
const CAR_DETAILS_FADE_MS = 160;
const CAR_RED = '#c2512f';
const CAR_OUTLINE = '#2b1d12';

interface CarArrivalProps {
  from: CarBox;
  /** The input the car turns into. */
  targetRef: RefObject<HTMLElement | null>;
}

/**
 * The second half of the car transition: the car's wheels and windows fade, its body reshapes into
 * the target input, and the page fades in around it. Afterwards the router state is cleared so a
 * refresh or a trip back through history doesn't play it again.
 */
export default function CarArrival({ from, targetRef }: CarArrivalProps) {
  const veilRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const scale = from.width / CAR_WIDTH;
  const inset = CAR_BODY_INSET * scale;
  const bodyBox = {
    left: from.left + inset,
    top: from.top + inset,
    width: from.width - 2 * inset,
    height: from.height - 2 * inset,
  };

  useLayoutEffect(() => {
    const finish = () => navigate(pathname, { replace: true, state: null });
    const target = targetRef.current;
    const veil = veilRef.current;
    const body = bodyRef.current;
    const details = detailsRef.current;
    window.scrollTo(0, 0);
    if (!target || !veil || !body || !details || typeof body.animate !== 'function') {
      finish();
      return;
    }

    const box = target.getBoundingClientRect();
    const targetStyle = getComputedStyle(target);
    const px = (value: number) => `${value}px`;
    const shape = (left: number, top: number, width: number, height: number) => ({
      left: px(left),
      top: px(top),
      width: px(width),
      height: px(height),
    });
    const inputShape = {
      ...shape(box.left, box.top, box.width, box.height),
      borderRadius: targetStyle.borderRadius,
      backgroundColor: targetStyle.backgroundColor,
    };

    const animations = [
      veil.animate([{ opacity: 1 }, { opacity: 0 }], {
        delay: PAGE_REVEAL_DELAY_MS,
        duration: PAGE_REVEAL_MS,
        easing: 'ease-out',
        fill: 'both',
      }),
      details.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: CAR_DETAILS_FADE_MS,
        easing: 'ease-out',
        fill: 'forwards',
      }),
    ];
    const morph = body.animate(
      [
        {
          ...shape(bodyBox.left, bodyBox.top, bodyBox.width, bodyBox.height),
          borderRadius: px(CAR_BODY_RADIUS * scale),
          backgroundColor: CAR_RED,
          borderColor: CAR_OUTLINE,
          opacity: 1,
          easing: 'cubic-bezier(0.65, 0, 0.2, 1)',
        },
        { ...inputShape, borderColor: CAR_RED, opacity: 1, offset: MORPH_SHAPE_DONE },
        { ...inputShape, borderColor: targetStyle.borderColor, opacity: 0 },
      ],
      { duration: MORPH_MS, fill: 'forwards' },
    );
    morph.onfinish = finish;
    animations.push(morph);
    return () => animations.forEach((animation) => animation.cancel());
  }, [
    bodyBox.height,
    bodyBox.left,
    bodyBox.top,
    bodyBox.width,
    navigate,
    pathname,
    scale,
    targetRef,
  ]);

  return (
    <div className="car-arrival" aria-hidden="true">
      <div className="car-arrival__veil" ref={veilRef} />
      <div
        className="car-arrival__body"
        ref={bodyRef}
        style={{
          left: bodyBox.left,
          top: bodyBox.top,
          width: bodyBox.width,
          height: bodyBox.height,
        }}
      />
      <div
        className="car-arrival__details"
        ref={detailsRef}
        style={{ left: from.left, top: from.top, width: from.width, height: from.height }}
      >
        <CarIcon />
      </div>
    </div>
  );
}
