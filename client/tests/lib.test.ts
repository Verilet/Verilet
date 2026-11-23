import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatScanDate,
  listingHost,
  scanMeta,
  scanShortTitle,
  scanSummary,
  scanTitle,
} from '../src/lib/format';
import { readPreviewFlag, savePreviewFlag } from '../src/lib/session';
import { readClientEnv } from '../src/lib/env';
import { copyShareText, shareButtonLabel, shareText } from '../src/lib/share';
import { ratingFromScore } from '../src/lib/risk';
import { scoreListing } from '../src/services/scanService';
import type { ScanResult } from '../src/types';

describe('ratingFromScore', () => {
  it.each([
    [0, 'LOW'],
    [39, 'LOW'],
    [40, 'MEDIUM'],
    [69, 'MEDIUM'],
    [70, 'HIGH'],
    [100, 'HIGH'],
  ])('maps %i to %s', (score, rating) => {
    expect(ratingFromScore(score)).toBe(rating);
  });
});

describe('formatScanDate', () => {
  const now = new Date(2026, 9, 26, 15, 0);
  it('formats today, yesterday, and older dates', () => {
    expect(formatScanDate(new Date(2026, 9, 26, 1, 0).toISOString(), now)).toBe('Today');
    expect(formatScanDate(new Date(2026, 9, 25, 23, 0).toISOString(), now)).toBe('Yesterday');
    expect(formatScanDate(new Date(2026, 9, 15, 12, 0).toISOString(), now)).toBe('Oct 15');
  });

  it('adds the year for scans from an earlier year', () => {
    expect(formatScanDate(new Date(2025, 9, 15, 12, 0).toISOString(), now)).toBe('Oct 15, 2025');
  });

  it('shows "Unknown date" instead of "Invalid Date" for a timestamp it cannot read', () => {
    expect(formatScanDate('not a date', now)).toBe('Unknown date');
    expect(formatScanDate('', now)).toBe('Unknown date');
  });
});

describe('scoreListing (placeholder)', () => {
  const base = {
    listingUrl: 'https://example.com/1',
    rent: 2100,
    bedrooms: '2' as const,
    location: 'Santa Cruz, CA',
    landlord: 'Castro Properties',
    payment: 'rental-platform' as const,
  };

  it('rates a typical listing paid through a platform as low risk', () => {
    expect(scoreListing(base).score).toBeLessThan(40);
  });

  it('flags very low rent and gift-card payment as high risk', () => {
    const result = scoreListing({ ...base, rent: 900, payment: 'gift-card' });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(
      result.checks.filter((check) => check.status === 'FLAG').map((check) => check.id),
    ).toEqual(['rent', 'payment']);
  });

  it('never exceeds 100', () => {
    expect(
      scoreListing({ ...base, rent: 1, landlord: '', payment: 'crypto' }).score,
    ).toBeLessThanOrEqual(100);
  });
});

/** A saved scan with known values, for the formatting and sharing helpers. */
const SCAN: ScanResult = {
  id: 'scan-1',
  createdAt: new Date(2026, 9, 26, 12, 0).toISOString(),
  listingUrl: 'https://www.zillow.com/homedetails/1',
  rent: 1200,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: '',
  payment: 'gift-card',
  securityDeposit: null,
  applicationFee: null,
  contactPhone: '',
  description: '',
  photos: [],
  score: 82,
  checks: [],
};

describe('scan summary formatters', () => {
  it('describes a scan with its bedrooms, rent and full location', () => {
    expect(scanSummary(SCAN)).toBe('2 bed · $1,200 · Santa Cruz, CA');
    expect(scanTitle(SCAN)).toBe('2 bed · $1,200 · Santa Cruz, CA');
  });

  it('keeps only the city for the short title', () => {
    expect(scanShortTitle(SCAN)).toBe('2 bed · $1,200 · Santa Cruz');
    expect(scanShortTitle({ ...SCAN, location: 'Aptos' })).toBe('2 bed · $1,200 · Aptos');
  });

  it('leaves out the place and its separator when the location is empty', () => {
    expect(scanTitle({ ...SCAN, location: '' })).toBe('2 bed · $1,200');
    expect(scanShortTitle({ ...SCAN, location: '' })).toBe('2 bed · $1,200');
  });

  it('adds "/ month" after the rent for the results header', () => {
    expect(scanMeta(SCAN)).toBe('2 bed · $1,200 / month · Santa Cruz, CA');
  });
});

describe('listingHost', () => {
  it('returns the website without "www."', () => {
    expect(listingHost('https://www.zillow.com/homedetails/1')).toBe('zillow.com');
    expect(listingHost('https://sfbay.craigslist.org/apa/2')).toBe('sfbay.craigslist.org');
  });

  it('returns the original text when it is not a valid link', () => {
    expect(listingHost('not a link')).toBe('not a link');
  });
});

describe('share helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('summarises a scan in one line with its rating and score', () => {
    expect(shareText(SCAN)).toBe('Verilet: HIGH RISK (82/100) · 2 bed · $1,200 · Santa Cruz, CA');
  });

  it('copies the summary to the clipboard and reports success', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyShareText(SCAN)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith(shareText(SCAN));
  });

  it('reports failure when the clipboard is unavailable', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: async () => Promise.reject(new Error('blocked')) },
    });
    await expect(copyShareText(SCAN)).resolves.toBe(false);
  });

  it('labels a share button with how the last copy of its scan went', () => {
    expect(shareButtonLabel('scan-1', { id: 'scan-1', ok: true }, 'Share')).toBe('Copied');
    expect(shareButtonLabel('scan-1', { id: 'scan-1', ok: false }, 'Share')).toBe("Couldn't copy");
  });

  it("keeps a share button's usual label when nothing was shared or another scan was", () => {
    expect(shareButtonLabel('scan-1', null, 'Share result')).toBe('Share result');
    expect(shareButtonLabel('scan-1', { id: 'scan-2', ok: true }, 'Share')).toBe('Share');
  });
});

describe('development preview flag', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('previews the signed-in screens with ?loggedIn=true without writing to storage', () => {
    expect(readPreviewFlag('?loggedIn=true')).toBe(true);
    expect(sessionStorage.length).toBe(0);
  });

  it('previews the signed-out screens with ?loggedIn=false, whatever was saved', () => {
    savePreviewFlag(true);
    expect(readPreviewFlag('?loggedIn=false')).toBe(false);
  });

  it('follows real sign-in when there is no flag and nothing is saved', () => {
    expect(readPreviewFlag('')).toBeNull();
  });

  it('remembers the signed-in preview for the tab', () => {
    savePreviewFlag(true);
    expect(readPreviewFlag('')).toBe(true);
  });

  it('never saves the signed-out preview, so a refresh follows real sign-in again', () => {
    savePreviewFlag(true);
    savePreviewFlag(false);
    expect(sessionStorage.length).toBe(0);
    expect(readPreviewFlag('')).toBeNull();
  });

  it('does not save ?loggedIn=false either, so it only lasts for that page load', () => {
    expect(readPreviewFlag('?loggedIn=false')).toBe(false);
    expect(readPreviewFlag('')).toBeNull();
  });

  it('ignores an old saved signed-out preview instead of trapping the tab in it', () => {
    sessionStorage.setItem('verilet:loggedIn', 'false');
    expect(readPreviewFlag('')).toBeNull();
  });

  it('ignores flag values other than true and false', () => {
    sessionStorage.setItem('verilet:loggedIn', 'yes');
    expect(readPreviewFlag('?loggedIn=maybe')).toBeNull();
  });

  it('forgets the preview when cleared', () => {
    savePreviewFlag(true);
    savePreviewFlag(null);
    expect(readPreviewFlag('')).toBeNull();
  });
});

describe('client environment', () => {
  it('reads a valid API address and Clerk key, trimming spaces and trailing slashes', () => {
    expect(
      readClientEnv({
        VITE_API_URL: ' http://localhost:5000/ ',
        VITE_CLERK_PUBLISHABLE_KEY: ' pk_test_abc123 ',
      }),
    ).toEqual({ apiUrl: 'http://localhost:5000', clerkPublishableKey: 'pk_test_abc123' });
  });

  it('calls the API on this site and turns sign-in off when the variables are missing or empty', () => {
    const empty = { apiUrl: '', clerkPublishableKey: null };
    expect(readClientEnv({})).toEqual(empty);
    expect(readClientEnv({ VITE_API_URL: '  ', VITE_CLERK_PUBLISHABLE_KEY: '' })).toEqual(empty);
  });

  it.each(['localhost:5000', 'ftp://files.example', 'javascript:alert(1)', 'not a url'])(
    'ignores the API address %s instead of building a broken request',
    (url) => {
      expect(readClientEnv({ VITE_API_URL: url }).apiUrl).toBe('');
    },
  );

  it('turns sign-in off for a secret key or a value that is not a string', () => {
    expect(
      readClientEnv({ VITE_CLERK_PUBLISHABLE_KEY: 'sk_test_secret' }).clerkPublishableKey,
    ).toBe(null);
    expect(readClientEnv({ VITE_CLERK_PUBLISHABLE_KEY: 42 }).clerkPublishableKey).toBe(null);
  });

  it('keeps one valid variable when the other is invalid', () => {
    expect(
      readClientEnv({ VITE_API_URL: 'nope', VITE_CLERK_PUBLISHABLE_KEY: 'pk_live_abc' }),
    ).toEqual({ apiUrl: '', clerkPublishableKey: 'pk_live_abc' });
  });

  it('reads either variable when the other is left out, like a real Vite env', () => {
    const viteEnv = { BASE_URL: '/', DEV: true, MODE: 'development' };
    expect(readClientEnv({ ...viteEnv, VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_abc' })).toEqual({
      apiUrl: '',
      clerkPublishableKey: 'pk_test_abc',
    });
    expect(readClientEnv({ ...viteEnv, VITE_API_URL: 'https://api.example' })).toEqual({
      apiUrl: 'https://api.example',
      clerkPublishableKey: null,
    });
  });

  it('falls back to the defaults when the environment is not an object', () => {
    expect(readClientEnv(null)).toEqual({ apiUrl: '', clerkPublishableKey: null });
  });
});
