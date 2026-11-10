//paymentFlags.ts




//Top of File; Important constants for subtask 1
const CATEGORIES_OF_PAYMENT =[

    {
        payment_id: 'wire', //not sure if this will be used by team, but here as placeholder for now
        payment_terms: ['western Union', 'MoneyGram', 'wire transfer'],
        payment_title: 'A wire transfer payment has been requested.',
        explanation: "Wire transfer payments are almost impossible to recover " +
        "once they have been sent. Avoid sending money through this method, " +
        "and see the property before signing any lease."

    },

    {
        payment_id: 'crypto',
        payment_terms: ['Bitcoin', 'BTC', 'Ethereum', 'USDT'],
        payment_title: 'A cryptocurrency payment has been requested.',
        explanation: "Cryptocurrent payments are irreversible and untraceable " +
        "to the recipient. Landlords usually accept traceable payments such as bank transfers or checks."
        + " Avoid sending money through this method, and see the property before signing any lease." 

    },

    {
        payment_id: 'giftcard',
        payment_terms: ['Apple', 'Steam', 'Vanilla Visa'],
        suffix: 'gift[\\s-]?cards?',
        payment_title: 'A gift card payment has been requested.',
        explanation: "Legimate landlords do not accept gift cards as a form of payment. " + 
        "Gift card payments irreviersible and untraceable." +
        " Avoid sending money through this method, and see the property before signing any lease."

    },
];

//end of Important constants for subtask 1

//Important constants for subtask 2

const P2P_Paymennt_Apps = ['Venmo', 'Chime', 'CashApp', 'Zelle', 'Cash App'];
const InAdvance_Payment_Terms = ['deposit', 'before tour', 'before viweing', 'holding fee'];
const P2P_to_Deposit_Range = 80;

//use Record<string, string> to resolve key error
const HIGH_RISK_PAYMENTS: Record<string, string> = {
    crypto: 'Cryptocurrency',
    wire_transfer: 'Wire Transfer',
    gift_card: 'Gift Card',
    zelle: 'Zelle',
    venmo: 'Venmo',
    cashapp: 'Cash App',
    chime: 'Chime',
}

//end of Important constants for subtask 2


//Start of Helper Functions/Actions for Scrum-18-T-1

//helper function for Regex checking
//makes special characters in the string safe for regex matching
function escape_SpecChar_regex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

}

//calling the helper function: escape_SpecChar_regex() 
const termToRegex = (term: string): string => 
    escape_SpecChar_regex(term).replace(/ /g, '[\\s+]');



function categoryToRegex({payment_terms, suffix}: {payment_terms: string[], suffix?: string}): RegExp {
    const jointTerms = payment_terms.map(termToRegex).join('|');
    const sufix_end = suffix ? `|${suffix}` : '';                   //one line if/else statement: condition ? valueIfTrue : ValueIfFalse
      return new RegExp(`\\b(?:${jointTerms}${sufix_end})\\b`, 'i');
}

//construct a new array with same info from CATEGORIES_OF_PAYMENT
//but with an additional field 'pattern' containing the regex pattern for each category
const Categories_N_Patterns = CATEGORIES_OF_PAYMENT.map(category => ({
    ...category,
    payment_pattern: categoryToRegex(category),
}));

//End of helper functions for Scrum-18-T-1


//Main Function for Scrum-18-T-1
function detectUntraceablePayment(description: string){

    //if the description is not a string or if its empty, return empty array
    if (typeof description !== 'string' || description.trim() === '') 
        return [];

    const violations = [];

    for (const {payment_title, explanation, payment_pattern} of Categories_N_Patterns) {
        const reg_match_found = description.match(payment_pattern);

        if (reg_match_found) {
            violations.push({code: 'UNTRACEABLE_PAYMENT',
                severity: 'critical',
                payment_title,
                explanation,
                evidence: reg_match_found[0],
            });
        }
    }
    return violations;
}   

//Helper functions/actions for Scrum-18-T-2


//First function of Scrum-18-T-2: detectAdvanceFee()
const terms_to_Regex = (terms:string[]) => 
    `(?:${terms.map(termToRegex).join('|')})`;

const P2P_Pay_App_Regex = terms_to_Regex(P2P_Paymennt_Apps);
const InAdvance_Payment_Regex = terms_to_Regex(InAdvance_Payment_Terms);
const gap_between = `[\\s\\S]{0,${P2P_to_Deposit_Range}}?`;

const InAdvance_Fee_Pattern = new RegExp(
  `\\b${P2P_Pay_App_Regex}\\b${gap_between}\\b${InAdvance_Payment_Regex}\\b|\\b${InAdvance_Payment_Regex}\\b${gap_between}\\b${P2P_Pay_App_Regex}\\b`,
  'i'
);

function detectAdvanceFee(description: string){

    if (typeof description !== 'string' || description.trim() === '')
        return [];

    const advanceFeeFound = description.match(InAdvance_Fee_Pattern);

    if (!advanceFeeFound) 
        return [];

    return [
        {
            code: 'ADVANCE_FEE_DEPOSIT',
            severity: 'critical',
            title: "An in advance deposit fee has been requested prior to tour.",
            explanation: "No legitimate landload requests non-refundable funds prior to a tour/viewing. " +
            "Scammers tend to use P2P apps like Cash App, Venmo, Zelle, Chime, etc. to ask for deposits before touring the property. " +
            "These types of transctions are irreversible and untraceable. " +
            "Make sure to avoid these types of payment methods and see the property before signing a lease.",
            evidence: advanceFeeFound[0],
        },
    ];
}



const createKey = (payMethod: string) =>
    payMethod.trim().toLowerCase().replace(/[\s-]+/g, '_');

//Second function of Scrum-18-T-2: detectHighRiskPayment()
function detectHighRiskSelections(paymentMethods: string[]){

    if (!Array.isArray(paymentMethods))
        return [];

    const violations_detected = [];
    const reported_values = new Set();
    const no_methods = paymentMethods.length;

    for (let i = 0; i < no_methods; i++) {
        const method = paymentMethods[i];
        if (typeof method !== 'string' || method.trim() === '')
            continue;

        const key = createKey(method);

        //using Object the built-in Javascript constrcutor
        //find out if key is not in the HIGH_RISK_PAYMENTS structure
        //OR if the key has already been reported
        const hasKey = Object.prototype.hasOwnProperty.call(HIGH_RISK_PAYMENTS, key);
        const seenBefore = reported_values.has(key);

        if (!hasKey || seenBefore)
            continue;

        reported_values.add(key);

        const the_high_risk_payment = HIGH_RISK_PAYMENTS[key];

        violations_detected.push({
            code: 'HIGH_RISK_PAYMENT_METHOD',
            severity: 'critical',
            title: `${the_high_risk_payment} payment method has been requested.`,
            explanation: `${the_high_risk_payment} payments are irreversible and untraceable.` +
             'Payments through checks and bank transfers are traceable and are commonly used by legitimate landlords.' +
             'Do not send money through ${the_high_risk_payment}. Make sure to see property prior to signing a lease.',
            evidence: method,
        });

    }
    return violations_detected;
}



export {detectUntraceablePayment, CATEGORIES_OF_PAYMENT};
export {detectAdvanceFee, detectHighRiskSelections,  HIGH_RISK_PAYMENTS};


