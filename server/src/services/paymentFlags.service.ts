import { z } from 'zod';

/** The interface for a payment violation detected in listing description. */
export interface PaymentViolation {
  code: 'UNTRACEABLE_PAYMENT';
  severity: 'critical';
  title: string;
  explanation: string;
  evidence: string;
}

/** The payment category fields that are needed to build the regex. */
interface PaymentCategoryPattern {
  paymentTerms: readonly string[];
  suffix?: string;
}

/** The Zod schema for the input to the payment flags service. */
export const PaymentFlagInputSchema = z.string().trim();

/** A listing description where untraceable payment methods may be scanned from. */
export type PaymentFlagInput = z.infer<typeof PaymentFlagInputSchema>;

/** An array of objects that define different categories of untraceable payment methods. */
const CATEGORIES_OF_PAYMENT = [
  {
    paymentId: 'wire',
    paymentTerms: ['Western Union', 'MoneyGram', 'wire transfer'],
    paymentTitle: 'A wire transfer payment has been requested.',
    explanation:
      'Wire transfer payments are almost impossible to recover ' +
      'once they have been sent. Avoid sending money through this method, ' +
      'and see the property before signing any lease.',
  },
  {
    paymentId: 'crypto',
    paymentTerms: ['Bitcoin', 'BTC', 'Ethereum', 'USDT'],
    paymentTitle: 'A cryptocurrency payment has been requested.',
    explanation:
      'Cryptocurrency payments are irreversible and untraceable ' +
      'to the recipient. Landlords usually accept traceable payments such as bank transfers or checks.' +
      ' Avoid sending money through this method, and see the property before signing any lease.',
  },
  {
    paymentId: 'giftcard',
    paymentTerms: ['Apple', 'Steam', 'Vanilla Visa'],
    suffix: 'gift[\\s-]?cards?',
    paymentTitle: 'A gift card payment has been requested.',
    explanation:
      'Legitimate landlords do not accept gift cards as a form of payment. ' +
      'Gift card payments are irreversible and untraceable.' +
      ' Avoid sending money through this method, and see the property before signing any lease.',
  },
] as const;

/**
 * Make certain special characters in a string safe for regex matching.
 *
 * @param s The string to be escaped for regex matching.
 * @return The string with special characters escaped for regex matching (compatible for regex).
 */
function escapeRegexSpecialCharacters(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converts a single payment term into a regex textual pattern
 * that ensures special characters are valid for the regex matching
 * and spaces are replaced with whitespace match.
 *
 * @param term The single payment term, e.g. 'wire transfer'.
 * @return The term converted into a regex pattern, e.g. 'wire\s+transfer'.
 */
const termToRegex = (term: string): string =>
  escapeRegexSpecialCharacters(term).replace(/ /g, '\\s+');

/**
 * Converts a category of untraceable payment methods into a regex pattern.
 *
 * @param category The paymentTerms and suffix fields of a category of untraceable payment methods.
 * @return A regex expression matching any of the payment terms, followed by suffix if there is one.
 */
function categoryToRegex(category: PaymentCategoryPattern): RegExp {
  // sort the payment terms by length in descending order to ensure longer terms are matched first
  const jointTerms = [...category.paymentTerms]
    .sort((a, b) => b.length - a.length)
    .map(termToRegex)
    .join('|');
  // if there is a suffix, add it to the regex pattern with whitespace before it
  const suffixEnd = category.suffix ? `[\\s-]+${category.suffix}` : '';
  return new RegExp(`\\b(?:${jointTerms})${suffixEnd}\\b`, 'i');
}

/** Constructs new array with same info from CATEGORIES_OF_PAYMENT plus regex pattern for each category. */
const CATEGORIES_AND_PATTERNS = CATEGORIES_OF_PAYMENT.map((category) => ({
  ...category,
  paymentPattern: categoryToRegex(category),
}));

/**
 * Detects untraceable payment methods like wire transfers, cryptocurrency, and gift cards in a given listing description.
 *
 * @param description The listing description where untraceable payment methods may or may not be detected.
 * @return An array of payment violation objects, each representing a detected untraceable category of payment, or [] if none are detected.
 */
function detectUntraceablePayment(description: PaymentFlagInput): PaymentViolation[] {
  const parsedDescription = PaymentFlagInputSchema.safeParse(description);
  if (!parsedDescription.success || parsedDescription.data === '') {
    return [];
  }

  const violations: PaymentViolation[] = [];

  for (const { paymentTitle, explanation, paymentPattern } of CATEGORIES_AND_PATTERNS) {
    const regMatchFound = parsedDescription.data.match(paymentPattern);

    if (regMatchFound) {
      violations.push({
        code: 'UNTRACEABLE_PAYMENT',
        severity: 'critical',
        title: paymentTitle,
        explanation,
        evidence: regMatchFound[0],
      });
    }
  }
  return violations;
}
export { detectUntraceablePayment };
