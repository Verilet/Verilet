import {describe, it, expect} from 'vitest';
import {detectUntraceablePayment, detectAdvanceFee, detectHighRiskSelections} from '../src/services/paymentFlags.js';   


//start of test cases for 1st subtask
describe('detectUntraceablePayment: Samples of Scamming', () => {
    it.each([
        ['BTC', 'Send money via BTC to reserve the property.'],
        ['USDT','Pay your deposit via USDT, will provide wallet after your reply'],
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
    ['MoneryGram', 'Please pay landloard via MoneryGram to reserve the property.'],
    ['wire transfer', 'To hold the property for the first month, please wire trasnfer your deposit.'],
    ['Western Union', 'The landlord is abroad and require payment via Western Union to secure the property.'],
  
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
    ['Apple gift card', 'To pay deposit for property, send codes of your Apple gift cards.'],
    ['Steam gift cards', 'To hold your current Santa Cruz property, please pay deposit via Steam gift cards.'],
    
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
        
        const one_violation_per_category = detectUntraceablePayment('Please send your deposit with USDT or wire transfer to secure the property.');

        expect(one_violation_per_category).toHaveLength(2);
        expect(one_violation_per_category[0].evidence).toBe('USDT');
        expect(one_violation_per_category[1].evidence).toBe('wire transfer');
    });

    it('Testing to if a single violation is returned when it matches multiple terms in a description', () => {

        const one_violation_only = detectUntraceablePayment('Please pay your deposit via Bitcoin, Ethereum, or BTC.');
        expect(one_violation_only).toHaveLength(1);
        expect(one_violation_only[0].evidence).toBe('Bitcoin');

    });

    it('Testing to see if 3 violations are returned when all 3 categories are matched in a description', () => {

        const three_violations_test = detectUntraceablePayment('For paying your deposit, Steam gift card, Bitcoin, or Western Union are acceptable payment methods.');
        expect(three_violations_test).toHaveLength(3);

    });
});



describe('detectAdvanceFee: Samples of Clean Data (no scams)', () => {
    
    it.each([
      'After the lease is signed, rent will be paid by check.',
      'To pay for first month rent and security deposit after lease is signed, pay by personal check or by automated clearing house (ACH).',
      'The property is near the bus line and university, property also comes with a bath and steam shower.',
      'Rent is to be paid at the end of each month through an online portal like Blue Sky by the tenants.',  
    ])('Testing for clean data (no reports of scams)', (description: string) => {
        expect(detectUntraceablePayment(description)).toEqual([]);
    });

    it('Testing to verify that terms do NOT match within longer words', () => {
        const no_term_in_longer_words = detectUntraceablePayment('The prperty resides on Bitcoiner Avenue, and is a small BTCXABC apartment.');
        expect(no_term_in_longer_words).toEqual([]);
    });

    it.each([[67], [''], ['  '], [undefined], [null], [{}]])
            ('Testing to see if [] is returned for empty or invalid inputs (%s)',
            (description: any) => {
                expect(detectUntraceablePayment(description)).toEqual([]);
            });
});

//end of test cases for 1st subtask






//start of test cases for 2nd subtask

describe('detectAdvanceFee: Samples of Scamming', () => {
    it.each([
        ['Zelle holding fee', 'Prior to touring the property, send the Zelle holding fee'],
        ['Venmo me a deposit', 'To reserve the proerty, Venmo me a deposit to do so.'],
        ['Cash App', 'To receive the keys to the apartment, pay deposit via Cash App.'],
        ['CashApp the holding fee', 'If you are interested in renting this property, CashApp the holding fee to secure it.'],
        ['before viewing', 'Venmo or CashApp me $500 prior to touring the property if you are interested.'],
        ['deposit via Chime', 'Only those serious on renting the property must Venmo $400 before viewing the property.'],
    ])('Testing for P2P app payments with deposit/holding fee terms %s', (evidence: string, description: string) => {
        
        const test_result = detectAdvanceFee(description);
        expect(test_result).toHaveLength(1);
        expect(test_result[0]).toMatchObject({
            code: 'ADVANCE_FEE_DEPOSIT',
            severity: 'critical',
            title: expect.any(String),
            explanation: expect.any(String),
        });
        expect(test_result[0].evidence.toLowerCase()).toContain(evidence.toLowerCase().split(' ')[0]);
    });

    it('Test to see if the matched span of text is used as evidence for the violation', () => {
        const matched_span = detectAdvanceFee('Please pay the Zelle holding fee of $500 prior to viewing the property.')[0].evidence;
        expect(matched_span).toBe('Zelle holding fee');
    });

    it('Test to see if the matches can be in any letter case or any order of the two terms', () => {
        expect(detectAdvanceFee('venmo the HOLDING FEE')).toHaveLength(1);
        expect(detectAdvanceFee('DEPOSIT through Cash App')).toHaveLength(1);
    });

    it('Test to show the explanation of legitimate landloards not requiring non-refundable fund prior to viewing', () => {
        const [curr_violation] = detectAdvanceFee('Please send deposit via Zelle prior to viewing the property.');
        expect(curr_violation.explanation).toMatch("No legitimate landload requests non-refundable funds prior to a tour/viewing.  " +
            "Scammers tend to use P2P apps like Cash App, Venmo, Zelle, Chime, etc. to ask for deposits before touring the property. " +
            "These types of transctions are irreversible and untraceable. " +
            "Make sure to avoid these types of payment methods and see the property before signing a lease.");
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
        const greater_than_80_char = detectAdvanceFee('Please pay by Zelle' + ' '.repeat(81) + 'deposit');
        expect(greater_than_80_char).toEqual([]);
    });

    it.each([[69], [''], ['  '], [undefined], [null], [{}]])
            ('Testing to see if [] is returned for empty or invalid inputs (%s)',
            (description: any) => {
                expect(detectAdvanceFee(description)).toEqual([]);
            });
});

describe('detectHighRiskSelections: Samples of Scamming', () => {

    it('Test to see that 2 violations are returned for gift_card and crypto', () => {
        const two_violation_test = detectHighRiskSelections(['gift_card', 'crypto']);
        expect(two_violation_test).toHaveLength(2);

        two_violation_test.forEach((violation: { code: string; severity: string; title: string; explanation: string; evidence: string }) => 
            expect(violation).toMatchObject({
                code: 'HIGH_RISK_PAYMENT_METHOD',
                severity: 'critical',
                title: expect.any(String),
                explanation: expect.any(String),
            })
        );
        expect(two_violation_test.map((violation: { code: string; severity: string; title: string; explanation: string; evidence: string }) => violation.evidence)).toEqual(['gift_card', 'crypto']);
    });

    it.each(['cashapp', 'venmo', 'zelle', 'crypto', 'wire_transfer', 'gift_card']) 
    
    ('Test to see that a violation is returned for each high risk payment method (%s)', (method: string) => {
        expect(detectHighRiskSelections([method])).toHaveLength(1);
    });


    it('Test to see that all 6 high risk payment methods are detected', () => {
        const all_high_risk_methods = ['cashapp', 'venmo', 'zelle', 'crypto', 'wire_transfer', 'gift_card'];
        const every_violation = detectHighRiskSelections(all_high_risk_methods);
        expect(every_violation).toHaveLength(6);
    });

    it('Test to see the high risk payment methods are case-insensitive, tolerates hyphens and spaces', () => {
        const case_insensitive_test = detectHighRiskSelections(['Wire Transfer', 'gift-card', 'CRYPTO']);
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

    it.each([[]], [null], [undefined], [{}], [['cash']], ['crypto'], [['check', 'bank_transfer']], [[null, 88, 'constructing']])
    ('Test to see if [] is returned for any safe or invalid inputs (%j)', (methods: any) => {
        const safe_invalid_test = detectHighRiskSelections(methods);
        expect(safe_invalid_test).toEqual([]);
    });
});