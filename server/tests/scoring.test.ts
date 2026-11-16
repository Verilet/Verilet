import { describe, expect, it } from 'vitest';
import { ScanModel } from '../src/models/scan.model.js';
import type { ScanInput } from '../src/schemas/scan.schema.js';
import { scoreListing } from '../src/services/scoring.service.js';

const safeListing: ScanInput = {
  listingUrl: 'https://example.com/listing/1',
  rent: 2400,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: 'Bay Property Group',
  payment: 'rental-platform',
  securityDeposit: 2400,
  applicationFee: null,
  contactPhone: '',
  description: 'Two bedroom flat near campus.',
  photoCount: 4,
};

const statusOf = (input: ScanInput, id: string) =>
  scoreListing(input).checks.find((check) => check.id === id)?.status;

describe('scoreListing', () => {
  it('gives a normal listing a low score', () => {
    const { score, checks } = scoreListing(safeListing);
    expect(score).toBe(5 + 10);
    expect(checks.map((check) => [check.id, check.status])).toEqual([
      ['rent', 'OK'],
      ['payment', 'OK'],
      ['deposit', 'OK'],
      ['landlord', 'UNKNOWN'],
      ['details', 'OK'],
    ]);
  });

  it.each([
    [700, 'FLAG'],
    [1500, 'UNKNOWN'],
    [2100, 'OK'],
  ] as const)('rates rent of %i for a 2 bed as %s', (rent, status) => {
    expect(statusOf({ ...safeListing, rent }, 'rent')).toBe(status);
  });

  it.each([
    ['gift-card', 'FLAG'],
    ['wire', 'FLAG'],
    ['crypto', 'FLAG'],
    ['zelle-venmo', 'UNKNOWN'],
    ['cash', 'UNKNOWN'],
    ['check', 'OK'],
  ] as const)('rates payment by %s as %s', (payment, status) => {
    expect(statusOf({ ...safeListing, payment }, 'payment')).toBe(status);
  });

  it('marks listing details unknown when there is no description or photos', () => {
    expect(statusOf({ ...safeListing, description: '', photoCount: 0 }, 'details')).toBe('UNKNOWN');
    expect(statusOf({ ...safeListing, description: '', photoCount: 1 }, 'details')).toBe('OK');
  });

  it.each([
    [2400, 'OK', 0],
    [3600, 'UNKNOWN', 10],
    [4800, 'UNKNOWN', 10],
    [5000, 'FLAG', 30],
  ] as const)('rates a deposit of %i on $2,400 rent as %s', (securityDeposit, status, points) => {
    const result = scoreListing({ ...safeListing, securityDeposit });
    const deposit = result.checks.find((check) => check.id === 'deposit');
    expect(deposit?.status).toBe(status);
    expect(deposit?.detail).toMatch(/Cal. Civ. Code § 1950.5/);
    expect(result.score).toBe(5 + 10 + points);
  });

  it.each([
    [0, 'OK', 0],
    [65, 'OK', 0],
    [66, 'FLAG', 20],
  ] as const)('rates an application fee of $%i as %s', (applicationFee, status, points) => {
    const result = scoreListing({ ...safeListing, applicationFee });
    const fee = result.checks.find((check) => check.id === 'applicationFee');
    expect(fee?.status).toBe(status);
    expect(fee?.detail).toMatch(/Cal. Civ. Code § 1950.6/);
    expect(result.score).toBe(5 + 10 + points);
  });

  it('leaves out the deposit and fee checks when they were not given', () => {
    const ids = scoreListing({
      ...safeListing,
      securityDeposit: null,
      applicationFee: null,
    }).checks.map((check) => check.id);
    expect(ids).toEqual(['rent', 'payment', 'landlord', 'details']);
  });

  it('never goes above 100', () => {
    const worst = { ...safeListing, rent: 100, payment: 'gift-card' as const };
    expect(scoreListing(worst).score).toBeLessThanOrEqual(100);
  });
});

describe('Scan model', () => {
  it('accepts a scored listing', () => {
    const doc = new ScanModel({ userId: 'user_a', ...safeListing, ...scoreListing(safeListing) });
    expect(doc.validateSync()).toBeUndefined();
  });

  it('requires an owner and rejects unknown values', () => {
    const doc = new ScanModel({ ...safeListing, payment: 'barter', score: 150, checks: [] });
    const errors = doc.validateSync()?.errors ?? {};
    expect(Object.keys(errors).sort()).toEqual(['payment', 'score', 'userId']);
  });
});
