import { describe, expect, it } from 'vitest';
import { formatScanDate } from '../src/lib/format';
import { ratingFromScore } from '../src/lib/risk';
import { scoreListing } from '../src/services/scanService';

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
