import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SavedScanResponse } from '../src/schemas/savedScan.schema.js';

/** A stored scan in the in-memory database. */
interface StoredScan extends Record<string, unknown> {
  _id: { toString(): string };
  userId: string;
  createdAt: Date;
}

/** Shared state for the stand-ins below, created before the mocks run. */
const db = vi.hoisted(() => ({
  rows: [] as StoredScan[],
  clock: 0,
  fail: false,
}));

/** Clerk stand-in: the signed-in user is whatever the `x-test-user` header says. */
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: (req: { headers: Record<string, string | undefined> }) => ({
    userId: req.headers['x-test-user'] ?? null,
  }),
}));

/**
 * Mongoose model stand-in that keeps scans in memory. It supports the calls the persistence
 * service makes, so the real service, controller and routes all run.
 */
vi.mock('../src/models/savedScan.model.js', async () => {
  const { Types } = await import('mongoose');

  /**
   * Whether a stored row matches a query filter such as `{ _id, userId }`.
   *
   * @param row The stored row.
   * @param filter The fields to match.
   * @returns True when every field matches.
   */
  function matches(row: StoredScan, filter: Record<string, unknown>): boolean {
    return Object.entries(filter).every(([key, value]) => String(row[key]) === String(value));
  }

  /** Throws when a test has made the database fail. */
  function touch() {
    if (db.fail) {
      throw new Error('database down');
    }
  }

  return {
    SavedScanModel: {
      create: async (doc: Record<string, unknown>) => {
        touch();
        db.clock += 1;
        const row = {
          ...doc,
          _id: new Types.ObjectId(),
          createdAt: new Date(Date.UTC(2026, 10, 1) + db.clock * 1000),
        } as StoredScan;
        db.rows.push(row);
        return { toObject: () => ({ ...row }) };
      },
      find: (filter: Record<string, unknown>) => {
        touch();
        let result = db.rows.filter((row) => matches(row, filter));
        const query = {
          sort: () => {
            result = [...result].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            return query;
          },
          limit: (count: number) => {
            result = result.slice(0, count);
            return query;
          },
          lean: async () => result,
        };
        return query;
      },
      findOne: (filter: Record<string, unknown>) => {
        touch();
        return { lean: async () => db.rows.find((row) => matches(row, filter)) ?? null };
      },
      deleteOne: async (filter: Record<string, unknown>) => {
        touch();
        const index = db.rows.findIndex((row) => matches(row, filter));
        if (index < 0) {
          return { deletedCount: 0 };
        }
        db.rows.splice(index, 1);
        return { deletedCount: 1 };
      },
    },
  };
});

const { default: app } = await import('../src/app.js');

/** A valid scan, as the client sends it after a check. */
const scan = {
  listingUrl: 'https://example.com/listing/1',
  rent: 1200,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: '',
  payment: 'gift-card',
  securityDeposit: null,
  applicationFee: 50,
  contactPhone: '',
  description: 'Sunny two bedroom near campus.',
  photoCount: 0,
  score: 80,
  checks: [
    {
      id: 'payment',
      title: 'Payment method',
      detail: 'Landlord asks for payment by gift card',
      status: 'FLAG',
    },
  ],
};

/**
 * Request headers that sign in as a user.
 *
 * @param userId The Clerk user ID to act as.
 * @returns The headers.
 */
function asUser(userId: string) {
  return { 'x-test-user': userId };
}

/**
 * Saves a scan through the API.
 *
 * @param userId Who saves it.
 * @param change Fields to change from the valid scan.
 * @returns The saved scan.
 */
async function save(userId: string, change: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/scans')
    .set(asUser(userId))
    .send({ ...scan, ...change });
  return res.body.data as SavedScanResponse;
}

beforeEach(() => {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example');
  vi.stubEnv('CLERK_PUBLISHABLE_KEY', 'pk_test_example');
  db.rows = [];
  db.clock = 0;
  db.fail = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('SCRUM-69-T-1: saved scans API', () => {
  it('SCRUM-69-T-1 [Criterion 1] rejects signed-out requests on every route', async () => {
    const id = '65a0c0ffee0000000000abcd';
    const responses = [
      await request(app).get('/api/scans'),
      await request(app).post('/api/scans').send(scan),
      await request(app).get(`/api/scans/${id}`),
      await request(app).delete(`/api/scans/${id}`),
    ];

    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, error: 'Log in to continue.' });
    }
    expect(db.rows).toHaveLength(0);
  });

  it.each(['CLERK_SECRET_KEY', 'CLERK_PUBLISHABLE_KEY'])(
    'SCRUM-69-T-1 [Criterion 2] answers 503 when %s is not set',
    async (name) => {
      vi.stubEnv(name, '');

      const res = await request(app).get('/api/scans').set(asUser('user_a'));

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toEqual(expect.any(String));
    },
  );

  it('SCRUM-69-T-1 [Criterion 3] saves a scan for the signed-in user', async () => {
    const res = await request(app).post('/api/scans').set(asUser('user_a')).send(scan);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject(scan);
    expect(res.body.data.id).toEqual(expect.any(String));
    expect(new Date(res.body.data.createdAt).toISOString()).toBe(res.body.data.createdAt);
    expect(res.body.data).not.toHaveProperty('userId');
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].userId).toBe('user_a');
  });

  it.each([
    ['a missing rent', { rent: undefined }, 'rent'],
    ['a javascript: link', { listingUrl: 'javascript:alert(1)' }, 'listingUrl'],
    ['an unknown payment method', { payment: 'barter' }, 'payment'],
    ['a negative deposit', { securityDeposit: -1 }, 'securityDeposit'],
    ['a score above 100', { score: 101 }, 'score'],
    [
      'a check with an unknown status',
      { checks: [{ ...scan.checks[0], status: 'MAYBE' }] },
      'checks',
    ],
    ['an extra userId field', { userId: 'user_b' }, 'userId'],
  ])('SCRUM-69-T-1 [Criterion 4] rejects %s and saves nothing', async (_name, change, field) => {
    const res = await request(app)
      .post('/api/scans')
      .set(asUser('user_a'))
      .send({ ...scan, ...change });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(JSON.stringify(res.body.details)).toContain(field);
    expect(db.rows).toHaveLength(0);
  });

  it("SCRUM-69-T-1 [Criterion 5] lists only the user's scans, newest first", async () => {
    const first = await save('user_a', { location: 'First place' });
    await save('user_b', { location: 'Someone else' });
    const second = await save('user_a', { location: 'Second place' });

    const res = await request(app).get('/api/scans').set(asUser('user_a'));

    expect(res.status).toBe(200);
    expect(res.body.data.map((saved: SavedScanResponse) => saved.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('SCRUM-69-T-1 [Criterion 5] lists at most 100 scans, the newest', async () => {
    for (let count = 0; count < 101; count += 1) {
      await save('user_c', { location: `Place ${count}` });
    }

    const res = await request(app).get('/api/scans').set(asUser('user_c'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(100);
    expect(res.body.data[0].location).toBe('Place 100');
    expect(res.body.data[99].location).toBe('Place 1');
  });

  it("SCRUM-69-T-1 [Criterion 6] opens only the owner's scan", async () => {
    const mine = await save('user_a');

    const own = await request(app).get(`/api/scans/${mine.id}`).set(asUser('user_a'));
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ success: true, data: mine });

    const notFound = { success: false, error: "We couldn't find that scan." };
    const other = await request(app).get(`/api/scans/${mine.id}`).set(asUser('user_b'));
    const unknown = await request(app)
      .get('/api/scans/65a0c0ffee0000000000abcd')
      .set(asUser('user_a'));
    const malformed = await request(app).get('/api/scans/nope').set(asUser('user_a'));
    for (const res of [other, unknown, malformed]) {
      expect(res.status).toBe(404);
      expect(res.body).toEqual(notFound);
    }
  });

  it("SCRUM-69-T-1 [Criterion 7] deletes only the owner's scan", async () => {
    const mine = await save('user_a');

    const other = await request(app).delete(`/api/scans/${mine.id}`).set(asUser('user_b'));
    const unknown = await request(app)
      .delete('/api/scans/65a0c0ffee0000000000abcd')
      .set(asUser('user_a'));
    expect(other.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(db.rows).toHaveLength(1);

    const own = await request(app).delete(`/api/scans/${mine.id}`).set(asUser('user_a'));
    expect(own.status).toBe(200);
    expect(own.body).toEqual({ success: true, data: { id: mine.id } });
    expect(db.rows).toHaveLength(0);
  });

  it('SCRUM-69-T-1 [Criterion 8] answers 500 when the database fails', async () => {
    db.fail = true;

    const saved = await request(app).post('/api/scans').set(asUser('user_a')).send(scan);
    const listed = await request(app).get('/api/scans').set(asUser('user_a'));

    expect(saved.status).toBe(500);
    expect(saved.body).toEqual({ success: false, error: "We couldn't save that scan." });
    expect(listed.status).toBe(500);
    expect(listed.body).toEqual({ success: false, error: "We couldn't load your scans." });
  });
});
