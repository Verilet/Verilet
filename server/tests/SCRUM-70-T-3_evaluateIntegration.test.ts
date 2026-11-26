import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import type { EvaluateRequest, RawChecks } from '../src/schemas/evaluate.schema.js';
import * as agencyVerificationService from '../src/services/agencyVerification.service.js';
import * as applicationFeeService from '../src/services/applicationFee.service.js';
import * as averagePriceService from '../src/services/checkers/averagePrice.service.js';
import * as gisQueryService from '../src/services/gisQuery.service.js';
import * as landUseService from '../src/services/landUse.service.js';
import * as listingSearchService from '../src/services/listingSearch.service.js';
import * as paymentFlagsService from '../src/services/paymentFlags.service.js';
import * as phoneFlagsService from '../src/services/phoneFlags.service.js';
import {
  POINTS_EXCESSIVE_FEE,
  POINTS_NON_LOCAL_PHONE,
  POINTS_OBFUSCATED_CONTACT,
  calculateListingScore,
} from '../src/services/scoringEngine.service.js';
import * as securityDepositService from '../src/services/securityDeposit.service.js';

describe('SCRUM-70-T-3: POST /api/evaluate scoring & flag integration', () => {
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

  function mockAllWorkers(): void {
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
    vi.spyOn(paymentFlagsService, 'detectAdvanceFee').mockReturnValue([]);
    vi.spyOn(paymentFlagsService, 'detectHighRiskSelections').mockReturnValue([]);

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

    vi.spyOn(phoneFlagsService, 'evaluatePhoneAreaCode').mockResolvedValue({
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Phone area code matches listing region',
        areaCode: '831',
      },
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

  it('[Criterion 1] wires calculateListingScore into POST /api/evaluate for JSON payloads', async () => {
    vi.spyOn(applicationFeeService, 'evaluateApplicationFee').mockReturnValue({
      success: true,
      data: {
        status: 'violation',
        flag: 'EXCESSIVE_APPLICATION_FEE',
        message: 'Application fee ($85) exceeds statutory limit ($65).',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    });

    const response = await request(app).post('/api/evaluate').send(validPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      score: POINTS_EXCESSIVE_FEE,
      rating: 'LOW',
    });
    expect(typeof response.body.data.summary).toBe('string');
    expect(response.body.data.summary.length).toBeGreaterThan(0);
    expect(response.body.data.checks).toHaveLength(9);
    expect(response.body.data.rawChecks).toBeDefined();

    const feeCheck = response.body.data.checks.find(
      (check: { id: string }) => check.id === 'applicationFee',
    );
    expect(feeCheck).toMatchObject({
      id: 'applicationFee',
      status: 'FLAG',
      scoreImpact: POINTS_EXCESSIVE_FEE,
      evidence: 'Cal. Civ. Code § 1950.6',
    });

    const withoutOptionalRes = await request(app)
      .post('/api/evaluate')
      .send({ ...validPayload, listingUrl: '', payment: null });
    expect(withoutOptionalRes.status).toBe(200);
    expect(withoutOptionalRes.body.success).toBe(true);
  });

  it('[Criterion 2] rejects malformed JSON payloads with HTTP 400', async () => {
    const invalidPayloads = [
      { ...validPayload, listingUrl: 'not-a-url' },
      { ...validPayload, rent: -1200 },
      { ...validPayload, rent: '1200' },
    ];

    for (const payload of invalidPayloads) {
      const response = await request(app).post('/api/evaluate').send(payload);
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBeDefined();
    }
  });

  it('[Criterion 3] scores OBFUSCATED_CONTACT with POINTS_OBFUSCATED_CONTACT and evidence fallback', async () => {
    vi.spyOn(phoneFlagsService, 'evaluatePhoneAreaCode').mockResolvedValue({
      success: true,
      data: {
        status: 'warning',
        flag: 'OBFUSCATED_CONTACT',
        message: 'Obfuscated contact number detected.',
        areaCode: '831',
      },
    });

    const response = await request(app).post('/api/evaluate').send(validPayload);

    expect(response.status).toBe(200);
    const phoneCheck = response.body.data.checks.find(
      (check: { id: string }) => check.id === 'contactPhone',
    );
    expect(phoneCheck).toMatchObject({
      status: 'FLAG',
      scoreImpact: POINTS_OBFUSCATED_CONTACT,
      evidence: 'Area code: 831',
    });

    const baseRaw: RawChecks = response.body.data.rawChecks;
    const obfuscatedWithEvidence: RawChecks = {
      ...baseRaw,
      contactPhone: {
        success: true,
        data: {
          status: 'warning',
          flag: 'OBFUSCATED_CONTACT',
          message: 'Obfuscated phone text detected.',
          areaCode: null,
          evidence: 'eight-three-one 555 zero one nine nine',
        },
      },
    };
    const evidenceScored = calculateListingScore(obfuscatedWithEvidence);
    const evidencePhoneCheck = evidenceScored.checks.find((check) => check.id === 'contactPhone');
    expect(evidencePhoneCheck).toMatchObject({
      status: 'FLAG',
      scoreImpact: POINTS_OBFUSCATED_CONTACT,
      evidence: 'eight-three-one 555 zero one nine nine',
    });

    const nonLocalScored = calculateListingScore({
      ...baseRaw,
      contactPhone: {
        success: true,
        data: {
          status: 'warning',
          flag: 'NON_LOCAL_AREA_CODE',
          message: 'Phone area code (305) does not match listing state (CA)',
          areaCode: '305',
        },
      },
    });
    const nonLocalCheck = nonLocalScored.checks.find((check) => check.id === 'contactPhone');
    expect(nonLocalCheck).toMatchObject({
      status: 'FLAG',
      scoreImpact: POINTS_NON_LOCAL_PHONE,
      evidence: 'Area code: 305',
    });
  });

  describe('Additional normalization and validation edge cases', () => {
    it('normalizes landUse to UNKNOWN with plain-language detail when GIS lookup fails', () => {
      const scored = calculateListingScore({
        price: {
          checker: 'price',
          status: 'pass',
          severity: null,
          rent: 2800,
          baseline: 3000,
          baselineSource: 'county',
          region: 'santa_cruz',
          percentOfBaseline: 93.3,
          explanation: 'Rent is normal.',
        },
        securityDeposit: { status: 'skipped', flag: null, error: 'WORKER_FAILED' },
        applicationFee: { status: 'skipped', flag: null, error: 'WORKER_FAILED' },
        untraceablePayment: [],
        gisQuery: {
          success: true,
          data: {
            status: 'skipped',
            flag: 'GIS_SERVICE_UNAVAILABLE',
            message: 'County GIS service timed out or unavailable; check skipped',
            parcel: null,
          },
        },
        landUse: {
          success: true,
          data: {
            status: 'skipped',
            flag: null,
            message: 'Land use code not specified; check skipped',
            category: null,
          },
        },
        contactPhone: { status: 'skipped', flag: null, error: 'WORKER_FAILED' },
        agencyStanding: { status: 'skipped', flag: null, error: 'WORKER_FAILED' },
        listingSearch: { matches: [], failedSources: [] },
      });

      const landUseCheck = scored.checks.find((check) => check.id === 'landUse');
      expect(landUseCheck?.status).toBe('UNKNOWN');
      expect(landUseCheck?.scoreImpact).toBe(0);
      expect(landUseCheck?.detail).not.toMatch(/not specified|parcel|code/i);
      expect(landUseCheck?.detail).toMatch(/county property records were unavailable/i);

      const okGisSkippedLandUse = calculateListingScore({
        price: {
          checker: 'price',
          status: 'pass',
          severity: null,
          rent: 2800,
          baseline: 3000,
          baselineSource: 'county',
          region: 'santa_cruz',
          percentOfBaseline: 93.3,
          explanation: 'Rent is normal.',
        },
        securityDeposit: { status: 'skipped', flag: null, error: 'WORKER_FAILED' },
        applicationFee: { status: 'skipped', flag: null, error: 'WORKER_FAILED' },
        untraceablePayment: [],
        gisQuery: {
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
              useCode: '',
              useDescription: '',
            },
          },
        },
        landUse: {
          success: true,
          data: {
            status: 'skipped',
            flag: null,
            message: 'Land use code not specified; check skipped',
            category: null,
          },
        },
        contactPhone: { status: 'skipped', flag: null, error: 'WORKER_FAILED' },
        agencyStanding: { status: 'skipped', flag: null, error: 'WORKER_FAILED' },
        listingSearch: { matches: [], failedSources: [] },
      });
      const okGisLandUseCheck = okGisSkippedLandUse.checks.find((check) => check.id === 'landUse');
      expect(okGisLandUseCheck?.status).toBe('SKIPPED');
      expect(okGisLandUseCheck?.detail).toBe('Land use code not specified; check skipped');
    });
  });
});
