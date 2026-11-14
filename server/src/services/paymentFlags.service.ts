import { z } from 'zod';
//test
/** Zod schema for the type of payment violation. */
export const PaymentViolationSchema = z.object({
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

/** The Zod Schema for a payment violation. */
export type PaymentViolation = z.infer<typeof PaymentViolationSchema>;

/** Zod schema for the input to the payment flags service. */
export const PaymentFlagsInputSchema = z.string().trim().min(1);

/** An array of objects that define different categories of untraceable payment methods. */
const CATEGORIES_OF_PAYMENT =[
    {
        /** The identifier for the payment method. */
        paymentId: 'wire', 
        /** An array of strings representing the terms associated with the respective payment method. */
        paymentTerms: ['western Union', 'MoneyGram', 'wire transfer'],
        /** The title for the payment method. */
        paymentTitle: 'A wire transfer payment has been requested.',
        /** A description of the payment method and its risks. */
        explanation: "Wire transfer payments are almost impossible to recover " +
        "once they have been sent. Avoid sending money through this method, " +
        "and see the property before signing any lease."
    },
    {
        paymentId: 'crypto',
        paymentTerms: ['Bitcoin', 'BTC', 'Ethereum', 'USDT'],
        paymentTitle: 'A cryptocurrency payment has been requested.',
        explanation: "Cryptocurrency payments are irreversible and untraceable " +
        "to the recipient. Landlords usually accept traceable payments such as bank transfers or checks."
        + " Avoid sending money through this method, and see the property before signing any lease." 
    },
    {
        paymentId: 'giftcard',
        paymentTerms: ['Apple', 'Steam', 'Vanilla Visa'],
        suffix: 'gift[\\s-]?cards?',
        paymentTitle: 'A gift card payment has been requested.',
        explanation: "Legitimate landlords do not accept gift cards as a form of payment. " + 
        "Gift card payments are irreversible and untraceable." +
        " Avoid sending money through this method, and see the property before signing any lease."
    },
];

/**
 * Make certain special characters in a string safe for regex matching.
 * 
 * @param s, the string to be escaped for regex matching
 * @return the string with special characters escaped for regex matching (compatible for regex)
 */
function escapeSpecCharRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

}

/**
 * Converts a single payment term into a regex textual pattern
 * that ensures special characters are valid for the regex matching 
 * and spaces are replaced with whitespace match.
 * 
 * @param term, the single payment term, e.g. 'wire transfer'
 * @return the term converted into a regex pattern, e.g. 'wire\s+transfer'
 */
const termToRegex = (term: string): string => 
    escapeSpecCharRegex(term).replace(/ /g, '\\s+');

/**
 * Converts a category of untraceable payment methods into a regex pattern.
 * 
 * @param category, the paymentTerms and suffix fields of a category of untraceable payment methods
 * @return a regex expression matching any of the payment terms, followed by suffix if there is one
 */
function categoryToRegex({paymentTerms, suffix}: {paymentTerms: string[], suffix?: string}): RegExp {
    const jointTerms = paymentTerms.map(termToRegex).join('|');
    const suffixEnd = suffix ? `\\s+${suffix}` : '';                   // if there is a suffix, add it to the regex pattern with whitespace before it
    return new RegExp(`\\b(?:${jointTerms})${suffixEnd}\\b`, 'i');
}

//**Constructs new array with same info from CATEGORIES_OF_PAYMENT plus regex pattern for each category*/
const categoriesNPatterns = CATEGORIES_OF_PAYMENT.map(category => ({
    ...category,
    paymentPattern: categoryToRegex(category),
}));

/**
 * Detects untraceable payment methods like wire transfers, cryptocurrency, and gift cards in a given listing description.
 * 
 * @param description, the listing description where untraceable payment methods may or may not be detected.
 * @return an array of payment violation objects, each representing a detected untraceable category of payment, or [] none are detected.
 * 
 */
function detectUntraceablePayment(description: unknown): PaymentViolation[] {

    const parsedDescription = PaymentFlagsInputSchema.safeParse(description);
    if (!parsedDescription.success) {
        return [];
    }

    const violations: PaymentViolation[] = [];

    for (const {paymentTitle, explanation, paymentPattern} of categoriesNPatterns) {
        const regMatchFound = parsedDescription.data.match(paymentPattern);

        if (regMatchFound) {
            violations.push({code: 'UNTRACEABLE_PAYMENT',
                severity: 'critical',
                title: paymentTitle,
                explanation,
                evidence: regMatchFound[0],
            });
        }
    }
    return violations;
}   
<<<<<<< HEAD
=======

>>>>>>> 33e74854a558810373d9d6c9e70c97e8ca28db4a
export {detectUntraceablePayment, CATEGORIES_OF_PAYMENT};