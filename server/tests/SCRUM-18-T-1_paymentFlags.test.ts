import { describe, it, expect } from 'vitest';
import { detectUntraceablePayment } from '../src/services/paymentFlags.service.ts';

//start of test cases for 1st subtask
describe('detectUntraceablePayment: Samples of Scamming', () => {
  it.each([
    ['BTC', 'Send money via BTC to reserve the property.'],
    ['USDT', 'Pay your deposit via USDT, will provide wallet after your reply'],
    ['Bitcoin', 'To reserve this property in Santa Cruz, deposit via Bitcoin will be acceptable'],
    ['Ethereum', 'Please send your deposit via Ethereum to secure the property.'],
  ])('Detecting crypto payment methods (%s)', (method: string, description: string) => {
    const test_result = detectUntraceablePayment(description);

    expect(test_result).toHaveLength(1);
    expect(test_result[0]).toMatchObject({
      code: 'UNTRACEABLE_PAYMENT',
      severity: 'critical',
      title: expect.any(String),
      explanation: expect.any(String),
      evidence: method,
    });
  });

  it.each([
    ['MoneyGram', 'Please pay landloard via MoneyGram to reserve the property.'],
    [
      'wire transfer',
      'To hold the property for the first month, please wire transfer your deposit.',
    ],
    [
      'Western Union',
      'The landlord is abroad and require payment via Western Union to secure the property.',
    ],
  ])('Detecting wire transfer payment methods (%s)', (method: string, description: string) => {
    const test_result = detectUntraceablePayment(description);

    expect(test_result).toHaveLength(1);
    expect(test_result[0]).toMatchObject({
      code: 'UNTRACEABLE_PAYMENT',
      severity: 'critical',
      title: expect.any(String),
      explanation: expect.any(String),
      evidence: method,
    });
  });

  it.each([
    ['Vanilla Visa gift card', 'Please pay deposit for the property with Vanilla Visa gift card.'],
    ['Apple gift cards', 'To pay deposit for property, send codes of your Apple gift cards.'],
    [
      'Steam gift cards',
      'To hold your current Santa Cruz property, please pay deposit via Steam gift cards.',
    ],
  ])('Detecting Gift Card paying methods (%s)', (method: string, description: string) => {
    const test_result = detectUntraceablePayment(description);

    expect(test_result).toHaveLength(1);
    expect(test_result[0]).toMatchObject({
      code: 'UNTRACEABLE_PAYMENT',
      severity: 'critical',
      title: expect.any(String),
      explanation: expect.any(String),
      evidence: method,
    });
  });

  it('Testing for any letter case matches', () => {
    const upp_and_low_case = detectUntraceablePayment('wIrE tRAnSFer');
    const upper_case = detectUntraceablePayment('PAY WITH WESTERN UNION');
    const lower_case = detectUntraceablePayment('bitcoin only');

    expect(upp_and_low_case[0].evidence).toBe('wIrE tRAnSFer');
    expect(upper_case[0].evidence).toBe('WESTERN UNION');
    expect(lower_case[0].evidence).toBe('bitcoin');
  });

  it('Testing to see if one violation per category is retuend with multiple categories matching', () => {
    const one_violation_per_category = detectUntraceablePayment(
      'Please send your deposit with USDT or wire transfer to secure the property.',
    );

    expect(one_violation_per_category).toHaveLength(2);
    const the_evidence = one_violation_per_category.map((violation) => violation.evidence);
    expect(the_evidence).toEqual(expect.arrayContaining(['USDT', 'wire transfer']));
  });

  it('Testing to if a single violation is returned when it matches multiple terms in a description', () => {
    const one_violation_only = detectUntraceablePayment(
      'Please pay your deposit via Bitcoin, Ethereum, or BTC.',
    );
    expect(one_violation_only).toHaveLength(1);
    expect(one_violation_only[0].evidence).toBe('Bitcoin');
  });

  it('Testing to see if 3 violations are returned when all 3 categories are matched in a description', () => {
    const three_violations_test = detectUntraceablePayment(
      'For paying your deposit, Steam gift card, Bitcoin, or Western Union are acceptable payment methods.',
    );
    expect(three_violations_test).toHaveLength(3);
  });
});

describe('detectUntraceablePayment: Samples of Clean Data (no scams)', () => {
  it.each([
    'After the lease is signed, rent will be paid by check.',
    'To pay for first month rent and security deposit after lease is signed, pay by personal check or by automated clearing house (ACH).',
    'The property is near the bus line and university, property also comes with a bath and steam shower.',
    'Rent is to be paid at the end of each month through an online portal like Blue Sky by the tenants.',
  ])('Testing for clean data (no reports of scams)', (description: string) => {
    expect(detectUntraceablePayment(description)).toEqual([]);
  });

  it('Testing to verify that terms do NOT match within longer words', () => {
    const no_term_in_longer_words = detectUntraceablePayment(
      'The prperty resides on Bitcoiner Avenue, and is a small BTCXABC apartment.',
    );
    expect(no_term_in_longer_words).toEqual([]);
  });

  it.each([[67], [''], ['  '], [undefined], [null], [{}]])(
    'Testing to see if [] is returned for empty or invalid inputs (%s)',
    (description: unknown) => {
      expect(detectUntraceablePayment(description)).toEqual([]);
    },
  );
});
// hello
// end of test cases for 1st subtask
