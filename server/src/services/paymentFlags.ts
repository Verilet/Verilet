import { z } from 'zod';

/**Zod schema for the categories of payment. */
export const paymentViolationSchema = z.object({
    /** Identifies the kind of violation. */
    code: z.literal('UNTRACEABLE_PAYMENT'),
    /** How serious the violation is. */
    severity: z.literal('critical'),
    /** Short heading shown to the student. */
    title: z.string(),
    /** Why the payment method is risky. */
    explanation: z.string(),
    /** The exact text that triggered the flag. */
    evidence: z.string(),
});

export type paymentViolation = z.infer<typeof paymentViolationSchema>;

export const paymentFlagsInputSchema = z.string().trim().min(1);

/**An array of objects that define diffrent categories od untraceable payment methods. */
const CATEGORIES_OF_PAYMENT =[

    {
        /** The identifier for the payment method. */
        payment_id: 'wire', 
        /** An array of strings representing the terms associated with the respective payment method. */
        payment_terms: ['western Union', 'MoneyGram', 'wire transfer'],
        /** The title for the payment method. */
        payment_title: 'A wire transfer payment has been requested.',
        /** A description of the payment method and its risks. */
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
function detectUntraceablePayment(description: unknown): paymentViolation[] {


    /*
    //if the description is not a string or if its empty, return empty array
    if (typeof description !== 'string' || description.trim() === '') 
        return [];
    */

    const parsedDescription = paymentFlagsInputSchema.safeParse(description);
    if (!parsedDescription.success) {
        return [];
    }

    const violations = [];

    for (const {payment_title, explanation, payment_pattern} of Categories_N_Patterns) {
        const reg_match_found = parsedDescription.data.match(payment_pattern);

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


