import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { GUIDE } from '../src/content/guide';

let scrollY = 0;

function mockMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

/** jsdom has no layout, so give the road, stops and car fixed sizes that move with `scrollY`. */
function mockGeometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    let top = 0;
    let height = 0;
    if (this.classList.contains('road')) {
      top = -scrollY;
      height = 2000;
    } else if (this.classList.contains('road__car')) {
      height = 62;
    } else if (this.id.endsWith('-listingUrl')) {
      top = 200;
      height = 48;
    } else if (this.classList.contains('stop')) {
      const index = Array.from(this.parentElement?.children ?? []).indexOf(this);
      top = index * 300 - scrollY + 80;
      height = 200;
    }
    return {
      top,
      bottom: top + height,
      left: 0,
      right: 0,
      width: 0,
      height,
      x: 0,
      y: top,
    } as DOMRect;
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/how-it-works']}>
      <App loggedIn={false} />
    </MemoryRouter>,
  );
}

function scrollTo(y: number) {
  scrollY = y;
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

/** Replaces the synchronous frame stub so a test can step the animation one frame at a time. */
function manualFrames() {
  let queue: { id: number; callback: FrameRequestCallback }[] = [];
  let nextId = 1;
  let time = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queue.push({ id: nextId, callback });
    nextId += 1;
    return nextId - 1;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue = queue.filter((entry) => entry.id !== id);
  });
  const step = () => {
    act(() => {
      const due = queue;
      queue = [];
      time += 16;
      due.forEach((entry) => entry.callback(time));
    });
  };
  return {
    pending: () => queue.length,
    step,
    runUntilIdle: () => {
      for (let guard = 0; queue.length > 0 && guard < 1000; guard += 1) step();
    },
  };
}

/** Starts a drive, optionally scrolls again mid-drive, and records the car's position per frame. */
function manualFramesPositions(
  frames: ReturnType<typeof manualFrames>,
  car: HTMLElement | null,
  start: () => void,
  midDrive?: () => void,
) {
  start();
  const positions: (string | undefined)[] = [];
  for (let frame = 0; frames.pending() > 0 && frame < 1000; frame += 1) {
    if (frame === 5) midDrive?.();
    frames.step();
    positions.push(car?.style.transform);
  }
  return positions;
}

const activeStops = () =>
  screen.getAllByRole('listitem').filter((item) => item.getAttribute('data-active') === 'true');

beforeEach(() => {
  scrollY = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  mockGeometry();
  mockMotion(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SCRUM-48-T-8 how it works page', () => {
  it('SCRUM-48-T-8 shows six stops in order', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Follow the road to your risk rating' }),
    ).toBeInTheDocument();
    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles.slice(0, 6)).toEqual([
      'Paste the link',
      'Rent vs. area price',
      'Payment method',
      'Landlord check',
      'Listing details',
      'Your risk rating',
    ]);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('SCRUM-48-T-8 each stop has its explanation', () => {
    renderPage();
    const stops = screen.getAllByRole('listitem');
    GUIDE.stops.forEach((stop, index) => {
      const item = within(stops[index]);
      expect(item.getByText(stop.label)).toBeInTheDocument();
      expect(item.getByText(stop.what)).toBeInTheDocument();
      expect(item.getByText(stop.why)).toBeInTheDocument();
      expect(item.getByText(/Why it matters:/)).toBeInTheDocument();
    });
  });

  it('SCRUM-48-T-8 header link is current on this page', () => {
    renderPage();
    const link = within(screen.getByRole('navigation', { name: 'Site' })).getByRole('link', {
      name: 'How it works',
    });
    expect(link).toHaveAttribute('href', '/how-it-works');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('SCRUM-48-T-8 car follows the scroll and highlights a stop', () => {
    const { container } = renderPage();
    const car = container.querySelector<HTMLElement>('.road__car');
    expect(car).not.toBeNull();
    const before = car?.style.transform;
    expect(activeStops()).toHaveLength(1);
    const firstActive = activeStops()[0];

    scrollTo(1000);

    expect(car?.style.transform).not.toBe(before);
    expect(activeStops()).toHaveLength(1);
    expect(activeStops()[0]).not.toBe(firstActive);
  });

  it('SCRUM-48-T-8 reduced motion turns animation off', () => {
    mockMotion(true);
    const { container } = renderPage();
    const car = container.querySelector<HTMLElement>('.road__car');

    scrollTo(1000);

    expect(car?.style.transform).toBe('');
    expect(activeStops()).toHaveLength(0);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('SCRUM-48-T-8 graphics are decorative', () => {
    const { container } = renderPage();
    const graphics = container.querySelectorAll('svg.house, svg.car');
    expect(graphics.length).toBe(7);
    graphics.forEach((graphic) => expect(graphic).toHaveAttribute('aria-hidden', 'true'));
  });

  it('SCRUM-48-T-8 closing link goes to the check page', () => {
    renderPage();
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('link', { name: 'Check a listing' })).toHaveAttribute('href', '/check');
  });

  describe('SCRUM-48-T-8 set drive', () => {
    // In the stubbed geometry, stop N is at 80 + 300 * N on the road.
    const triggerLine = () => window.innerHeight * 0.6;
    const scrollPast = (stop: number, extra = 10) =>
      scrollTo(80 + 300 * stop - triggerLine() + extra);
    const carTop = (car: HTMLElement | null) =>
      parseFloat(car?.style.transform.split(', ')[1] ?? '0');
    const activePosition = () => screen.getAllByRole('listitem').indexOf(activeStops()[0]);

    function framesToFinish(frames: ReturnType<typeof manualFrames>) {
      let count = 0;
      while (frames.pending() > 0 && count < 1000) {
        frames.step();
        count += 1;
      }
      return count;
    }

    it('SCRUM-48-T-8 car plays over several frames and parks exactly on the stop', () => {
      const frames = manualFrames();
      const { container } = renderPage();
      const car = container.querySelector<HTMLElement>('.road__car');
      const start = carTop(car);

      scrollPast(2);
      frames.step();
      const early = carTop(car);
      framesToFinish(frames);

      expect(early).toBeGreaterThanOrEqual(start);
      expect(early).toBeLessThan(start + 300);
      expect(carTop(car)).toBeCloseTo(start + 300, 1);
      expect(frames.pending()).toBe(0);
    });

    it('SCRUM-48-T-8 drive takes the same time however far past the stop you scroll', () => {
      const small = manualFrames();
      const first = renderPage();
      scrollPast(2, 5);
      const smallCount = framesToFinish(small);
      first.unmount();

      scrollY = 0;
      const large = manualFrames();
      renderPage();
      scrollPast(2, 250);
      expect(framesToFinish(large)).toBe(smallCount);
    });

    it('SCRUM-48-T-8 scrolling during a drive does not steer the car', () => {
      const frames = manualFrames();
      const { container } = renderPage();
      const car = container.querySelector<HTMLElement>('.road__car');
      const steady = manualFramesPositions(frames, car, () => scrollPast(2, 10));
      cleanup();

      scrollY = 0;
      const nudged = manualFrames();
      const second = renderPage();
      const secondCar = second.container.querySelector<HTMLElement>('.road__car');
      const withNudge = manualFramesPositions(
        nudged,
        secondCar,
        () => scrollPast(2, 10),
        () => scrollPast(2, 200),
      );

      expect(withNudge).toEqual(steady);
    });

    it('SCRUM-48-T-8 car does not move when no stop is crossed', () => {
      const frames = manualFrames();
      const { container } = renderPage();
      const car = container.querySelector<HTMLElement>('.road__car');
      scrollPast(2);
      framesToFinish(frames);
      const parked = car?.style.transform;

      scrollPast(2, 120);
      framesToFinish(frames);
      expect(car?.style.transform).toBe(parked);

      // A small scroll back stays parked too.
      scrollPast(2, -20);
      framesToFinish(frames);
      expect(car?.style.transform).toBe(parked);
    });

    it('SCRUM-48-T-8 stop lights up only when the car arrives', () => {
      const frames = manualFrames();
      renderPage();
      const before = activePosition();

      scrollPast(2);
      frames.step();
      expect(activePosition()).toBe(before);

      framesToFinish(frames);
      expect(activePosition()).toBe(2);
    });

    it('SCRUM-48-T-8 car visits every stop in order after a long scroll', () => {
      const frames = manualFrames();
      renderPage();
      const visited = [activePosition()];

      scrollPast(4);
      for (let guard = 0; frames.pending() > 0 && guard < 1000; guard += 1) {
        frames.step();
        if (visited[visited.length - 1] !== activePosition()) visited.push(activePosition());
      }

      expect(visited).toEqual([1, 2, 3, 4]);
    });

    it('SCRUM-48-T-8 car drives back when scrolling up', () => {
      const frames = manualFrames();
      renderPage();
      scrollPast(3);
      framesToFinish(frames);
      expect(activePosition()).toBe(3);

      scrollPast(2);
      framesToFinish(frames);
      expect(activePosition()).toBe(2);
    });
  });

  it('SCRUM-48-T-8 status bar says what happens at the current stop', () => {
    const { container } = renderPage();
    const statusBar = () => container.querySelector<HTMLElement>('.trip-status');
    const activePosition = () => screen.getAllByRole('listitem').indexOf(activeStops()[0]);
    const expectStatusForActiveStop = () => {
      const stop = GUIDE.stops[activePosition()];
      expect(statusBar()).toHaveTextContent(stop.label);
      expect(statusBar()).toHaveTextContent(stop.status);
    };

    expectStatusForActiveStop();
    const first = activePosition();

    scrollTo(1000);

    expect(activePosition()).toBeGreaterThan(first);
    expectStatusForActiveStop();
    expect(statusBar()).toHaveAttribute('aria-hidden', 'true');
  });

  it('SCRUM-48-T-8 stops behind the car are marked as passed', () => {
    renderPage();
    scrollTo(1000);
    const stops = screen.getAllByRole('listitem');
    const active = stops.indexOf(activeStops()[0]);
    expect(active).toBeGreaterThan(0);
    stops.forEach((stop, index) => {
      expect(stop).toHaveAttribute('data-passed', index < active ? 'true' : 'false');
    });
  });

  it('SCRUM-48-T-8 reduced motion hides the status bar', () => {
    mockMotion(true);
    const { container } = renderPage();
    scrollTo(1000);
    expect(container.querySelector('.trip-status')).toBeNull();
    screen
      .getAllByRole('listitem')
      .forEach((stop) => expect(stop).toHaveAttribute('data-passed', 'false'));
  });

  it('SCRUM-48-T-8 cancels a running animation on unmount', () => {
    const frames = manualFrames();
    const { unmount } = renderPage();
    scrollTo(1000);
    expect(frames.pending()).toBe(1);
    unmount();
    expect(frames.pending()).toBe(0);
  });

  describe('SCRUM-48-T-8 car flight', () => {
    function stubAnimate() {
      const animations: { onfinish: (() => void) | null; cancel: () => void }[] = [];
      const animate = vi.fn<(keyframes: Keyframe[]) => (typeof animations)[number]>(() => {
        const animation = { onfinish: null, cancel: vi.fn() };
        animations.push(animation);
        return animation;
      });
      Object.defineProperty(HTMLElement.prototype, 'animate', {
        configurable: true,
        value: animate,
      });
      vi.stubGlobal('scrollTo', vi.fn());
      const finishLatest = () => {
        act(() => {
          animations[animations.length - 1].onfinish?.();
        });
      };
      return { animate, animations, finishLatest };
    }

    const checkLink = () =>
      within(screen.getByRole('main')).getByRole('link', { name: 'Check a listing' });

    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate');
    });

    it('SCRUM-48-T-8 check link morphs the car into the listing link', () => {
      const { animate, finishLatest } = stubAnimate();
      const { container } = renderPage();

      fireEvent.click(checkLink());

      expect(container.querySelector('.car-flight')).not.toBeNull();
      expect(animate).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText('Listing link')).not.toBeInTheDocument();

      finishLatest();

      expect(screen.getByLabelText('Listing link')).toHaveFocus();
      expect(container.querySelector('.car-flight')).toBeNull();
      expect(container.querySelector('.car-arrival')).not.toBeNull();
      expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
      const [keyframes] = animate.mock.lastCall as unknown as [Keyframe[]];
      const finalShape = keyframes[keyframes.length - 1];
      expect(finalShape.top).toBe('200px');
      expect(finalShape.height).toBe('48px');

      finishLatest();

      expect(container.querySelector('.car-arrival')).toBeNull();
      expect(screen.getByLabelText('Listing link')).toHaveFocus();
    });

    it('SCRUM-48-T-8 reduced motion skips the car flight', () => {
      const { animate } = stubAnimate();
      mockMotion(true);
      const { container } = renderPage();

      fireEvent.click(checkLink());

      expect(animate).not.toHaveBeenCalled();
      expect(container.querySelector('.car-flight')).toBeNull();
      expect(screen.getByLabelText('Listing link')).toBeInTheDocument();
    });

    it('SCRUM-48-T-8 modified click skips the car flight', () => {
      const { animate } = stubAnimate();
      const { container } = renderPage();

      fireEvent.click(checkLink(), { ctrlKey: true });

      expect(animate).not.toHaveBeenCalled();
      expect(container.querySelector('.car-flight')).toBeNull();
    });

    it('SCRUM-48-T-8 clicking again during the flight does not restart it', () => {
      const { animate } = stubAnimate();
      renderPage();
      fireEvent.click(checkLink());
      fireEvent.click(checkLink());
      expect(animate).toHaveBeenCalledTimes(1);
    });

    it('SCRUM-48-T-8 the road car hides while its copy takes off', () => {
      stubAnimate();
      const { container } = renderPage();
      const car = container.querySelector('.road__car');
      expect(car).not.toHaveAttribute('data-flying');
      fireEvent.click(checkLink());
      expect(car).toHaveAttribute('data-flying', 'true');
    });

    it('SCRUM-48-T-8 leaving the page cancels the car flight', () => {
      const { animations } = stubAnimate();
      const { unmount } = renderPage();

      fireEvent.click(checkLink());
      unmount();

      expect(animations[0].cancel).toHaveBeenCalled();
    });
  });

  it('SCRUM-48-T-8 at the top of the page the car waits at the start', () => {
    // The road starts far below the trigger line, so no stop has been crossed.
    scrollY = -1000;
    const { container } = renderPage();
    const car = container.querySelector<HTMLElement>('.road__car');

    expect(car?.style.transform).toBe('translate3d(0, 0.00px, 0)');
    expect(screen.getAllByRole('listitem').indexOf(activeStops()[0])).toBe(0);
    screen
      .getAllByRole('listitem')
      .forEach((stop) => expect(stop).toHaveAttribute('data-passed', 'false'));
  });

  it('SCRUM-48-T-8 reaching the bottom of the page drives to the finish', () => {
    renderPage();
    const heightSpy = vi
      .spyOn(document.documentElement, 'scrollHeight', 'get')
      .mockReturnValue(1000);
    vi.stubGlobal('scrollY', 300);

    scrollTo(50);

    expect(screen.getAllByRole('listitem').indexOf(activeStops()[0])).toBe(GUIDE.stops.length - 1);
    heightSpy.mockRestore();
  });

  it('SCRUM-48-T-8 resizing keeps the car on its stop', () => {
    const { container } = renderPage();
    const car = container.querySelector<HTMLElement>('.road__car');
    const before = car?.style.transform;
    const active = activeStops()[0];

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(car?.style.transform).toBe(before);
    expect(activeStops()[0]).toBe(active);
  });

  it('SCRUM-48-T-8 reduced motion never starts the animation', () => {
    const request = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    mockMotion(true);
    renderPage();
    scrollTo(1000);
    expect(request).not.toHaveBeenCalled();
  });

  it('SCRUM-48-T-8 cleans up the scroll listener', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderPage();
    unmount();
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });
});
