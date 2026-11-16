import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanResponse } from '../src/schemas/scan.schema.js';
import type { NewScan } from '../src/services/scanStore.js';

/** Clerk stand-in: the signed-in user is whatever the `x-test-user` header says. */
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers['x-test-user'] ?? null,
  }),
}));

/** Database stand-in that keeps scans in memory, with the same ownership rules. */
const db = vi.hoisted(() => ({
  rows: [] as { userId: string; scan: ScanResponse }[],
  nextId: 1,
  fail: false,
}));
vi.mock('../src/services/scanStore.js', () => ({
  SCAN_LIST_LIMIT: 100,
  insertScan: async (userId: string, scan: NewScan) => {
    if (db.fail) {
      throw new Error('database down');
    }
    const saved = {
      ...scan,
      id: `scan${db.nextId}`,
      createdAt: new Date(Date.UTC(2026, 0, db.nextId)).toISOString(),
    };
    db.nextId += 1;
    db.rows.push({ userId, scan: saved });
    return saved;
  },
  findScans: async (userId: string) => {
    if (db.fail) {
      throw new Error('database down');
    }
    return db.rows
      .filter((row) => row.userId === userId)
      .map((row) => row.scan)
      .reverse();
  },
  findScan: async (userId: string, id: string) =>
    db.rows.find((row) => row.userId === userId && row.scan.id === id)?.scan ?? null,
  removeScan: async (userId: string, id: string) => {
    const index = db.rows.findIndex((row) => row.userId === userId && row.scan.id === id);
    if (index < 0) {
      return false;
    }
    db.rows.splice(index, 1);
    return true;
  },
}));

const { default: app } = await import('../src/app.js');

const listing = {
  listingUrl: 'https://example.com/listing/1',
  rent: 1200,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: '',
  payment: 'gift-card',
  securityDeposit: null,
  applicationFee: 50,
  contactPhone: '',
  description: '',
  photoCount: 0,
};

const asUser = (userId: string) => ({ 'x-test-user': userId });

beforeAll(() => {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');
  vi.stubEnv('CLERK_PUBLISHABLE_KEY', 'pk_test_example');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  db.rows = [];
  db.nextId = 1;
  db.fail = false;
});

describe('scans API access', () => {
  it('needs a signed-in user', async () => {
    const res = await request(app).get('/api/scans');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, error: 'Log in to continue.' });
  });

  it('answers 503 when Clerk is not configured', async () => {
    vi.stubEnv('CLERK_SECRET_KEY', '');
    const res = await request(app).get('/api/scans').set(asUser('user_a'));
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/scans', () => {
  it('scores and saves a listing for the signed-in user', async () => {
    const res = await request(app).post('/api/scans').set(asUser('user_a')).send(listing);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ ...listing, id: 'scan1' });
    expect(res.body.data.score).toBe(5 + 40 + 35 + 10);
    expect(res.body.data.checks.map((check: { id: string }) => check.id)).toEqual([
      'rent',
      'payment',
      'applicationFee',
      'landlord',
      'details',
    ]);
    expect(res.body.data).not.toHaveProperty('userId');
    expect(db.rows[0].userId).toBe('user_a');
  });

  it('ignores a score sent by the browser', async () => {
    const res = await request(app)
      .post('/api/scans')
      .set(asUser('user_a'))
      .send({ ...listing, score: 0 });
    expect(res.status).toBe(400);
    expect(db.rows).toHaveLength(0);
  });

  it.each([
    ['a missing rent', { rent: undefined }],
    ['a non-http link', { listingUrl: 'javascript:alert(1)' }],
    ['an unknown payment method', { payment: 'barter' }],
    ['a negative deposit', { securityDeposit: -1 }],
    ['a long description', { description: 'x'.repeat(5001) }],
    ['too many photos', { photoCount: 11 }],
  ])('rejects %s with field details', async (_name, change) => {
    const res = await request(app)
      .post('/api/scans')
      .set(asUser('user_a'))
      .send({ ...listing, ...change });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.details).toBeDefined();
    expect(db.rows).toHaveLength(0);
  });

  it('answers 500 with an envelope when saving fails', async () => {
    db.fail = true;
    const res = await request(app).post('/api/scans').set(asUser('user_a')).send(listing);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "We couldn't save that scan." });
  });
});

describe('reading and deleting scans', () => {
  async function save(userId: string, change = {}) {
    const res = await request(app)
      .post('/api/scans')
      .set(asUser(userId))
      .send({ ...listing, ...change });
    return res.body.data as ScanResponse;
  }

  it('lists only the signed-in user’s scans, newest first', async () => {
    const first = await save('user_a', { location: 'First' });
    await save('user_b');
    const second = await save('user_a', { location: 'Second' });

    const res = await request(app).get('/api/scans').set(asUser('user_a'));

    expect(res.status).toBe(200);
    expect(res.body.data.map((scan: ScanResponse) => scan.id)).toEqual([second.id, first.id]);
  });

  it('opens a user’s own scan and hides everyone else’s', async () => {
    const mine = await save('user_a');

    const own = await request(app).get(`/api/scans/${mine.id}`).set(asUser('user_a'));
    expect(own.status).toBe(200);
    expect(own.body.data.id).toBe(mine.id);

    const other = await request(app).get(`/api/scans/${mine.id}`).set(asUser('user_b'));
    expect(other.status).toBe(404);

    const missing = await request(app).get('/api/scans/nope').set(asUser('user_a'));
    expect(missing.status).toBe(404);
  });

  it('deletes a user’s own scan only', async () => {
    const mine = await save('user_a');

    const other = await request(app).delete(`/api/scans/${mine.id}`).set(asUser('user_b'));
    expect(other.status).toBe(404);
    expect(db.rows).toHaveLength(1);

    const own = await request(app).delete(`/api/scans/${mine.id}`).set(asUser('user_a'));
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ success: true, data: { id: mine.id } });
    expect(db.rows).toHaveLength(0);
  });

  it('answers 500 with an envelope when loading fails', async () => {
    db.fail = true;
    const res = await request(app).get('/api/scans').set(asUser('user_a'));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: "We couldn't load your scans." });
  });
});
