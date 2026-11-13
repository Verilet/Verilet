//Docstring for the file:
const CATEGORIES_OF_PAYMENT =[

    {
        payment_id: 'wire', 
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
        "Gift card payments are irreversible and untraceable." +
        " Avoid sending money through this method, and see the property before signing any lease."
    },
];

//end of Important constants for subtask 1

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

export {detectUntraceablePayment, CATEGORIES_OF_PAYMENT};


