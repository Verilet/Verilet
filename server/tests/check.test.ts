import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ insertScan: vi.fn() }));
vi.mock('../src/services/scanStore.js', () => ({
  SCAN_LIST_LIMIT: 100,
  insertScan: store.insertScan,
  findScans: vi.fn(),
  findScan: vi.fn(),
  removeScan: vi.fn(),
}));

const { default: app } = await import('../src/app.js');
const { GUEST_CHECKS_PER_HOUR } = await import('../src/middleware/rateLimit.middleware.js');

const listing = {
  listingUrl: 'https://example.com/listing/1',
  rent: 1200,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: '',
  payment: 'gift-card',
  securityDeposit: null,
  applicationFee: null,
  contactPhone: '',
  description: '',
  photoCount: 0,
};

/** Each test uses its own address so the shared rate limit doesn't carry between tests. */
const from = (address: string) => ({ 'X-Forwarded-For': address });

describe('POST /api/check (guest)', () => {
  it('scores a listing without an account and without saving it', async () => {
    const res = await request(app).post('/api/check').set(from('10.0.0.1')).send(listing);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.score).toBe(5 + 40 + 35 + 10);
    expect(res.body.data.checks.map((check: { id: string }) => check.id)).toEqual([
      'rent',
      'payment',
      'landlord',
      'details',
    ]);
    expect(res.body.data).not.toHaveProperty('id');
    expect(store.insertScan).not.toHaveBeenCalled();
  });

  it('rejects invalid listings with field details', async () => {
    const res = await request(app)
      .post('/api/check')
      .set(from('10.0.0.2'))
      .send({ ...listing, payment: 'barter', score: 0 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details).toBeDefined();
  });

  it('limits how many checks one address can make', async () => {
    for (let count = 0; count < GUEST_CHECKS_PER_HOUR; count += 1) {
      const ok = await request(app).post('/api/check').set(from('10.0.0.3')).send(listing);
      expect(ok.status).toBe(200);
    }

    const blocked = await request(app).post('/api/check').set(from('10.0.0.3')).send(listing);
    expect(blocked.status).toBe(429);
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.error).toMatch(/Too many checks/);

    const someoneElse = await request(app).post('/api/check').set(from('10.0.0.4')).send(listing);
    expect(someoneElse.status).toBe(200);
  });
});
