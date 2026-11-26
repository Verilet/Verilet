import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { loadScans, parseTransientScan, saveScans } from '../src/lib/scanStorage';
import { checkListing } from '../src/services/scanService';
import type { ListingInput, ScanCheck, ScanResult } from '../src/types';
import ResultsView from '../src/views/ResultsView';

const VALID_INPUT: ListingInput = {
  listingUrl: 'https://santacruz.craigslist.org/apa/d/santa-cruz-2br/1234567890.html',
  rent: 1200,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: 'Pacific Coast Properties',
  payment: 'gift-card',
  securityDeposit: 2000,
  applicationFee: 50,
  contactPhone: '831-555-0199',
  description: 'Sunny 2 bedroom apartment near campus.',
  photos: [new File(['img'], 'listing.png', { type: 'image/png' })],
};

const SAMPLE_CHECKS: ScanCheck[] = [
  {
    id: 'price',
    title: 'Price Baseline Comparison',
    detail: 'Rent is 45% of baseline.',
    status: 'FLAG',
    scoreImpact: 35,
    evidence: '45% of baseline',
  },
  {
    id: 'untraceablePayment',
    title: 'Payment Method Security',
    detail: 'Gift card payment requested.',
    status: 'FLAG',
    scoreImpact: 40,
    evidence: 'gift-card',
  },
  {
    id: 'applicationFee',
    title: 'Application Screening Fee Cap',
    detail: 'Application fee complies with California statutory limits.',
    status: 'OK',
    scoreImpact: 0,
    evidence: 'Cal. Civ. Code § 1950.6',
  },
  {
    id: 'gisQuery',
    title: 'County GIS Property Records',
    detail: 'County GIS service unavailable.',
    status: 'UNKNOWN',
    scoreImpact: 0,
    evidence: null,
  },
  {
    id: 'agencyStanding',
    title: 'Rental Agency Business Registry',
    detail: 'Landlord not specified; check skipped.',
    status: 'SKIPPED',
    scoreImpact: 0,
    evidence: null,
  },
];

async function fillRequiredForm(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText('Listing link'), VALID_INPUT.listingUrl);
  await user.type(screen.getByLabelText('Monthly rent'), '1200');
  await user.selectOptions(screen.getByLabelText('Bedrooms'), '2');
  await user.type(screen.getByLabelText('City or address'), VALID_INPUT.location);
  await user.selectOptions(
    screen.getByLabelText('How does the landlord ask for payment?'),
    'gift-card',
  );
}

describe('SCRUM-70-T-3: Frontend evaluation integration, loading overlay, and diagnostics UI', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    sessionStorage.clear();
  });

  it('[Criterion 4] dispatches JSON POST to /api/evaluate with validated ListingInput fields', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          score: 75,
          rating: 'HIGH',
          summary: 'High risk (75/100): multiple critical warning flags detected.',
          checks: SAMPLE_CHECKS,
          rawChecks: {},
        },
      }),
    } as Response);

    const result = await checkListing(VALID_INPUT);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = fetchSpy.mock.calls[0];
    expect(String(calledUrl)).toMatch(/\/api\/evaluate$/);
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(options?.signal).toBeInstanceOf(AbortSignal);

    const parsedBody = JSON.parse(String(options?.body));
    expect(parsedBody).toEqual({
      listingUrl: VALID_INPUT.listingUrl,
      rent: VALID_INPUT.rent,
      bedrooms: VALID_INPUT.bedrooms,
      location: VALID_INPUT.location,
      landlord: VALID_INPUT.landlord,
      payment: VALID_INPUT.payment,
      securityDeposit: VALID_INPUT.securityDeposit,
      applicationFee: VALID_INPUT.applicationFee,
      contactPhone: VALID_INPUT.contactPhone,
      description: VALID_INPUT.description,
    });
    expect(parsedBody).not.toHaveProperty('photos');

    expect(result.score).toBe(75);
    expect(result.rating).toBe('HIGH');
    expect(result.summary).toBe('High risk (75/100): multiple critical warning flags detected.');
    expect(result.checks).toEqual(SAMPLE_CHECKS);
    expect(result.photos).toEqual(VALID_INPUT.photos);
  });

  it('[Criterion 5] mounts turning-gear loading overlay and disables controls while evaluating', async () => {
    let resolveFetch!: (response: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => pendingFetch);

    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/check']}>
        <App loggedIn={false} />
      </MemoryRouter>,
    );

    expect(container.querySelector('.listing-form__overlay')).toBeNull();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    await fillRequiredForm(user);
    await user.click(screen.getByRole('button', { name: 'Check listing' }));

    const overlay = container.querySelector('.listing-form__overlay');
    expect(overlay).not.toBeNull();
    expect(overlay).toHaveAttribute('role', 'status');
    expect(overlay).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Checking listing details…')).toBeVisible();

    const gear = container.querySelector('.listing-form__gear');
    expect(gear).not.toBeNull();
    expect(gear).toHaveAttribute('aria-hidden', 'true');
    expect(gear).toHaveClass('listing-form__gear--spinning');

    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Autofill' })).toBeDisabled();
    expect(screen.getByLabelText('Listing link')).toBeDisabled();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          score: 75,
          rating: 'HIGH',
          summary: 'High risk (75/100): multiple critical warning flags detected.',
          checks: SAMPLE_CHECKS,
          rawChecks: {},
        },
      }),
    } as Response);

    expect(
      await screen.findByRole('heading', { level: 1, name: /scam signals/i }),
    ).toBeInTheDocument();
  });

  it('[Criterion 6] disables spinning animation under prefers-reduced-motion', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    let resolveFetch!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/check']}>
        <App loggedIn={false} />
      </MemoryRouter>,
    );

    await fillRequiredForm(user);
    await user.click(screen.getByRole('button', { name: 'Check listing' }));

    const gear = container.querySelector('.listing-form__gear');
    expect(gear).not.toBeNull();
    expect(gear).not.toHaveClass('listing-form__gear--spinning');
    expect(screen.getByText('Checking listing details…')).toBeVisible();

    resolveFetch({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          score: 20,
          rating: 'LOW',
          summary: 'Low risk (20/100).',
          checks: SAMPLE_CHECKS,
          rawChecks: {},
        },
      }),
    } as Response);

    await screen.findByRole('heading', { level: 1, name: /looks low risk/i });
  });

  it('[Criterion 7] renders score, summary, rating chip, and check diagnostics inside More details', async () => {
    const scan: ScanResult = {
      ...VALID_INPUT,
      id: 'scan-diag',
      createdAt: new Date().toISOString(),
      score: 75,
      rating: 'HIGH',
      summary: 'High risk (75/100): multiple critical warning flags detected.',
      checks: SAMPLE_CHECKS,
    };

    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ResultsView
          scan={scan}
          backLabel="← Check another listing"
          backTo="/check"
          onShare={vi.fn()}
          shareLabel="Share result"
          defaultExpanded={false}
        />
      </MemoryRouter>,
    );

    const summaryCard = screen.getByRole('region', {
      name: 'This listing shows several scam signals',
    });
    expect(within(summaryCard).getByText('HIGH RISK')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'This listing shows several scam signals' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Don't send money or share personal information until you've verified the listing and the landlord.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More details' }));

    const details = screen.getByRole('region', { name: 'Result details' });
    expect(details).toBeVisible();
    expect(within(details).getByText(scan.summary ?? '')).toBeVisible();
    expect(within(details).getByText('75')).toBeVisible();
    expect(within(details).getByText('/ 100')).toBeVisible();
    expect(within(details).getByRole('meter', { name: 'Risk score' })).toHaveAttribute(
      'aria-valuenow',
      '75',
    );

    const checksList = within(details).getAllByRole('listitem');
    expect(checksList.length).toBeGreaterThanOrEqual(SAMPLE_CHECKS.length);
    expect(within(details).getByText('Price Baseline Comparison')).toBeVisible();
    expect(within(details).getByText('Evidence: 45% of baseline')).toBeVisible();
    expect(within(details).getByText('+35 pts')).toBeVisible();
    expect(within(details).getByText('+40 pts')).toBeVisible();
    expect(within(details).getByText('Evidence: Cal. Civ. Code § 1950.6')).toBeVisible();
    expect(within(details).getAllByText('FLAG').length).toBeGreaterThanOrEqual(2);
    expect(within(details).getAllByText('OK').length).toBeGreaterThanOrEqual(1);
    expect(within(details).getAllByText('UNKNOWN').length).toBeGreaterThanOrEqual(1);
    expect(within(details).getAllByText('SKIPPED').length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll('.checks button')).toHaveLength(0);
  });

  it('[Criterion 8] renders INSUFFICIENT DATA view without More details and does not save scan', async () => {
    const insufficientSummary =
      'Could not evaluate listing due to insufficient data. Please add details to calculate risk.';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          score: null,
          rating: 'INSUFFICIENT_DATA',
          summary: insufficientSummary,
          checks: SAMPLE_CHECKS.map((check) => ({
            ...check,
            status: 'SKIPPED',
            scoreImpact: 0,
            evidence: null,
          })),
          rawChecks: {},
        },
      }),
    } as Response);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/check']}>
        <App loggedIn initialScans={[]} />
      </MemoryRouter>,
    );

    await fillRequiredForm(user);
    await user.click(screen.getByRole('button', { name: 'Check listing' }));

    const chip = await screen.findByText('INSUFFICIENT DATA');
    expect(chip).toHaveClass('chip--neutral');
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: "We couldn't verify enough checks to score this listing",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(insufficientSummary)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check another listing' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'More details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Share result' })).not.toBeInTheDocument();
    expect(screen.queryByText('/ 100')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Result details' })).not.toBeInTheDocument();

    expect(loadScans()).toBeNull();

    await user.click(screen.getByRole('link', { name: 'My scans' }));
    expect(screen.getByText(/You haven’t checked any listings yet\./i)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Verilet home' }));
    expect(
      screen.getByText(/No scans yet\. Check a listing and it will show up here\./i),
    ).toBeInTheDocument();
  });

  it('[Criterion 9] displays retry alert and restores form controls on API failure', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new DOMException('The operation timed out.', 'TimeoutError'))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Internal evaluation error' }),
      } as Response);

    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={['/check']}>
        <App loggedIn={false} />
      </MemoryRouter>,
    );

    await fillRequiredForm(user);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await user.click(screen.getByRole('button', { name: 'Check listing' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent("We couldn't check that listing");
      });
      expect(container.querySelector('.listing-form__overlay')).toBeNull();
      expect(screen.getByLabelText('Listing link')).toHaveValue(VALID_INPUT.listingUrl);
      expect(screen.getByLabelText('Monthly rent')).toHaveValue('1200');
      expect(screen.getByLabelText('City or address')).toHaveValue(VALID_INPUT.location);
      expect(screen.getByRole('button', { name: 'Check listing' })).toBeEnabled();
    }

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('[Criterion 10] persists scored scans with SKIPPED checks and filters out null-score scans', () => {
    const scoredScan: ScanResult = {
      ...VALID_INPUT,
      id: 'scan-scored',
      createdAt: new Date().toISOString(),
      score: 40,
      rating: 'MEDIUM',
      summary: 'Moderate risk (40/100).',
      checks: [
        {
          id: 'untraceablePayment',
          title: 'Payment Method Security',
          detail: 'High-risk payment detected.',
          status: 'FLAG',
          scoreImpact: 40,
          evidence: 'wire',
        },
        {
          id: 'agencyStanding',
          title: 'Rental Agency Business Registry',
          detail: 'Landlord not specified; check skipped.',
          status: 'SKIPPED',
          scoreImpact: 0,
          evidence: null,
        },
      ],
    };

    const insufficientScan: ScanResult = {
      ...VALID_INPUT,
      id: 'scan-null',
      createdAt: new Date().toISOString(),
      score: null,
      rating: 'INSUFFICIENT_DATA',
      summary: 'Could not evaluate listing due to insufficient data.',
      checks: [],
    };

    saveScans([scoredScan, insufficientScan]);
    const loaded = loadScans();

    expect(loaded).not.toBeNull();
    expect(loaded).toHaveLength(1);
    expect(loaded?.[0]).toMatchObject({
      id: 'scan-scored',
      score: 40,
      rating: 'MEDIUM',
      summary: 'Moderate risk (40/100).',
      photos: [],
    });
    expect(loaded?.[0].checks[1]).toEqual({
      id: 'agencyStanding',
      title: 'Rental Agency Business Registry',
      detail: 'Landlord not specified; check skipped.',
      status: 'SKIPPED',
      scoreImpact: 0,
      evidence: null,
    });

    const legacyPayload = [
      {
        id: 'scan-legacy',
        createdAt: new Date().toISOString(),
        score: 82,
        checks: [
          {
            id: 'rent',
            title: 'Rent vs. area price',
            detail: 'Rent is much lower than typical.',
            status: 'FLAG',
          },
        ],
        listingUrl: VALID_INPUT.listingUrl,
        rent: 1200,
        bedrooms: '2',
        location: 'Santa Cruz, CA',
        landlord: '',
        payment: 'gift-card',
        securityDeposit: null,
        applicationFee: null,
        contactPhone: '',
        description: '',
      },
    ];
    sessionStorage.setItem('verilet:scans', JSON.stringify(legacyPayload));
    const loadedLegacy = loadScans();

    expect(loadedLegacy).toHaveLength(1);
    expect(loadedLegacy?.[0]).toMatchObject({
      id: 'scan-legacy',
      score: 82,
      rating: 'HIGH',
      photos: [],
    });
    expect(loadedLegacy?.[0].checks[0]).toEqual({
      id: 'rent',
      title: 'Rent vs. area price',
      detail: 'Rent is much lower than typical.',
      status: 'FLAG',
      scoreImpact: 0,
      evidence: null,
    });
  });

  describe('Additional validation and transient state edge cases', () => {
    it('allows submitting the form without a listing link or payment method', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            score: 20,
            rating: 'LOW',
            summary: 'Low risk (20/100).',
            checks: SAMPLE_CHECKS,
            rawChecks: {},
          },
        }),
      } as Response);

      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={['/check']}>
          <App loggedIn={false} />
        </MemoryRouter>,
      );

      await user.type(screen.getByLabelText('Monthly rent'), '1200');
      await user.selectOptions(screen.getByLabelText('Bedrooms'), '2');
      await user.type(screen.getByLabelText('City or address'), VALID_INPUT.location);
      await user.click(screen.getByRole('button', { name: 'Check listing' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: /looks low risk/i }),
      ).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
      expect(body.listingUrl).toBe('');
      expect(body.payment).toBeNull();
    });

    it('validates transient router state with Zod and rejects inconsistent score/rating API payloads', async () => {
      const transient: ScanResult = {
        ...VALID_INPUT,
        id: 'scan-transient',
        createdAt: new Date().toISOString(),
        score: null,
        rating: 'INSUFFICIENT_DATA',
        summary: 'Insufficient data.',
        checks: [],
        photos: [],
      };

      expect(parseTransientScan(null, 'scan-transient')).toBeNull();
      expect(parseTransientScan({ transientScan: { id: 'bad' } }, 'bad')).toBeNull();
      expect(parseTransientScan({ transientScan: transient }, 'other-id')).toBeNull();
      expect(parseTransientScan({ transientScan: transient }, 'scan-transient')).toEqual(transient);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            score: null,
            rating: 'HIGH',
            summary: 'Inconsistent payload.',
            checks: [],
          },
        }),
      } as Response);

      await expect(checkListing(VALID_INPUT)).rejects.toThrow();
    });
  });
});
