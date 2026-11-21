import { z } from 'zod';

/** The interface for a payment violation detected in listing description. */
export interface PaymentViolation {
  code: 'UNTRACEABLE_PAYMENT' | 'ADVANCE_FEE_DEPOSIT' | 'HIGH_RISK_PAYMENT_METHOD';
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

/** The Zod schema for the a listing description to be analyzed when passed to all payment flag detectors. */
export const PaymentFlagInputSchema = z.string().trim().min(1).nullish();

/** The Zod schema for the high-risk payment selection array to be analyzed when passed to the high-risk payment selection detector. */
export const HighRiskSelectionSchema = z.array(z.unknown()).nullish();

/** A listing description where untraceable payment methods and in-advanced free requests may be scanned from. Could be a string or null/undefined. */
export type PaymentFlagInput = z.infer<typeof PaymentFlagInputSchema>;

/** An array of payment methods selected by a user that may be scanned for high-risk payment methods. Could be an array of strings or null/undefined. */
export type HighRiskSelectionInput = z.infer<typeof HighRiskSelectionSchema>;

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

/** An array of terms for P2P payment apps. */
const p2pPaymenntApps = ['Venmo', 'Chime', 'CashApp', 'Zelle', 'Cash App'];
/** An array of terms for in-advance payments. */
const inAdvancePaymentTerms = ['deposit', 'before tour', 'before viewing', 'holding fee'];
/** The max number of characters allowed between a P2P payment app term AND an in-advance payment term. */
const p2pToDepositRange = 80;

// use Record<string, string> to resolve key error
const HIGH_RISK_PAYMENTS: Record<string, string> = {
  crypto: 'Cryptocurrency',
  wire_transfer: 'Wire Transfer',
  gift_card: 'Gift Card',
  zelle: 'Zelle',
  venmo: 'Venmo',
  cashapp: 'Cash App',
  chime: 'Chime',
};

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
function termToRegex(term: string): string {
  return escapeRegexSpecialCharacters(term).replace(/ /g, '\\s+');
}

/**
 * Converts a category of untraceable payment methods into a regex pattern.
 *
 * @param category The paymentTerms and suffix fields of a category of untraceable payment methods.
 * @return A regex expression matching any of the payment terms, followed by suffix if there is one.
 */
function categoryToRegex(category: PaymentCategoryPattern): RegExp {
  // Sort the payment terms by length in descending order to ensure longer terms are matched first
  const jointTerms = [...category.paymentTerms]
    .sort((a, b) => b.length - a.length)
    .map(termToRegex)
    .join('|');
  // If there is a suffix, add it to the regex pattern with whitespace before it
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
export function detectUntraceablePayment(description: PaymentFlagInput): PaymentViolation[] {
  const parsedDescription = PaymentFlagInputSchema.safeParse(description);

  if (
    !parsedDescription.success ||
    parsedDescription.data === '' ||
    parsedDescription.data === null ||
    parsedDescription.data === undefined
  ) {
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

/**
 * Creates a regex pattern from an array of terms.
 *
 * @param terms The array of terms to create a regex from.
 * @return A regex pattern that matches any of the terms.
 */
function createRegexFromTerms(terms: readonly string[]) {
  return `(?:${terms.map(termToRegex).join('|')})`;
}

/** Creates a regex pattern for P2P payment apps.*/
const p2pPayAppRegex = createRegexFromTerms(p2pPaymenntApps);
/**Create a regex pattern for in advance payment terms. */
const inAdvancePaymentRegex = createRegexFromTerms(inAdvancePaymentTerms);
/**The acceptable gap between the P2P payment app and the in advance payment term. */
const gapBetween = `[\\s\\S]{0,${p2pToDepositRange}}?`;

/** Creates a regex pattern for detecting in advance fee payments. */
const InAdvance_Fee_Pattern = new RegExp(
  `\\b${p2pPayAppRegex}\\b${gapBetween}\\b${inAdvancePaymentRegex}\\b|\\b${inAdvancePaymentRegex}\\b${gapBetween}\\b${p2pPayAppRegex}\\b`,
  'i',
);

/**
 * @param description The listing description where in advance fee payments may be detected.
 * @returns An array of payment violation objects, each representing a detected in advance fee payment, or [] if none are detected.
 */
export function detectAdvanceFee(description: PaymentFlagInput): PaymentViolation[] {
  const parsedDescription = PaymentFlagInputSchema.safeParse(description);

  if (
    !parsedDescription.success ||
    parsedDescription.data === '' ||
    parsedDescription.data === null ||
    parsedDescription.data === undefined
  ) {
    return [];
  }

  const advanceFeeFound = parsedDescription.data.match(InAdvance_Fee_Pattern);

  if (!advanceFeeFound) return [];

  return [
    {
      code: 'ADVANCE_FEE_DEPOSIT',
      severity: 'critical',
      title: 'An in advance deposit fee has been requested prior to tour.',
      explanation:
        'No legitimate landload requests non-refundable funds prior to a tour/viewing. ' +
        'Scammers tend to use P2P apps like Cash App, Venmo, Zelle, Chime, etc. to ask for deposits before touring the property. ' +
        'These types of transctions are irreversible and untraceable. ' +
        'Make sure to avoid these types of payment methods and see the property before signing a lease.',
      evidence: advanceFeeFound[0],
    },
  ];
}

/**
 * Creates a key from a payment method.
 * @param payMethod The payment method to create a key for.
 * @returns The created key.
 */
function createKey(payMethod: string): string {
  return payMethod
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/**
 * Detects high-risk payment selections.
 * @param paymentMethods The array of payment methods to check.
 * @returns An array of payment violation objects, each representing a detected high-risk payment method, or [] if none are detected.
 */
export function detectHighRiskSelections(
  paymentMethods: HighRiskSelectionInput,
): PaymentViolation[] {
  const parsedPaymentMethods = HighRiskSelectionSchema.safeParse(paymentMethods);

  if (
    !parsedPaymentMethods.success ||
    parsedPaymentMethods.data === null ||
    parsedPaymentMethods.data === undefined
  ) {
    return [];
  }

  const violationsDetected: PaymentViolation[] = [];
  const reportedValues = new Set<string>();
  const noMethods = parsedPaymentMethods.data.length;

  for (let i = 0; i < noMethods; i++) {
    const method = parsedPaymentMethods.data[i];
    if (typeof method !== 'string' || method.trim() === '') continue;

    const key = createKey(method);

    // using Object the built-in Javascript constrcutor
    // find out if key is not in the HIGH_RISK_PAYMENTS structure
    // OR if the key has already been reported
    const hasKey = Object.prototype.hasOwnProperty.call(HIGH_RISK_PAYMENTS, key);
    const seenBefore = reportedValues.has(key);

    if (!hasKey || seenBefore) continue;

    reportedValues.add(key);

    const theHighRiskPayment = HIGH_RISK_PAYMENTS[key];

    violationsDetected.push({
      code: 'HIGH_RISK_PAYMENT_METHOD',
      severity: 'critical',
      title: `${theHighRiskPayment} payment method has been requested.`,
      explanation:
        `${theHighRiskPayment} payments are irreversible and untraceable. ` +
        `Payments through checks and bank transfers are traceable and are commonly used by legitimate landlords.  ` +
        `Do not send money through ${theHighRiskPayment}. Make sure to see property prior to signing a lease.`,
      evidence: method,
    });
  }
  return violationsDetected;
}
