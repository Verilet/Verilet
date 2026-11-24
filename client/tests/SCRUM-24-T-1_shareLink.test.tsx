import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { RATING_HEADLINE } from '../src/lib/risk';
import { readSharedScan, sharePathFor } from '../src/lib/shareLink';
import type { ScanResult } from '../src/types';

/** A scan with every personal detail filled in, so the tests can check none of it leaks. */
const SCAN: ScanResult = {
  id: 'scan-secret-id',
  createdAt: '2026-11-20T18:30:00.000Z',
  listingUrl: 'https://example.com/listing/42',
  rent: 1200,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: 'Pat Landlord',
  payment: 'gift-card',
  securityDeposit: 2400,
  applicationFee: null,
  contactPhone: '831-555-0199',
  description: 'Text me at my private number for a tour.',
  photos: [new File(['x'], 'room.png', { type: 'image/png' })],
  score: 82,
  checks: [
    {
      id: 'payment',
      title: 'Payment method',
      detail: 'Landlord asks for payment by gift card',
      status: 'FLAG',
    },
    {
      id: 'deposit',
      title: 'Security deposit',
      detail: 'Within the legal limit',
      status: 'OK',
    },
    {
      id: 'landlord',
      title: 'Landlord check',
      detail: "We couldn't look up the landlord yet",
      status: 'UNKNOWN',
    },
  ],
};

/** The fields a share link is meant to carry, for comparing with what comes back. */
const SHAREABLE = {
  listingUrl: SCAN.listingUrl,
  rent: SCAN.rent,
  bedrooms: SCAN.bedrooms,
  location: SCAN.location,
  payment: SCAN.payment,
  securityDeposit: SCAN.securityDeposit,
  applicationFee: SCAN.applicationFee,
  score: SCAN.score,
  checks: SCAN.checks,
  createdAt: SCAN.createdAt,
};

/**
 * The part of a share path after `/shared/`.
 *
 * @param path A path from `sharePathFor`.
 * @returns The link's data.
 */
function dataOf(path: string): string {
  return path.slice('/shared/'.length);
}

/**
 * Encodes JSON-able data the way a share link does, for building broken or edited links.
 *
 * @param value What to encode.
 * @returns URL-safe base64 of its JSON, or of the text as is when given a string.
 */
function encode(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const binary = String.fromCharCode(...new TextEncoder().encode(text));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Renders the app at a page.
 *
 * @param path The page to open.
 * @param app The app element, so a test can turn on the Preview bar.
 * @returns The render result.
 */
function renderAt(path: string, app: ReactElement = <App loggedIn={false} />) {
  return render(<MemoryRouter initialEntries={[path]}>{app}</MemoryRouter>);
}

describe('SCRUM-24-T-1: shared result links', () => {
  it('SCRUM-24-T-1 [Criterion 1] round-trips a scan through its share link', () => {
    const path = sharePathFor(SCAN);

    expect(path).toMatch(/^\/shared\/[A-Za-z0-9_-]+$/);
    expect(readSharedScan(dataOf(path))).toEqual(SHAREABLE);

    const accented = { ...SCAN, location: 'Café Row · Santa Cruz, CA' };
    expect(readSharedScan(dataOf(sharePathFor(accented)))?.location).toBe(
      'Café Row · Santa Cruz, CA',
    );
  });

  it('SCRUM-24-T-1 [Criterion 2] leaves personal details out of the link', () => {
    const data = dataOf(sharePathFor(SCAN));
    const text = new TextDecoder().decode(
      Uint8Array.from(atob(data.replace(/-/g, '+').replace(/_/g, '/')), (char) =>
        char.charCodeAt(0),
      ),
    );
    const json = JSON.parse(text);

    for (const key of ['contactPhone', 'landlord', 'description', 'photos', 'id']) {
      expect(json).not.toHaveProperty(key);
    }
    for (const secret of [SCAN.contactPhone, SCAN.landlord, SCAN.description, SCAN.id]) {
      expect(text).not.toContain(secret);
    }
  });

  it('SCRUM-24-T-1 [Criterion 3] shows a shared result to a signed-out visitor', () => {
    renderAt(sharePathFor(SCAN));

    expect(screen.getByText('2 bed · $1,200 / month · Santa Cruz, CA')).toBeInTheDocument();
    expect(screen.getByText('HIGH RISK')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: RATING_HEADLINE.HIGH.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(RATING_HEADLINE.HIGH.advice)).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('/ 100')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Risk score' })).toHaveAttribute(
      'aria-valuenow',
      '82',
    );

    const details = within(screen.getByRole('region', { name: 'Result details' }));
    const checks = within(details.getByRole('list'));
    for (const check of SCAN.checks) {
      const item = checks.getByText(check.title).closest('li');
      expect(item).not.toBeNull();
      expect(item).toHaveTextContent(check.detail);
      expect(item).toHaveTextContent(check.status);
    }
    expect(screen.getByRole('link', { name: 'Check your own listing' })).toHaveAttribute(
      'href',
      '/check',
    );
  });

  it('SCRUM-24-T-1 [Criterion 4] shows the shared result read-only, signed in or not', () => {
    const path = sharePathFor(SCAN);
    const views = [<App key="out" loggedIn={false} />, <App key="in" loggedIn initialScans={[]} />];

    for (const app of views) {
      const { unmount } = renderAt(path, app);
      const main = within(screen.getByRole('main'));

      expect(main.getByText(/Someone shared this result with you/)).toBeInTheDocument();
      expect(main.getByText('82')).toBeInTheDocument();
      expect(main.queryByRole('button', { name: /share/i })).toBeNull();
      expect(main.queryByRole('link', { name: /my scans/i })).toBeNull();
      expect(main.queryByRole('button', { name: /details/i })).toBeNull();
      unmount();
    }
  });

  it.each([
    ['text that is not base64', 'not base64!'],
    ['base64 of text that is not JSON', encode('{oops')],
    ['a score of 150', encode({ ...SHAREABLE, score: 150 })],
    ['a javascript: listing link', encode({ ...SHAREABLE, listingUrl: 'javascript:alert(1)' })],
    ['an extra contactPhone field', encode({ ...SHAREABLE, contactPhone: '831-555-0199' })],
  ])('SCRUM-24-T-1 [Criterion 5] rejects a broken link: %s', (_name, data) => {
    expect(readSharedScan(data)).toBeNull();

    renderAt(`/shared/${encodeURIComponent(data)}`);

    expect(
      screen.getByRole('heading', { level: 1, name: 'This share link doesn’t work' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByRole('link', { name: 'Check a listing' })).toHaveAttribute('href', '/check');
  });
});
