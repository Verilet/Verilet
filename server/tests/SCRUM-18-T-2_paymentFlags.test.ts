import { describe, it, expect } from 'vitest';
import {
  detectAdvanceFee,
  detectHighRiskSelections,
} from '../src/services/paymentFlags.service.js';
import type { HighRiskSelectionInput } from '../src/services/paymentFlags.service.js';
import type { PaymentFlagInput } from '../src/services/paymentFlags.service.js';

//start of test cases for 2nd subtask

describe('detectAdvanceFee: Samples of Scamming', () => {
  it.each([
    ['Zelle holding fee', 'Prior to touring the property, send the Zelle holding fee'],
    ['Venmo me a deposit', 'To reserve the proerty, Venmo me a deposit to do so.'],
    ['Cash App', 'To receive the keys to the apartment, pay deposit via Cash App.'],
    [
      'CashApp the holding fee',
      'If you are interested in renting this property, CashApp the holding fee to secure it.',
    ],
    [
      'before viewing',
      'Venmo or CashApp me $500 prior to touring the property if you are interested.',
    ],
    [
      'deposit via Chime',
      'Only those serious on renting the property must Venmo $400 before viewing the property.',
    ],
  ])(
    'Testing for P2P app payments with deposit/holding fee terms %s',
    (evidence: string, description: string) => {
      const test_result = detectAdvanceFee(description);
      expect(test_result).toHaveLength(1);
      expect(test_result[0]).toMatchObject({
        code: 'ADVANCE_FEE_DEPOSIT',
        severity: 'critical',
        title: expect.any(String),
        explanation: expect.any(String),
      });
      expect(test_result[0].evidence.toLowerCase()).toContain(evidence.toLowerCase().split(' ')[0]);
    },
  );

  it('Test to see if the matched span of text is used as evidence for the violation', () => {
    const matched_span = detectAdvanceFee(
      'Please pay the Zelle holding fee of $500 prior to viewing the property.',
    )[0].evidence;
    expect(matched_span).toBe('Zelle holding fee');
  });

  it('Test to see if the matches can be in any letter case or any order of the two terms', () => {
    expect(detectAdvanceFee('venmo the HOLDING FEE')).toHaveLength(1);
    expect(detectAdvanceFee('DEPOSIT through Cash App')).toHaveLength(1);
  });

  it('Test to show the explanation of legitimate landloards not requiring non-refundable fund prior to viewing', () => {
    const [curr_violation] = detectAdvanceFee(
      'Please send deposit via Zelle prior to viewing the property.',
    );
    expect(curr_violation.explanation).toMatch(
      'No legitimate landload requests non-refundable funds prior to a tour/viewing.  ' +
        'Scammers tend to use P2P apps like Cash App, Venmo, Zelle, Chime, etc. to ask for deposits before touring the property. ' +
        'These types of transctions are irreversible and untraceable. ' +
        'Make sure to avoid these types of payment methods and see the property before signing a lease.',
    );
  });

  it('Test to see if the text that is matched is at exactly 80 characters apart, no more.', () => {
    const exactly_80_char = detectAdvanceFee('Chime' + ' '.repeat(80) + 'deposit');
    expect(exactly_80_char).toHaveLength(1);

    const more_than_80_char = detectAdvanceFee('Chime' + ' '.repeat(81) + 'deposit');
    expect(more_than_80_char).toEqual([]);
  });
});

describe('detectAdvanceFee: Samples of Clean Data (no scams)', () => {
  it.each([
    'Rent can be paid by Zelle after the lease is sgined.',
    'The security deposit is collected after the lease is signed, please by check.',
    'After moving in, the rent can be paid via Chime, Venmo, or Zelle.',
    'No payment is required to participate in the property tour this weekend.',
  ])('Testing for NO advance fee requests (only single term): %s', (description: string) => {
    const single_term_test = detectAdvanceFee(description);
    expect(single_term_test).toEqual([]);
  });

  it('Test to see that [] is returned when range between app and deposit terms are greater than 80 characters', () => {
    const greater_than_80_char = detectAdvanceFee(
      'Please pay by Zelle' + ' '.repeat(81) + 'deposit',
    );
    expect(greater_than_80_char).toEqual([]);
  });

  it.each([[69], [''], ['  '], [undefined], [null], [{}]])(
    'Testing to see if [] is returned for empty or invalid inputs (%s)',
    (description: unknown) => {
      expect(detectAdvanceFee(description as PaymentFlagInput)).toEqual([]);
    },
  );
});

describe('detectHighRiskSelections: Samples of Scamming', () => {
  it('Test to see that 2 violations are returned for gift_card and crypto', () => {
    const two_violation_test = detectHighRiskSelections(['gift_card', 'crypto']);
    expect(two_violation_test).toHaveLength(2);

    two_violation_test.forEach(
      (violation: {
        code: string;
        severity: string;
        title: string;
        explanation: string;
        evidence: string;
      }) =>
        expect(violation).toMatchObject({
          code: 'HIGH_RISK_PAYMENT_METHOD',
          severity: 'critical',
          title: expect.any(String),
          explanation: expect.any(String),
        }),
    );
    expect(
      two_violation_test.map(
        (violation: {
          code: string;
          severity: string;
          title: string;
          explanation: string;
          evidence: string;
        }) => violation.evidence,
      ),
    ).toEqual(['gift_card', 'crypto']);
  });

  it.each(['cashapp', 'venmo', 'zelle', 'crypto', 'wire_transfer', 'gift_card'])(
    'Test to see that a violation is returned for each high risk payment method (%s)',
    (method: string) => {
      expect(detectHighRiskSelections([method])).toHaveLength(1);
    },
  );

  it('Test to see that all 6 high risk payment methods are detected', () => {
    const all_high_risk_methods = [
      'cashapp',
      'venmo',
      'zelle',
      'crypto',
      'wire_transfer',
      'gift_card',
    ];
    const every_violation = detectHighRiskSelections(all_high_risk_methods);
    expect(every_violation).toHaveLength(6);
  });

  it('Test to see the high risk payment methods are case-insensitive, tolerates hyphens and spaces', () => {
    const case_insensitive_test = detectHighRiskSelections([
      'Wire Transfer',
      'gift-card',
      'CRYPTO',
    ]);
    expect(case_insensitive_test).toHaveLength(3);

    const case_insensitive_test2 = detectHighRiskSelections(['Zelle'])[0].evidence;
    expect(case_insensitive_test2).toBe('Zelle');
  });

  it('Test to see that only the risky payment methods are detected', () => {
    const mixed_methods = ['bank_transfer', 'check', 'venmo', 'cash'];
    const risky_methods = detectHighRiskSelections(mixed_methods);
    expect(risky_methods).toHaveLength(1);
    expect(risky_methods[0].evidence).toBe('venmo');
  });

  it('Test to see that repeated high risk payment methods are only detected once', () => {
    const repeated_methods_test = detectHighRiskSelections(['venmo', 'Venmo']);
    expect(repeated_methods_test).toHaveLength(1);
  });

  it.each([
    [[]],
    [null],
    [undefined],
    [{}],
    [['cash']],
    ['crypto'],
    [['check', 'bank_transfer']],
    [[null, 88, 'constructing']],
  ])('Test to see if [] is returned for any safe or invalid inputs (%j)', (methods: unknown) => {
    const safe_invalid_test = detectHighRiskSelections(methods as HighRiskSelectionInput);
    expect(safe_invalid_test).toEqual([]);
  });
});
