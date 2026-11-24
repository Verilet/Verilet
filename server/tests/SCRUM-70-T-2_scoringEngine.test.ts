import { describe, it, expect } from 'vitest';
import {
  calculateListingScore,
  POINTS_UNTRACEABLE_PAYMENT,
  POINTS_ADVANCE_FEE,
  POINTS_RENT_UNDER_50,
  POINTS_RENT_UNDER_75,
  POINTS_DUPLICATE_MISMATCH,
  POINTS_SUSPENDED_ENTITY,
  POINTS_UNREGISTERED_ENTITY,
  POINTS_UNVERIFIED_ADDRESS,
  POINTS_LAND_USE_MISMATCH,
  POINTS_OBFUSCATED_CONTACT,
  POINTS_NON_LOCAL_PHONE,
  POINTS_DEPOSIT_OVER_2X,
  POINTS_DEPOSIT_OVER_1X,
  POINTS_EXCESSIVE_FEE,
  MIN_EVALUATED_CHECKS_THRESHOLD,
  INSUFFICIENT_DATA_SUMMARY,
} from '../src/services/scoringEngine.service.js';
import type { RawChecks, WorkerFailureFallback } from '../src/schemas/evaluate.schema.js';
import type { PaymentViolation } from '../src/services/paymentFlags.service.js';

describe('SCRUM-70-T-2: Deterministic listing risk scoring engine', () => {
  const workerFallback: WorkerFailureFallback = Object.freeze({
    status: 'skipped',
    flag: null,
    error: 'WORKER_FAILED',
  });

  /**
   * Creates a compliant price check fixture with optional overrides.
   */
  function createPassPrice(
    overrides: Partial<Extract<RawChecks['price'], { checker: 'price' }>> = {},
  ): RawChecks['price'] {
    return {
      checker: 'price',
      status: 'pass',
      severity: null,
      rent: 2800,
      baseline: 3000,
      baselineSource: 'county',
      region: 'santa_cruz',
      percentOfBaseline: 93.3,
      explanation: 'Rent is within regional baseline range.',
      ...overrides,
    };
  }

  /**
   * Creates a critical price violation fixture with optional overrides.
   */
  function createPriceViolation(
    overrides: Partial<Extract<RawChecks['price'], { checker: 'price' }>> = {},
  ): RawChecks['price'] {
    return createPassPrice({
      status: 'violation',
      severity: 'critical',
      rent: 1200,
      percentOfBaseline: 40.0,
      explanation: 'Rent is 40% of local baseline.',
      ...overrides,
    });
  }

  /**
   * Creates a non-local phone warning fixture.
   */
  function createNonLocalPhone(): RawChecks['contactPhone'] {
    return {
      success: true,
      data: {
        status: 'warning',
        flag: 'NON_LOCAL_AREA_CODE',
        message: 'Phone area code (305) does not match listing state (CA)',
        areaCode: '305',
      },
    };
  }

  /**
   * Creates an excessive application fee violation fixture.
   */
  function createExcessiveFee(): RawChecks['applicationFee'] {
    return {
      success: true,
      data: {
        status: 'violation',
        flag: 'EXCESSIVE_APPLICATION_FEE',
        message: 'Screening fee ($85) exceeds statutory limit ($65)',
        statutoryCitation: 'Cal. Civ. Code § 1950.6',
      },
    };
  }

  /**
   * Creates an over-1x security deposit warning fixture.
   */
  function createOver1xDeposit(): RawChecks['securityDeposit'] {
    return {
      success: true,
      data: {
        status: 'warning',
        flag: 'EXCEEDS_STANDARD_DEPOSIT_CAP',
        message: 'Security deposit exceeds standard 1-month cap ($2800), requesting $4000',
        statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
      },
    };
  }

  /**
   * Creates an unverified GIS address warning fixture.
   */
  function createUnverifiedGis(): RawChecks['gisQuery'] {
    return {
      success: true,
      data: {
        status: 'warning',
        flag: 'UNVERIFIED_ADDRESS',
        message: 'Address not found in assessor parcel records',
        parcel: null,
      },
    };
  }

  /**
   * Creates a non-residential land use violation fixture.
   */
  function createLandUseViolation(): RawChecks['landUse'] {
    return {
      success: true,
      data: {
        status: 'violation',
        flag: 'NON_RESIDENTIAL_LAND_USE',
        message: 'Property is zoned commercial retail',
        category: 'commercial',
      },
    };
  }

  /**
   * Creates a suspended rental agency warning fixture.
   */
  function createSuspendedAgency(): RawChecks['agencyStanding'] {
    return {
      status: 'warning',
      flag: 'SUSPENDED_ENTITY',
      message: 'Management agency suspended by state board',
    };
  }

  /**
   * Constructs a baseline compliant RawChecks fixture with optional type-safe overrides.
   */
  function createCompliantChecks(overrides: Partial<RawChecks> = {}): RawChecks {
    return {
      price: createPassPrice(),
      securityDeposit: {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Security deposit complies with statutory limits.',
          statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
        },
      },
      applicationFee: {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Application fee complies with statutory limits.',
          statutoryCitation: 'Cal. Civ. Code § 1950.6',
        },
      },
      untraceablePayment: [],
      gisQuery: {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Address verified in county parcel records.',
          parcel: {
            apn: '005-123-45',
            siteAddress: '123 Ocean St',
            city: 'Santa Cruz',
            zip: '95060',
            useCode: '020',
            useDescription: 'Single family residential',
          },
        },
      },
      landUse: {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Complies with lawful residential land use.',
          category: 'residential',
        },
      },
      contactPhone: {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Phone area code matches listing region.',
          areaCode: '831',
        },
      },
      agencyStanding: {
        status: 'compliant',
        flag: null,
        message: 'Entity verified in active business registry.',
      },
      listingSearch: {
        matches: [],
        failedSources: [],
      },
      ...overrides,
    };
  }

  /**
   * Constructs an all-skipped/unknown RawChecks fixture with optional type-safe overrides.
   */
  function createAllSkippedChecks(overrides: Partial<RawChecks> = {}): RawChecks {
    return {
      price: createPassPrice({
        status: 'not_evaluated',
        baseline: null,
        baselineSource: null,
        region: null,
        percentOfBaseline: null,
        explanation: 'No baseline price data found.',
      }),
      securityDeposit: {
        success: true,
        data: {
          status: 'skipped',
          flag: null,
          message: 'Security deposit not specified; check skipped.',
          statutoryCitation: null,
        },
      },
      applicationFee: {
        success: true,
        data: {
          status: 'skipped',
          flag: null,
          message: 'Application fee not specified; check skipped.',
          statutoryCitation: null,
        },
      },
      untraceablePayment: workerFallback,
      gisQuery: {
        success: true,
        data: {
          status: 'skipped',
          flag: null,
          message: 'Address not specified; check skipped.',
          parcel: null,
        },
      },
      landUse: {
        success: true,
        data: {
          status: 'skipped',
          flag: null,
          message: 'Land use not specified; check skipped.',
          category: null,
        },
      },
      contactPhone: {
        success: true,
        data: {
          status: 'skipped',
          flag: null,
          message: 'Phone number not specified; check skipped.',
          areaCode: null,
        },
      },
      agencyStanding: {
        status: 'skipped',
        flag: null,
        message: 'Landlord not specified; check skipped.',
      },
      listingSearch: {
        matches: [],
        failedSources: ['address', 'photo'],
      },
      ...overrides,
    };
  }

  it('[Criterion 1] accumulates critical violations and caps score at 100 with rating HIGH', () => {
    const raw = createCompliantChecks({
      // 1. Untraceable payment (+40) and advance fee demand (+35) = 75 points
      untraceablePayment: [
        {
          code: 'UNTRACEABLE_PAYMENT',
          severity: 'critical',
          title: 'Cryptocurrency payment requested.',
          explanation: 'Cryptocurrency payments are irreversible.',
          evidence: 'Bitcoin',
        },
        {
          code: 'ADVANCE_FEE_DEPOSIT',
          severity: 'critical',
          title: 'Advance fee demanded before tour.',
          explanation: 'P2P deposit requested before viewing.',
          evidence: 'Venmo deposit',
        },
      ],
      // 2. Severe rent outlier < 50% baseline (+35 points) -> Total: 110 points
      price: createPriceViolation(),
    });

    const result = calculateListingScore(raw);

    // Sum of points is 40 + 35 + 35 = 110, must cap at 100
    expect(result.score).toBe(100);
    expect(result.rating).toBe('HIGH');
    expect(result.summary).toContain('High risk (100/100)');

    const paymentCheck = result.checks.find((c) => c.id === 'untraceablePayment');
    expect(paymentCheck?.status).toBe('FLAG');
    expect(paymentCheck?.scoreImpact).toBe(POINTS_UNTRACEABLE_PAYMENT + POINTS_ADVANCE_FEE);
    expect(paymentCheck?.evidence).toContain('Bitcoin');

    const priceCheck = result.checks.find((c) => c.id === 'price');
    expect(priceCheck?.status).toBe('FLAG');
    expect(priceCheck?.scoreImpact).toBe(POINTS_RENT_UNDER_50);
  });

  it('[Criterion 2] evaluates compliant checks to low risk score between 0 and 39 with rating LOW', () => {
    const raw = createCompliantChecks();

    const result = calculateListingScore(raw);

    expect(result.score).toBe(0);
    expect(result.rating).toBe('LOW');
    expect(result.summary).toContain('Low risk (0/100)');
    expect(result.checks).toHaveLength(9);

    for (const check of result.checks) {
      expect(check.status).toBe('OK');
      expect(check.scoreImpact).toBe(0);
    }

    const gisCheck = result.checks.find((c) => c.id === 'gisQuery');
    expect(gisCheck?.evidence).toBe('APN: 005-123-45');
  });

  it('[Criterion 3] evaluates moderate violations to risk score between 40 and 69 (MEDIUM)', () => {
    const raw = createCompliantChecks({
      // 1. Non-local area code (+15)
      contactPhone: createNonLocalPhone(),
      // 2. Deposit exceeds standard 1x cap but within 2x (+10)
      securityDeposit: createOver1xDeposit(),
      // 3. Screening fee exceeds statutory cap (+15)
      applicationFee: createExcessiveFee(),
    });

    // Total points: 15 + 10 + 15 = 40 (inside 40-69 band)
    const result = calculateListingScore(raw);

    expect(result.score).toBe(40);
    expect(result.rating).toBe('MEDIUM');
    expect(result.summary).toContain('Moderate risk (40/100)');

    const phoneCheck = result.checks.find((c) => c.id === 'contactPhone');
    expect(phoneCheck?.status).toBe('FLAG');
    expect(phoneCheck?.scoreImpact).toBe(POINTS_NON_LOCAL_PHONE);

    const depositCheck = result.checks.find((c) => c.id === 'securityDeposit');
    expect(depositCheck?.status).toBe('FLAG');
    expect(depositCheck?.scoreImpact).toBe(POINTS_DEPOSIT_OVER_1X);

    const feeCheck = result.checks.find((c) => c.id === 'applicationFee');
    expect(feeCheck?.status).toBe('FLAG');
    expect(feeCheck?.scoreImpact).toBe(POINTS_EXCESSIVE_FEE);
  });

  it('[Criterion 4] strictly adds 0 points for SKIPPED, OK, and UNKNOWN checks', () => {
    const raw = createCompliantChecks({
      securityDeposit: {
        success: true,
        data: {
          status: 'skipped',
          flag: null,
          message: 'Deposit not specified; check skipped',
          statutoryCitation: null,
        },
      },
      applicationFee: workerFallback,
      price: createPassPrice({
        status: 'not_evaluated',
        baseline: null,
        baselineSource: null,
        region: null,
        percentOfBaseline: null,
        explanation: 'No baseline price data found',
      }),
      contactPhone: {
        success: true,
        data: {
          status: 'skipped',
          flag: null,
          message: 'Phone number not specified; check skipped',
          areaCode: null,
        },
      },
      listingSearch: {
        matches: [],
        failedSources: ['address', 'photo'],
      },
    });

    const result = calculateListingScore(raw);

    expect(result.score).toBe(0);
    expect(result.rating).toBe('LOW');

    const skippedDeposit = result.checks.find((c) => c.id === 'securityDeposit');
    expect(skippedDeposit?.status).toBe('SKIPPED');
    expect(skippedDeposit?.scoreImpact).toBe(0);

    const failedFee = result.checks.find((c) => c.id === 'applicationFee');
    expect(failedFee?.status).toBe('UNKNOWN');
    expect(failedFee?.scoreImpact).toBe(0);

    const unknownPrice = result.checks.find((c) => c.id === 'price');
    expect(unknownPrice?.status).toBe('UNKNOWN');
    expect(unknownPrice?.scoreImpact).toBe(0);

    const skippedPhone = result.checks.find((c) => c.id === 'contactPhone');
    expect(skippedPhone?.status).toBe('SKIPPED');
    expect(skippedPhone?.scoreImpact).toBe(0);

    const unknownSearch = result.checks.find((c) => c.id === 'listingSearch');
    expect(unknownSearch?.status).toBe('UNKNOWN');
    expect(unknownSearch?.scoreImpact).toBe(0);
  });

  it('[Criterion 5] returns null score and INSUFFICIENT_DATA when fewer than 3 checks evaluate', () => {
    // Case 1: 0 checks evaluated (all skipped / unknown)
    const allSkipped = createAllSkippedChecks();
    const result0 = calculateListingScore(allSkipped);

    expect(result0.score).toBeNull();
    expect(result0.rating).toBe('INSUFFICIENT_DATA');
    expect(result0.summary).toBe(INSUFFICIENT_DATA_SUMMARY);

    // Case 2: Exactly 1 check evaluated (price OK, others skipped/failed)
    const oneEvaluated = createAllSkippedChecks({
      price: createPassPrice({ explanation: 'Rent is normal' }),
    });

    const result1 = calculateListingScore(oneEvaluated);
    expect(result1.score).toBeNull();
    expect(result1.rating).toBe('INSUFFICIENT_DATA');

    // Case 3: Exactly 2 checks evaluated (price OK + landUse OK, others skipped/failed)
    const twoEvaluated = createAllSkippedChecks({
      price: createPassPrice({ explanation: 'Rent is normal' }),
      landUse: {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Lawful residential land use',
          category: 'residential',
        },
      },
    });

    const result2 = calculateListingScore(twoEvaluated);
    expect(result2.score).toBeNull();
    expect(result2.rating).toBe('INSUFFICIENT_DATA');
  });

  it('[Criterion 6] calculates valid LOW rating when exactly 3 compliant checks are evaluated', () => {
    const raw = createAllSkippedChecks({
      price: createPassPrice({ explanation: 'Rent is normal' }),
      securityDeposit: {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Security deposit complies with statutory limits.',
          statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
        },
      },
      applicationFee: {
        success: true,
        data: {
          status: 'compliant',
          flag: null,
          message: 'Application fee is within legal limit.',
          statutoryCitation: 'Cal. Civ. Code § 1950.6',
        },
      },
    });

    const result = calculateListingScore(raw);

    // Exactly 3 checks evaluated meets MIN_EVALUATED_CHECKS_THRESHOLD
    expect(result.score).toBe(0);
    expect(result.rating).toBe('LOW');
    expect(result.summary).toContain('Low risk (0/100)');

    const evaluated = result.checks.filter((c) => c.status === 'OK' || c.status === 'FLAG');
    expect(evaluated).toHaveLength(MIN_EVALUATED_CHECKS_THRESHOLD);
  });

  it('[Criterion 7] normalizes raw worker outputs into complete CheckResult objects', () => {
    const raw = createCompliantChecks({
      securityDeposit: {
        success: true,
        data: {
          status: 'violation',
          flag: 'ILLEGAL_SECURITY_DEPOSIT',
          message: 'Security deposit exceeds statutory 2x rent cap',
          statutoryCitation: 'Cal. Civ. Code § 1950.5(c)',
        },
      },
      agencyStanding: createSuspendedAgency(),
      gisQuery: createUnverifiedGis(),
      landUse: createLandUseViolation(),
    });

    const result = calculateListingScore(raw);

    expect(result.checks).toHaveLength(9);

    const expectedIds = [
      'price',
      'securityDeposit',
      'applicationFee',
      'untraceablePayment',
      'gisQuery',
      'landUse',
      'contactPhone',
      'agencyStanding',
      'listingSearch',
    ];

    expect(result.checks.map((c) => c.id)).toEqual(expectedIds);

    for (const check of result.checks) {
      expect(typeof check.id).toBe('string');
      expect(typeof check.title).toBe('string');
      expect(['FLAG', 'UNKNOWN', 'OK', 'SKIPPED']).toContain(check.status);
      expect(typeof check.scoreImpact).toBe('number');
      expect(check.scoreImpact).toBeGreaterThanOrEqual(0);
      expect(typeof check.detail).toBe('string');
      expect(check.detail.trim().length).toBeGreaterThan(0);
    }

    // Verify statutory citations and evidence propagation
    const depositCheck = result.checks.find((c) => c.id === 'securityDeposit');
    expect(depositCheck?.scoreImpact).toBe(POINTS_DEPOSIT_OVER_2X);
    expect(depositCheck?.evidence).toBe('Cal. Civ. Code § 1950.5(c)');

    const agencyCheck = result.checks.find((c) => c.id === 'agencyStanding');
    expect(agencyCheck?.scoreImpact).toBe(POINTS_SUSPENDED_ENTITY);

    const gisCheck = result.checks.find((c) => c.id === 'gisQuery');
    expect(gisCheck?.scoreImpact).toBe(POINTS_UNVERIFIED_ADDRESS);

    const landUseCheck = result.checks.find((c) => c.id === 'landUse');
    expect(landUseCheck?.scoreImpact).toBe(POINTS_LAND_USE_MISMATCH);
    expect(landUseCheck?.evidence).toBe('Category: commercial');
  });

  describe('Rubric point additions and threshold edge cases', () => {
    it('applies POINTS_RENT_UNDER_75 (+15) when rent is between 50% and 75% of baseline', () => {
      const raw = createCompliantChecks({
        price: createPassPrice({
          rent: 1800,
          percentOfBaseline: 60.0,
          explanation: 'Rent is 60% of baseline average.',
        }),
      });

      const result = calculateListingScore(raw);
      const priceCheck = result.checks.find((c) => c.id === 'price');

      expect(priceCheck?.status).toBe('FLAG');
      expect(priceCheck?.scoreImpact).toBe(POINTS_RENT_UNDER_75);
      expect(result.score).toBe(POINTS_RENT_UNDER_75);
      expect(result.rating).toBe('LOW');
    });

    it('handles exact 50%, 75%, and 75.1% rent baseline boundaries accurately', () => {
      const at50 = calculateListingScore(
        createCompliantChecks({
          price: createPassPrice({
            rent: 1500,
            percentOfBaseline: 50,
            explanation: 'Rent is 50% of baseline.',
          }),
        }),
      );
      expect(at50.checks.find((c) => c.id === 'price')?.scoreImpact).toBe(POINTS_RENT_UNDER_75);

      const at75 = calculateListingScore(
        createCompliantChecks({
          price: createPassPrice({
            rent: 2250,
            percentOfBaseline: 75,
            explanation: 'Rent is 75% of baseline.',
          }),
        }),
      );
      expect(at75.checks.find((c) => c.id === 'price')?.scoreImpact).toBe(POINTS_RENT_UNDER_75);

      const above75 = calculateListingScore(
        createCompliantChecks({
          price: createPassPrice({
            rent: 2253,
            percentOfBaseline: 75.1,
            explanation: 'Rent is 75.1% of baseline.',
          }),
        }),
      );
      const above75Price = above75.checks.find((c) => c.id === 'price');
      expect(above75Price?.status).toBe('OK');
      expect(above75Price?.scoreImpact).toBe(0);
      expect(above75Price?.evidence).toBe('75.1% of baseline');
    });

    it('applies POINTS_DUPLICATE_MISMATCH (+35) when cross-platform duplicate matches exist', () => {
      const raw = createCompliantChecks({
        listingSearch: {
          matches: [
            {
              url: 'https://zillow.com/homedetails/123-ocean-st/999_zpid/',
              site: 'zillow',
              title: '123 Ocean St Apartment',
              matchedBy: ['address', 'photo'],
              rent: 3200,
            },
          ],
          failedSources: [],
        },
      });

      const result = calculateListingScore(raw);
      const duplicateCheck = result.checks.find((c) => c.id === 'listingSearch');

      expect(duplicateCheck?.status).toBe('FLAG');
      expect(duplicateCheck?.scoreImpact).toBe(POINTS_DUPLICATE_MISMATCH);
      expect(duplicateCheck?.evidence).toContain('zillow.com');
      expect(result.score).toBe(POINTS_DUPLICATE_MISMATCH);
      expect(result.rating).toBe('LOW');
    });

    it('applies POINTS_UNREGISTERED_ENTITY (+10) when rental agency is unregistered', () => {
      const raw = createCompliantChecks({
        agencyStanding: {
          status: 'warning',
          flag: 'UNREGISTERED_ENTITY',
          message: 'Entity not found in official business registry.',
        },
      });

      const result = calculateListingScore(raw);
      const agencyCheck = result.checks.find((c) => c.id === 'agencyStanding');

      expect(agencyCheck?.status).toBe('FLAG');
      expect(agencyCheck?.scoreImpact).toBe(POINTS_UNREGISTERED_ENTITY);
      expect(result.score).toBe(POINTS_UNREGISTERED_ENTITY);
      expect(result.rating).toBe('LOW');
    });

    it('applies POINTS_OBFUSCATED_CONTACT (+25) when flag is OBFUSCATED_PHONE_NUMBER', () => {
      const raw = createCompliantChecks({
        contactPhone: {
          success: true,
          data: {
            status: 'warning',
            flag: 'OBFUSCATED_PHONE_NUMBER',
            message: 'Obfuscated phone number detected in listing text',
            areaCode: '831',
          },
        },
      });

      const result = calculateListingScore(raw);
      const phoneCheck = result.checks.find((c) => c.id === 'contactPhone');

      expect(phoneCheck?.status).toBe('FLAG');
      expect(phoneCheck?.scoreImpact).toBe(POINTS_OBFUSCATED_CONTACT);
      expect(result.score).toBe(POINTS_OBFUSCATED_CONTACT);
      expect(result.rating).toBe('LOW');
    });

    it('applies POINTS_NON_LOCAL_PHONE (+15) when flag is INTERNATIONAL_PHONE_NUMBER', () => {
      const raw = createCompliantChecks({
        contactPhone: {
          success: true,
          data: {
            status: 'warning',
            flag: 'INTERNATIONAL_PHONE_NUMBER',
            message: 'International phone number detected',
            areaCode: null,
          },
        },
      });

      const result = calculateListingScore(raw);
      const phoneCheck = result.checks.find((c) => c.id === 'contactPhone');

      expect(phoneCheck?.status).toBe('FLAG');
      expect(phoneCheck?.scoreImpact).toBe(POINTS_NON_LOCAL_PHONE);
      expect(phoneCheck?.evidence).toBeNull();
    });

    it('applies POINTS_LAND_USE_MISMATCH (+25) for VACANT_OR_UNBUILT_PARCEL', () => {
      const raw = createCompliantChecks({
        landUse: {
          success: true,
          data: {
            status: 'warning',
            flag: 'VACANT_OR_UNBUILT_PARCEL',
            message: 'Property is classified as vacant land',
            category: 'vacant',
          },
        },
      });

      const result = calculateListingScore(raw);
      const landUseCheck = result.checks.find((c) => c.id === 'landUse');

      expect(landUseCheck?.status).toBe('FLAG');
      expect(landUseCheck?.scoreImpact).toBe(POINTS_LAND_USE_MISMATCH);
      expect(landUseCheck?.evidence).toBe('Category: vacant');
    });

    it('flags price violation even when percentOfBaseline is null', () => {
      const raw = createCompliantChecks({
        price: createPriceViolation({
          baseline: null,
          baselineSource: null,
          region: null,
          percentOfBaseline: null,
          explanation: 'Rent is flagged as a violation.',
        }),
      });

      const result = calculateListingScore(raw);
      const priceCheck = result.checks.find((c) => c.id === 'price');

      expect(priceCheck?.status).toBe('FLAG');
      expect(priceCheck?.scoreImpact).toBe(POINTS_RENT_UNDER_50);
    });

    it('normalizes price check to UNKNOWN when status is pass but percentOfBaseline is null', () => {
      const raw = createCompliantChecks({
        price: createPassPrice({
          baseline: null,
          baselineSource: null,
          region: null,
          percentOfBaseline: null,
          explanation: 'Percentage unavailable.',
        }),
      });

      const result = calculateListingScore(raw);
      const priceCheck = result.checks.find((c) => c.id === 'price');

      expect(priceCheck?.status).toBe('UNKNOWN');
      expect(priceCheck?.scoreImpact).toBe(0);
    });

    it('provides a non-empty fallback detail when payment violation title is empty', () => {
      const raw = createCompliantChecks({
        untraceablePayment: [
          {
            code: 'HIGH_RISK_PAYMENT_METHOD',
            severity: 'critical',
            title: '   ',
            explanation: 'Irreversible payment requested.',
            evidence: 'Crypto',
          },
        ],
      });

      const result = calculateListingScore(raw);
      const paymentCheck = result.checks.find((c) => c.id === 'untraceablePayment');

      expect(paymentCheck?.status).toBe('FLAG');
      expect(paymentCheck?.scoreImpact).toBe(POINTS_UNTRACEABLE_PAYMENT);
      expect(paymentCheck?.detail.trim().length).toBeGreaterThan(0);
    });

    it('scores P2P HIGH_RISK_PAYMENT_METHOD selections (zelle/venmo) as POINTS_ADVANCE_FEE and deduplicates evidence', () => {
      const raw = createCompliantChecks({
        untraceablePayment: [
          {
            code: 'HIGH_RISK_PAYMENT_METHOD',
            severity: 'critical',
            title: 'Zelle payment method has been requested.',
            explanation: 'P2P payment requested.',
            evidence: 'zelle',
          },
          {
            code: 'HIGH_RISK_PAYMENT_METHOD',
            severity: 'critical',
            title: 'Venmo payment method has been requested.',
            explanation: 'P2P payment requested.',
            evidence: 'venmo',
          },
        ],
      });

      const result = calculateListingScore(raw);
      const paymentCheck = result.checks.find((c) => c.id === 'untraceablePayment');

      expect(paymentCheck?.status).toBe('FLAG');
      expect(paymentCheck?.scoreImpact).toBe(POINTS_ADVANCE_FEE);
      expect(paymentCheck?.evidence).toBe('zelle, venmo');
      expect(result.score).toBe(POINTS_ADVANCE_FEE);
    });

    it('caps multiple UNTRACEABLE_PAYMENT findings at POINTS_UNTRACEABLE_PAYMENT and deduplicates titles/evidence', () => {
      const raw = createCompliantChecks({
        untraceablePayment: [
          {
            code: 'UNTRACEABLE_PAYMENT',
            severity: 'critical',
            title: 'A cryptocurrency payment has been requested.',
            explanation: 'Irreversible.',
            evidence: 'Bitcoin',
          },
          {
            code: 'UNTRACEABLE_PAYMENT',
            severity: 'critical',
            title: 'A cryptocurrency payment has been requested.',
            explanation: 'Irreversible.',
            evidence: 'Bitcoin',
          },
          {
            code: 'HIGH_RISK_PAYMENT_METHOD',
            severity: 'critical',
            title: 'Wire Transfer payment method has been requested.',
            explanation: 'Irreversible.',
            evidence: 'wire_transfer',
          },
        ],
      });

      const result = calculateListingScore(raw);
      const paymentCheck = result.checks.find((c) => c.id === 'untraceablePayment');

      expect(paymentCheck?.status).toBe('FLAG');
      expect(paymentCheck?.scoreImpact).toBe(POINTS_UNTRACEABLE_PAYMENT);
      expect(paymentCheck?.evidence).toBe('Bitcoin, wire_transfer');
    });

    it('normalizes unrecognized runtime payment violation codes to UNKNOWN with 0 points', () => {
      const unknownViolation = {
        code: 'UNKNOWN_CODE',
        severity: 'critical',
        title: 'Unknown payment code',
        explanation: 'Unknown',
        evidence: 'unknown',
      } as unknown as PaymentViolation;

      const raw = createCompliantChecks({
        untraceablePayment: [unknownViolation],
      });

      const result = calculateListingScore(raw);
      const paymentCheck = result.checks.find((c) => c.id === 'untraceablePayment');

      expect(paymentCheck?.status).toBe('UNKNOWN');
      expect(paymentCheck?.scoreImpact).toBe(0);
    });

    it('notes partial search failure in detail when one duplicate search source fails', () => {
      const raw = createCompliantChecks({
        listingSearch: {
          matches: [],
          failedSources: ['photo'],
        },
      });

      const result = calculateListingScore(raw);
      const searchCheck = result.checks.find((c) => c.id === 'listingSearch');

      expect(searchCheck?.status).toBe('OK');
      expect(searchCheck?.detail).toContain('photo');
    });

    it('normalizes success: false worker error envelopes to UNKNOWN with 0 points', () => {
      const raw = createCompliantChecks({
        securityDeposit: { success: false, error: 'Invalid financial input values' },
        applicationFee: { success: false, error: 'Invalid application fee value' },
        gisQuery: { success: false, error: 'Invalid address input value' },
        landUse: { success: false, error: 'Invalid land use input values' },
        contactPhone: { success: false, error: 'Invalid phone input parameter' },
      });

      const result = calculateListingScore(raw);

      expect(result.score).toBe(0);
      expect(result.rating).toBe('LOW');

      for (const id of [
        'securityDeposit',
        'applicationFee',
        'gisQuery',
        'landUse',
        'contactPhone',
      ]) {
        const check = result.checks.find((c) => c.id === id);
        expect(check?.status).toBe('UNKNOWN');
        expect(check?.scoreImpact).toBe(0);
      }
    });

    it('normalizes WORKER_FAILED fallbacks across all 9 checks to UNKNOWN with 0 points', () => {
      const raw: RawChecks = {
        price: workerFallback,
        securityDeposit: workerFallback,
        applicationFee: workerFallback,
        untraceablePayment: workerFallback,
        gisQuery: workerFallback,
        landUse: workerFallback,
        contactPhone: workerFallback,
        agencyStanding: workerFallback,
        listingSearch: workerFallback,
      };

      const result = calculateListingScore(raw);

      expect(result.score).toBeNull();
      expect(result.rating).toBe('INSUFFICIENT_DATA');
      for (const check of result.checks) {
        expect(check.status).toBe('UNKNOWN');
        expect(check.scoreImpact).toBe(0);
        expect(check.detail.trim().length).toBeGreaterThan(0);
      }
    });

    it('falls back to non-empty detail when worker returns whitespace-only message', () => {
      const raw = createCompliantChecks({
        agencyStanding: {
          status: 'warning',
          flag: 'SUSPENDED_ENTITY',
          message: '   ',
        },
      });

      const result = calculateListingScore(raw);
      const agencyCheck = result.checks.find((c) => c.id === 'agencyStanding');

      expect(agencyCheck?.status).toBe('FLAG');
      expect(agencyCheck?.scoreImpact).toBe(POINTS_SUSPENDED_ENTITY);
      expect(agencyCheck?.detail.trim().length).toBeGreaterThan(0);
    });

    it('categorizes rating tier boundaries (35 LOW, 40 MEDIUM, 65 MEDIUM, 70 HIGH)', () => {
      // 35 (price < 50%) -> 35 (LOW)
      const score35 = calculateListingScore(
        createCompliantChecks({
          price: createPriceViolation({ explanation: 'Rent under 50%.' }),
        }),
      );
      expect(score35.score).toBe(35);
      expect(score35.rating).toBe('LOW');

      // 40 (15 + 15 + 10) -> MEDIUM
      const score40 = calculateListingScore(
        createCompliantChecks({
          contactPhone: createNonLocalPhone(),
          applicationFee: createExcessiveFee(),
          securityDeposit: createOver1xDeposit(),
        }),
      );
      expect(score40.score).toBe(40);
      expect(score40.rating).toBe('MEDIUM');

      // 65 (25 + 25 + 15) -> MEDIUM (still below 70)
      const score65 = calculateListingScore(
        createCompliantChecks({
          gisQuery: createUnverifiedGis(),
          landUse: createLandUseViolation(),
          contactPhone: createNonLocalPhone(),
        }),
      );
      expect(score65.score).toBe(65);
      expect(score65.rating).toBe('MEDIUM');

      // 70 (30 suspended + 25 gis + 15 fee) -> HIGH
      const score70 = calculateListingScore(
        createCompliantChecks({
          agencyStanding: createSuspendedAgency(),
          gisQuery: createUnverifiedGis(),
          applicationFee: createExcessiveFee(),
        }),
      );
      expect(score70.score).toBe(70);
      expect(score70.rating).toBe('HIGH');
    });

    it('applies POINTS_ADVANCE_FEE (+35) when only ADVANCE_FEE_DEPOSIT is flagged', () => {
      const raw = createCompliantChecks({
        untraceablePayment: [
          {
            code: 'ADVANCE_FEE_DEPOSIT',
            severity: 'critical',
            title: 'Advance deposit requested before tour.',
            explanation: 'P2P payment requested prior to viewing.',
            evidence: 'Zelle holding fee',
          },
        ],
      });

      const result = calculateListingScore(raw);
      const paymentCheck = result.checks.find((c) => c.id === 'untraceablePayment');

      expect(paymentCheck?.status).toBe('FLAG');
      expect(paymentCheck?.scoreImpact).toBe(POINTS_ADVANCE_FEE);
      expect(result.score).toBe(POINTS_ADVANCE_FEE);
    });

    it('deduplicates failedSources before treating duplicate search as unavailable', () => {
      const raw = createCompliantChecks({
        listingSearch: {
          matches: [],
          failedSources: ['address', 'address'],
        },
      });

      const result = calculateListingScore(raw);
      const searchCheck = result.checks.find((c) => c.id === 'listingSearch');

      expect(searchCheck?.status).toBe('OK');
      expect(searchCheck?.detail).toContain('address');
    });

    it('uses non-null fallback detail when price explanation is empty and baseline is null', () => {
      const raw = createCompliantChecks({
        price: createPriceViolation({
          rent: 1100,
          baseline: null,
          baselineSource: null,
          region: null,
          percentOfBaseline: null,
          explanation: '',
        }),
      });

      const result = calculateListingScore(raw);
      const priceCheck = result.checks.find((c) => c.id === 'price');

      expect(priceCheck?.status).toBe('FLAG');
      expect(priceCheck?.detail.trim().length).toBeGreaterThan(0);
      expect(priceCheck?.detail).not.toContain('null');
    });
  });
});
