import { describe, it, expect } from 'vitest';
import { detectUntraceablePayment } from '../src/services/paymentFlags.service.ts';

//start of test cases for 1st subtask
describe('detectUntraceablePayment: Samples of Scamming', () => {
  it.each([
    ['BTC', 'Send money via BTC to reserve the property.'],
    ['USDT', 'Pay your deposit via USDT, will provide wallet after your reply'],
    ['Bitcoin', 'To reserve this property in Santa Cruz, deposit via Bitcoin will be acceptable'],
    ['Ethereum', 'Please send your deposit via Ethereum to secure the property.'],
  ])('[Criterion 1] Detecting crypto payment methods (%s)', (method: string, description: string) => {
    const testResult = detectUntraceablePayment(description);

    expect(testResult).toHaveLength(1);
    expect(testResult[0]).toMatchObject({
      code: 'UNTRACEABLE_PAYMENT',
      severity: 'critical',
      title: expect.any(String),
      explanation: expect.any(String),
      evidence: method,
    });
  });

  it.each([
    ['MoneyGram', 'Please pay landlord via MoneyGram to reserve the property.'],
    [
      'wire transfer',
      'To hold the property for the first month, please wire transfer your deposit.',
    ],
    [
      'Western Union',
      'The landlord is abroad and require payment via Western Union to secure the property.',
    ],
  ])('[Criterion 2] Detecting wire transfer payment methods (%s)', (method: string, description: string) => {
    const testResult = detectUntraceablePayment(description);

    expect(testResult).toHaveLength(1);
    expect(testResult[0]).toMatchObject({
      code: 'UNTRACEABLE_PAYMENT',
      severity: 'critical',
      title: expect.any(String),
      explanation: expect.any(String),
      evidence: method,
    });
  });

  it.each([
    ['Vanilla Visa gift card', 'Please pay deposit for the property with Vanilla Visa gift card.'],
    ['Apple gift-cards', 'To pay deposit for property, send codes of your Apple gift-cards.'],
    [
      'Steam gift cards',
      'To hold your current Santa Cruz property, please pay deposit via Steam gift cards.',
    ],
  ])('[Criterion 3] Detecting Gift Card paying methods (%s)', (method: string, description: string) => {
    const testResult = detectUntraceablePayment(description);

    expect(testResult).toHaveLength(1);
    expect(testResult[0]).toMatchObject({
      code: 'UNTRACEABLE_PAYMENT',
      severity: 'critical',
      title: expect.any(String),
      explanation: expect.any(String),
      evidence: method,
    });
  });

  it('[Criterion 4] Testing for any letter case matches', () => {
    const uppAndLowCase = detectUntraceablePayment('wIrE tRAnSFer');
    const upperCase = detectUntraceablePayment('PAY WITH WESTERN UNION');
    const lowerCase = detectUntraceablePayment('bitcoin only');

    expect(uppAndLowCase[0].evidence).toBe('wIrE tRAnSFer');
    expect(upperCase[0].evidence).toBe('WESTERN UNION');
    expect(lowerCase[0].evidence).toBe('bitcoin');
  });

  it('[Criterion 5] Testing to see if one violation per category is returned with multiple categories matching', () => {
    const oneViolationPerCategory = detectUntraceablePayment(
      'Please send your deposit with USDT or wire transfer to secure the property.',
    );

    expect(oneViolationPerCategory).toHaveLength(2);
    const theEvidence = oneViolationPerCategory.map((violation) => violation.evidence);
    expect(theEvidence).toEqual(expect.arrayContaining(['USDT', 'wire transfer']));
  });

  it('[Criterion 5] Testing to see if a single violation is returned when it matches multiple terms in a description', () => {
    const oneViolationOnly = detectUntraceablePayment(
      'Please pay your deposit via Bitcoin, Ethereum, or BTC.',
    );
    expect(oneViolationOnly).toHaveLength(1);
    expect(oneViolationOnly[0].evidence).toBe('Bitcoin');
  });

  it('[Criterion 5] Testing to see if 3 violations are returned when all 3 categories are matched in a description', () => {
    const threeViolationsTest = detectUntraceablePayment(
      'For paying your deposit, Steam gift card, Bitcoin, or Western Union are acceptable payment methods.',
    );
    expect(threeViolationsTest).toHaveLength(3);
  });
});

describe('detectUntraceablePayment: Samples of Clean Data (no scams)', () => {
  it.each([
    'After the lease is signed, rent will be paid by check.',
    'To pay for first month rent and security deposit after lease is signed, pay by personal check or by automated clearing house (ACH).',
    'The property is near the bus line and university, property also comes with a bath and steam shower.',
    'Rent is to be paid at the end of each month through an online portal like Blue Sky by the tenants.',
  ])('[Criterion 6] Testing for clean data (no reports of scams)', (description: string) => {
    expect(detectUntraceablePayment(description)).toEqual([]);
  });

  it('[Criterion 6] Testing to verify that terms do NOT match within longer words', () => {
    const noTermInLongerWords = detectUntraceablePayment(
      'The property resides on Bitcoiner Avenue, and is a small BTCXABC apartment.',
    );
    expect(noTermInLongerWords).toEqual([]);
  });

  /*
  it.each([[67], [''], ['  '], [undefined], [null], [{}]])(
    'Testing to see if [] is returned for empty or invalid inputs (%s)',
    (description: unknown) => {
      expect(detectUntraceablePayment(description)).toEqual([]);
    },
  );
  */

  it.each([[''], [' ']])( '[Criterion 6] Testing to verify if [] is returned for empty or whitespace-only inputs (%s)', 
    (description: string) => {
      expect(detectUntraceablePayment(description)).toEqual([]);
    }
  );

  it.each([[67], [undefined], [null], [{}]])('[Criterion 6] Testing to verify that non-string inputs will throw (%s)',
    (description: unknown) => {
      expect(() => detectUntraceablePayment(description as string)).toThrow();
    }
  );
});
