import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { animate } from 'motion';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { GUIDE } from '../src/content/guide';
import { MOCK_SCANS } from '../src/data/mockScans';

vi.mock('motion', () => ({ animate: vi.fn(() => ({ stop: vi.fn() })) }));

function renderAt(ui: ReactElement, path: string) {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe('SCRUM-48-T-7 landing page', () => {
  it('SCRUM-48-T-7 logged out root is the landing page', () => {
    renderAt(<App loggedIn={false} />, '/');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Check a rental listing before you pay' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Listing link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check listing' })).not.toBeInTheDocument();
  });

  it('SCRUM-48-T-7 logged in root is still the welcome page', () => {
    renderAt(<App loggedIn initialScans={[]} />, '/');
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });

  it('SCRUM-48-T-7 check route shows the form', () => {
    renderAt(<App loggedIn={false} />, '/check');
    expect(screen.getByLabelText('Listing link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check listing' })).toBeInTheDocument();
  });

  it('SCRUM-48-T-7 check links go to the form', () => {
    renderAt(<App loggedIn={false} />, '/');
    const links = screen.getAllByRole('link', { name: 'Check a listing' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/check');
  });

  it('SCRUM-48-T-7 how it works link', () => {
    renderAt(<App loggedIn={false} />, '/');
    const body = within(screen.getByRole('main'));
    expect(body.getByRole('link', { name: 'See how it works' })).toHaveAttribute(
      'href',
      '/how-it-works',
    );
  });

  it('SCRUM-48-T-7 shows all sections', () => {
    renderAt(<App loggedIn={false} />, '/');
    for (const name of ['How it works', 'What we check, and why', 'Quick answers']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    for (const check of GUIDE.checks) {
      expect(screen.getByRole('heading', { level: 3, name: check.title })).toBeInTheDocument();
    }
  });

  it('SCRUM-48-T-7 legend is on the results page', () => {
    const landing = renderAt(<App loggedIn={false} />, '/');
    expect(screen.queryByText(GUIDE.legendHeading)).not.toBeInTheDocument();
    landing.unmount();

    const scan = MOCK_SCANS[0];
    renderAt(<App loggedIn initialScans={[scan]} />, `/results/${scan.id}`);
    expect(screen.getByRole('heading', { name: GUIDE.legendHeading })).toBeInTheDocument();
    for (const item of GUIDE.legend) expect(screen.getByText(item.text)).toBeInTheDocument();
  });

  it('SCRUM-48-T-7 choosing a check highlights the listing', () => {
    const { container } = renderAt(<App loggedIn={false} />, '/');
    const highlighted = () => container.querySelectorAll('[data-highlight="true"]');
    const [first, second] = GUIDE.checks;
    expect(screen.getByText(first.why)).toBeVisible();
    expect(screen.getByText(second.why)).not.toBeVisible();
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]).toHaveTextContent(GUIDE.listingDemo.rent);

    fireEvent.click(screen.getByRole('button', { name: second.title }));

    expect(screen.getByText(second.why)).toBeVisible();
    expect(screen.getByText(first.why)).not.toBeVisible();
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0]).toHaveTextContent(GUIDE.listingDemo.message);
  });

  it('SCRUM-48-T-7 example result', () => {
    renderAt(<App loggedIn={false} />, '/');
    const example = within(screen.getByRole('region', { name: 'EXAMPLE RESULT' }));
    expect(example.getByText('HIGH RISK')).toBeInTheDocument();
    expect(example.getByText('82')).toBeInTheDocument();
    for (const reason of GUIDE.example.reasons) {
      expect(example.getByText(reason.title)).toBeInTheDocument();
    }
  });

  it('SCRUM-48-T-7 never promises safety', () => {
    renderAt(<App loggedIn={false} />, '/');
    expect(screen.getByText(GUIDE.disclaimer)).toBeInTheDocument();
    expect(screen.getByText(GUIDE.footnote)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(listing|place) is safe\b/i);
  });

  it('SCRUM-48-T-7 wording comes from the content file', () => {
    renderAt(<App loggedIn={false} />, '/');
    for (const step of GUIDE.steps) {
      expect(screen.getByText(step.text)).toBeInTheDocument();
    }
    for (const item of GUIDE.faq) {
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });
});

describe('SCRUM-48-T-7 landing motion', () => {
  /** A fake observer that lets a test decide when things scroll into view. */
  function stubObserver() {
    const observers: { callback: IntersectionObserverCallback; elements: Element[] }[] = [];
    class FakeObserver {
      callback: IntersectionObserverCallback;
      elements: Element[] = [];
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(element: Element) {
        this.elements.push(element);
      }
      disconnect() {
        this.elements = [];
      }
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const scrollIntoView = (matches: (element: Element) => boolean) => {
      act(() => {
        for (const observer of observers) {
          const entries = observer.elements
            .filter(matches)
            .map((target) => ({ target, isIntersecting: true }));
          if (entries.length > 0) {
            observer.callback(
              entries as IntersectionObserverEntry[],
              observer as unknown as IntersectionObserver,
            );
          }
        }
      });
    };
    return { scrollIntoView, everything: () => scrollIntoView(() => true) };
  }

  function mockReducedMotion() {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  }

  const stepItems = () =>
    GUIDE.steps.map((step) => screen.getByText(step.title).closest('li') as HTMLElement);
  const activeSteps = () => stepItems().map((item) => item.getAttribute('data-active') === 'true');

  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.matchMedia = originalMatchMedia;
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  it('SCRUM-48-T-7 example score counts up', () => {
    const { everything } = stubObserver();
    renderAt(<App loggedIn={false} />, '/');
    const example = within(screen.getByRole('region', { name: 'EXAMPLE RESULT' }));
    expect(example.getByText('0')).toBeInTheDocument();

    everything();

    const options = vi.mocked(animate).mock.lastCall?.[2] as { onUpdate: (v: number) => void };
    act(() => options.onUpdate(41.4));
    expect(example.getByText('41')).toBeInTheDocument();
    act(() => options.onUpdate(82));
    expect(example.getByText('82')).toBeInTheDocument();
  });

  it('SCRUM-48-T-7 sections reveal when scrolled into view', () => {
    const { scrollIntoView } = stubObserver();
    const { container } = renderAt(<App loggedIn={false} />, '/');
    const reveals = Array.from(container.querySelectorAll('.reveal'));
    expect(reveals).toHaveLength(3);
    expect(
      screen.getByRole('region', { name: /Check a rental listing/ }).closest('.reveal'),
    ).toBeNull();
    for (const reveal of reveals) expect(reveal).toHaveAttribute('data-shown', 'false');

    scrollIntoView((element) => element === reveals[0]);

    expect(reveals[0]).toHaveAttribute('data-shown', 'true');
    expect(reveals[1]).toHaveAttribute('data-shown', 'false');
    // Hidden sections are still readable by screen readers and tests.
    expect(screen.getByRole('heading', { level: 2, name: 'Quick answers' })).toBeInTheDocument();
  });

  it('SCRUM-48-T-7 car drives past each step on a set schedule', () => {
    vi.useFakeTimers();
    const { everything } = stubObserver();
    const { container } = renderAt(<App loggedIn={false} />, '/');
    const car = container.querySelector('.steps-road__car');
    expect(car).toHaveAttribute('data-step', 'start');
    expect(activeSteps()).toEqual([false, false, false]);

    everything();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(activeSteps()).toEqual([true, false, false]);
    expect(car).toHaveAttribute('data-step', '0');

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(activeSteps()).toEqual([false, true, false]);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(activeSteps()).toEqual([false, false, true]);
    expect(car).toHaveAttribute('data-step', '2');
  });

  it('SCRUM-48-T-7 everything shows without scroll animation', () => {
    const noObserver = renderAt(<App loggedIn={false} />, '/');
    for (const reveal of noObserver.container.querySelectorAll('.reveal')) {
      expect(reveal).toHaveAttribute('data-shown', 'true');
    }
    expect(activeSteps()).toEqual([false, false, false]);
    noObserver.unmount();

    vi.useFakeTimers();
    stubObserver();
    mockReducedMotion();
    const reduced = renderAt(<App loggedIn={false} />, '/');
    for (const reveal of reduced.container.querySelectorAll('.reveal')) {
      expect(reveal).toHaveAttribute('data-shown', 'true');
    }
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(activeSteps()).toEqual([false, false, false]);
    expect(reduced.container.querySelector('.steps-road__car')).toHaveAttribute(
      'data-step',
      'start',
    );
  });

  it('SCRUM-48-T-7 check link plays the car drive-through', () => {
    const animations: { onfinish: (() => void) | null; cancel: () => void }[] = [];
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: () => {
        const animation = { onfinish: null, cancel: vi.fn() };
        animations.push(animation);
        return animation;
      },
    });
    vi.stubGlobal('scrollTo', vi.fn());
    const { container } = renderAt(<App loggedIn={false} />, '/');

    fireEvent.click(screen.getAllByRole('link', { name: 'Check a listing' })[0]);

    expect(container.querySelector('.car-drive')).not.toBeNull();
    expect(animations).toHaveLength(3);
    expect(screen.queryByLabelText('Listing link')).not.toBeInTheDocument();

    act(() => {
      animations[0].onfinish?.();
    });

    expect(screen.getByLabelText('Listing link')).toHaveFocus();
    expect(container.querySelector('.car-drive')).toBeNull();
    expect(container.querySelector('.car-arrival__body')).toBeNull();
    expect(container.querySelector('.car-arrival')).not.toBeNull();

    act(() => {
      animations[animations.length - 1].onfinish?.();
    });

    expect(container.querySelector('.car-arrival')).toBeNull();
    expect(screen.getByLabelText('Listing link')).toHaveFocus();
  });
});

describe('SCRUM-48-T-7 page routes', () => {
  it('SCRUM-48-T-7 opening another page starts at the top', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo');
    renderAt(<App loggedIn={false} />, '/');
    expect(scrollTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: GUIDE.tripLinkLabel }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Follow the road to your risk rating' }),
    ).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it('SCRUM-48-T-7 unknown path shows page not found with a link home', () => {
    renderAt(<App loggedIn={false} />, '/nope');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
  });

  it('SCRUM-48-T-7 unknown scan id shows a not-found message', () => {
    renderAt(<App loggedIn={false} />, '/results/does-not-exist');
    expect(screen.getByRole('heading', { name: "We couldn't find that scan" })).toBeInTheDocument();
  });

  it('SCRUM-48-T-7 scans route redirects to the landing page when logged out', () => {
    renderAt(<App loggedIn={false} />, '/scans');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Check a rental listing before you pay' }),
    ).toBeInTheDocument();
  });
});
