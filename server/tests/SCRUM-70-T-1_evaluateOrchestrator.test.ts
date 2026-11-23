import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import * as averagePriceService from '../src/services/checkers/averagePrice.service.js';
import * as securityDepositService from '../src/services/securityDeposit.service.js';
import * as applicationFeeService from '../src/services/applicationFee.service.js';
import * as paymentFlagsService from '../src/services/paymentFlags.service.js';
import * as gisQueryService from '../src/services/gisQuery.service.js';
import * as landUseService from '../src/services/landUse.service.js';
import * as phoneFlagsService from '../src/services/phoneFlags.service.js';
import * as agencyVerificationService from '../src/services/agencyVerification.service.js';
import * as listingSearchService from '../src/services/listingSearch.service.js';
import {
  orchestrateEvaluation,
  withTimeout,
  normalizeSettledResult,
  mapBedroomsToSpaceType,
  extractZip,
  WORKER_FAILED_FALLBACK,
} from '../src/services/evaluateOrchestrator.service.js';
import type { EvaluateRequest } from '../src/schemas/evaluate.schema.js';

describe('SCRUM-70-T-1: Listing evaluation orchestrator & POST /api/evaluate', () => {
  const validPayload: EvaluateRequest = {
    listingUrl: 'https://santacruz.craigslist.org/apa/d/santa-cruz-2br/1234567890.html',
    rent: 2800,
    bedrooms: '2',
    location: '123 Ocean St, Santa Cruz, CA 95060',
    landlord: 'Pacific Coast Properties LLC',
    payment: 'bank-transfer',
    securityDeposit: 2800,
    applicationFee: 45,
    contactPhone: '831-555-0199',
    description: 'Spacious 2 bedroom apartment close to campus.',
  };

  function mockAllWorkers() {
    vi.spyOn(averagePriceService, 'checkPrice').mockResolvedValue({
      checker: 'price',
      status: 'pass',
      severity: null,
      rent: 2800,
      baseline: 3000,
      baselineSource: 'county',
      region: 'santa_cruz',
      percentOfBaseline: 93.3,
      explanation: 'Rent is normal',
    });

    vi.spyOn(securityDepositService, 'evaluateSecurityDeposit').mockReturnValue({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Deposit complies with AB 12',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    });

    vi.spyOn(applicationFeeService, 'evaluateApplicationFee').mockReturnValue({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Application fee within statutory limit',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });

    vi.spyOn(paymentFlagsService, 'detectUntraceablePayment').mockReturnValue([]);

    vi.spyOn(gisQueryService, 'evaluateGisQuery').mockResolvedValue({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Address verified',
        parcel: {
          apn: '005-123-45',
          siteAddress: '123 Ocean St',
          city: 'Santa Cruz',
          zip: '95060',
          useCode: '020',
          useDescription: 'Single family residential',
        },
      },
    });

    vi.spyOn(landUseService, 'evaluateLandUse').mockReturnValue({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Land use is residential',
        category: 'residential',
      },
    });

    vi.spyOn(phoneFlagsService, 'evaluateContactPhone').mockResolvedValue({
      status: 'compliant',
      flag: null,
      message: 'Phone area code matches listing region',
    });

    vi.spyOn(agencyVerificationService, 'verifyAgencyStanding').mockResolvedValue({
      status: 'compliant',
      flag: null,
      message: 'Entity verified',
    });

    vi.spyOn(listingSearchService, 'listingSearch').mockResolvedValue({
      matches: [],
      failedSources: [],
    });
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    mockAllWorkers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper unit tests for internal mappings
  describe('Helper functions', () => {
    it('mapBedroomsToSpaceType correctly maps all supported bedroom variants', () => {
      expect(mapBedroomsToSpaceType('room')).toBe('single_room');
      expect(mapBedroomsToSpaceType('studio')).toBe('studio');
      expect(mapBedroomsToSpaceType('1')).toBe('1br');
      expect(mapBedroomsToSpaceType('2')).toBe('2br');
      expect(mapBedroomsToSpaceType('3')).toBe('3br');
      expect(mapBedroomsToSpaceType('4+')).toBe('4br');
    });

    it('extractZip extracts 5-digit postal code when present', () => {
      expect(extractZip('123 Ocean St, Santa Cruz, CA 95060')).toBe('95060');
      expect(extractZip('123 Ocean St, Santa Cruz, CA 95060-1234')).toBe('95060');
      expect(extractZip('10150 Main St, Santa Cruz, CA 95060')).toBe('95060');
      expect(extractZip('12345 Ocean St, Santa Cruz, CA 95062')).toBe('95062');
      expect(extractZip('10150 Main St, Santa Cruz, CA')).toBeUndefined();
      expect(extractZip('Santa Cruz, CA')).toBeUndefined();
    });

    it('normalizeSettledResult returns value for fulfilled and fallback for rejected', () => {
      const fulfilled: PromiseSettledResult<{ ok: boolean }> = {
        status: 'fulfilled',
        value: { ok: true },
      };
      const rejected: PromiseSettledResult<{ ok: boolean }> = {
        status: 'rejected',
        reason: new Error('Failed'),
      };

      expect(normalizeSettledResult(fulfilled)).toEqual({ ok: true });
      expect(normalizeSettledResult(rejected)).toEqual(WORKER_FAILED_FALLBACK);
    });
  });

  // Criterion 1
  it('[Criterion 1] accepts valid listing payload and returns 200 with rawChecks', async () => {
    const landUseSpy = vi.spyOn(landUseService, 'evaluateLandUse');

    const response = await request(app).post('/api/evaluate').send(validPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.rawChecks).toBeDefined();

    const { rawChecks } = response.body.data;
    expect(rawChecks.price).toMatchObject({ checker: 'price', status: 'pass' });
    expect(rawChecks.securityDeposit).toMatchObject({
      success: true,
      data: { status: 'compliant' },
    });
    expect(rawChecks.applicationFee).toMatchObject({
      success: true,
      data: { status: 'compliant' },
    });
    expect(rawChecks.untraceablePayment).toEqual([]);
    expect(rawChecks.gisQuery).toMatchObject({ success: true, data: { status: 'compliant' } });
    expect(rawChecks.landUse).toMatchObject({ success: true, data: { status: 'compliant' } });
    expect(landUseSpy).toHaveBeenCalledWith({
      useCode: '020',
      useDescription: 'Single family residential',
    });
    expect(rawChecks.contactPhone).toMatchObject({ status: 'compliant' });
    expect(rawChecks.agencyStanding).toMatchObject({ status: 'compliant' });
    expect(rawChecks.listingSearch).toMatchObject({ matches: [] });

    // Also assert minimal payload with nullish optional fields succeeds
    const minimalPayload = {
      listingUrl: 'https://example.com/listing',
      rent: 2000,
      bedrooms: 'studio',
      location: 'Santa Cruz, CA',
    };
    const minimalRes = await request(app).post('/api/evaluate').send(minimalPayload);
    expect(minimalRes.status).toBe(200);
    expect(minimalRes.body.success).toBe(true);
  });

  // Criterion 2
  it('[Criterion 2] rejects malformed payload with HTTP 400 and validation errors', async () => {
    const invalidPayloads = [
      { desc: 'missing listingUrl', payload: { ...validPayload, listingUrl: undefined } },
      { desc: 'invalid listingUrl', payload: { ...validPayload, listingUrl: 'not-a-valid-url' } },
      {
        desc: 'non-http listingUrl',
        payload: { ...validPayload, listingUrl: 'ftp://example.com/listing' },
      },
      { desc: 'negative rent', payload: { ...validPayload, rent: -500 } },
      { desc: 'zero rent', payload: { ...validPayload, rent: 0 } },
      { desc: 'non-numeric rent', payload: { ...validPayload, rent: 'twenty-five hundred' } },
      { desc: 'invalid bedrooms', payload: { ...validPayload, bedrooms: 'penthouse' } },
      { desc: 'empty location', payload: { ...validPayload, location: '   ' } },
    ];

    for (const { payload } of invalidPayloads) {
      const res = await request(app).post('/api/evaluate').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
    }
  });

  // Criterion 3
  it('[Criterion 3] dispatches all 9 workers concurrently', async () => {
    const callOrder: string[] = [];
    const DELAY_MS = 30;

    const delayWorker = async (name: string) => {
      callOrder.push(`${name}_start`);
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      callOrder.push(`${name}_end`);
      return { status: 'compliant' as const, flag: null, message: 'Done' };
    };

    vi.spyOn(averagePriceService, 'checkPrice').mockImplementation(async () => {
      await delayWorker('price');
      return {
        checker: 'price',
        status: 'pass',
        severity: null,
        rent: 2800,
        baseline: 3000,
        baselineSource: 'county',
        region: 'santa_cruz',
        percentOfBaseline: 93.3,
        explanation: 'Rent is normal',
      };
    });
    vi.spyOn(securityDepositService, 'evaluateSecurityDeposit').mockReturnValue({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Deposit complies with AB 12',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    });
    vi.spyOn(applicationFeeService, 'evaluateApplicationFee').mockReturnValue({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Application fee within statutory limit',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });
    vi.spyOn(paymentFlagsService, 'detectUntraceablePayment').mockImplementation(() => {
      callOrder.push('payment_called');
      return [];
    });
    vi.spyOn(gisQueryService, 'evaluateGisQuery').mockImplementation(async () => {
      await delayWorker('gis');
      return {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Address verified',
          parcel: null,
        },
      };
    });
    vi.spyOn(landUseService, 'evaluateLandUse').mockReturnValue({
      success: true,
      data: {
        status: 'skipped',
        flag: null,
        message: 'Skipped',
        category: null,
      },
    });
    vi.spyOn(phoneFlagsService, 'evaluateContactPhone').mockImplementation(async () =>
      delayWorker('phone'),
    );
    vi.spyOn(agencyVerificationService, 'verifyAgencyStanding').mockImplementation(async () =>
      delayWorker('agency'),
    );
    vi.spyOn(listingSearchService, 'listingSearch').mockImplementation(async () => {
      await delayWorker('search');
      return {
        matches: [],
        failedSources: [],
      };
    });

    const startTime = Date.now();
    const result = await orchestrateEvaluation(validPayload);
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    // If run sequentially, 5 async delayed workers * 30ms = >=150ms.
    // If run concurrently with Promise.allSettled(), duration should be ~30-100ms.
    expect(duration).toBeLessThan(200);

    // Verify all async workers were initiated before the first delayed one resolved
    const firstEndIndex = callOrder.findIndex((entry) => entry.endsWith('_end'));
    const startEntriesBeforeFirstEnd = callOrder
      .slice(0, firstEndIndex)
      .filter((entry) => entry.endsWith('_start'));
    expect(startEntriesBeforeFirstEnd.length).toBeGreaterThanOrEqual(4);
  });

  // Criterion 4
  it('[Criterion 4] isolates worker rejection and returns 200 with skipped fallback', async () => {
    const landUseSpy = vi.spyOn(landUseService, 'evaluateLandUse');

    // CheckPrice throws an unhandled synchronous exception
    vi.spyOn(averagePriceService, 'checkPrice').mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    // GIS query rejects asynchronously
    vi.spyOn(gisQueryService, 'evaluateGisQuery').mockRejectedValue(
      new Error('GIS remote service 503'),
    );

    // Agency verification rejects
    vi.spyOn(agencyVerificationService, 'verifyAgencyStanding').mockRejectedValue(
      new Error('OpenCorporates rate limit exceeded'),
    );

    const response = await request(app).post('/api/evaluate').send(validPayload);

    // Entire request must still succeed with 200
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const { rawChecks } = response.body.data;
    // Failed workers are safely mapped to WORKER_FAILED fallback
    expect(rawChecks.price).toEqual({
      status: 'skipped',
      flag: null,
      error: 'WORKER_FAILED',
    });
    expect(rawChecks.gisQuery).toEqual({
      status: 'skipped',
      flag: null,
      error: 'WORKER_FAILED',
    });
    expect(rawChecks.agencyStanding).toEqual({
      status: 'skipped',
      flag: null,
      error: 'WORKER_FAILED',
    });

    // Chained land-use gracefully receives null parcel when GIS query fails
    expect(landUseSpy).toHaveBeenCalledWith({ useCode: null, useDescription: null });

    // Healthy worker output is preserved
    expect(rawChecks.securityDeposit).toEqual({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Deposit complies with AB 12',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    });
  });

  // Criterion 5
  it('[Criterion 5] isolates worker timeout and returns 200 with skipped fallback', async () => {
    // Direct unit test of withTimeout timeout isolation using an unsettled promise
    const hangingAction = () => new Promise<string>(() => {});

    await expect(withTimeout(hangingAction, 50)).rejects.toThrow('WORKER_TIMEOUT');

    // Test orchestrator timeout isolation using 50ms worker timeout option
    vi.spyOn(averagePriceService, 'checkPrice').mockImplementation(
      () => new Promise<averagePriceService.PriceCheckResult>(() => {}),
    );

    const orchestratorResult = await orchestrateEvaluation(validPayload, {
      workerTimeoutMs: 50,
    });
    expect(orchestratorResult.success).toBe(true);
    expect(orchestratorResult.data.rawChecks.price).toEqual({
      status: 'skipped',
      flag: null,
      error: 'WORKER_FAILED',
    });

    // Ensure all workers are mocked offline, then simulate phone worker timeout error
    mockAllWorkers();
    vi.spyOn(phoneFlagsService, 'evaluateContactPhone').mockRejectedValue(
      new Error('WORKER_TIMEOUT'),
    );

    const response = await request(app).post('/api/evaluate').send(validPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.rawChecks.contactPhone).toEqual({
      status: 'skipped',
      flag: null,
      error: 'WORKER_FAILED',
    });
  });
});
