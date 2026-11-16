import type { Bedrooms, PaymentMethod, ScanCheck, ScanInput } from '../schemas/scan.schema.js';
import { DEFAULT_MAX_APPLICATION_FEE, evaluateApplicationFee } from './applicationFee.service.js';
import { evaluateSecurityDeposit } from './securityDeposit.service.js';

/**
 * Scores a listing on the server, so saved scores can't be changed in the browser. The deposit
 * and application fee checks use the California rules in their own services; the rent, payment,
 * landlord and details checks are still placeholders until area rent data and records lookups
 * exist. See docs/specs/scans-api.md.
 */

const BASE_SCORE = 5;
const RISKY_PAYMENTS: readonly PaymentMethod[] = ['gift-card', 'wire', 'crypto'];
const CAUTION_PAYMENTS: readonly PaymentMethod[] = ['zelle-venmo', 'cash', 'other'];

/** Rough minimum "normal" monthly rent per listing type. */
const TYPICAL_MIN_RENT: Record<Bedrooms, number> = {
  room: 700,
  studio: 1300,
  '1': 1600,
  '2': 2100,
  '3': 2800,
  '4+': 3400,
};

const PAYMENT_DETAIL: Record<PaymentMethod, string> = {
  'bank-transfer': 'Landlord asks for a bank transfer',
  check: 'Landlord asks for a check or money order',
  'rental-platform': 'Landlord uses a rental platform',
  'zelle-venmo': 'Landlord asks for a peer-to-peer payment app',
  cash: 'Landlord asks for cash',
  wire: 'Landlord asks for payment by wire transfer',
  'gift-card': 'Landlord asks for payment by gift card',
  crypto: 'Landlord asks for payment in cryptocurrency',
  other: 'Landlord asks for an unusual payment method',
};

interface CheckResult {
  check: ScanCheck;
  points: number;
}

function checkRent(input: ScanInput): CheckResult {
  const ratio = input.rent / TYPICAL_MIN_RENT[input.bedrooms];
  const base = { id: 'rent', title: 'Rent vs. area price' };
  if (ratio < 0.6) {
    return {
      check: { ...base, detail: 'Rent is much lower than typical for this area', status: 'FLAG' },
      points: 40,
    };
  }
  if (ratio < 0.85) {
    return {
      check: {
        ...base,
        detail: 'Rent is a little lower than typical for this area',
        status: 'UNKNOWN',
      },
      points: 15,
    };
  }
  return { check: { ...base, detail: 'Rent is in line with this area', status: 'OK' }, points: 0 };
}

function checkPayment(input: ScanInput): CheckResult {
  const base = { id: 'payment', title: 'Payment method', detail: PAYMENT_DETAIL[input.payment] };
  if (RISKY_PAYMENTS.includes(input.payment)) {
    return { check: { ...base, status: 'FLAG' }, points: 35 };
  }
  if (CAUTION_PAYMENTS.includes(input.payment)) {
    return { check: { ...base, status: 'UNKNOWN' }, points: 10 };
  }
  return { check: { ...base, status: 'OK' }, points: 0 };
}

function checkLandlord(input: ScanInput): CheckResult {
  return {
    check: {
      id: 'landlord',
      title: 'Landlord check',
      detail: input.landlord ? 'No record found for this landlord' : 'No landlord name was given',
      status: 'UNKNOWN',
    },
    points: 10,
  };
}

/** Adds the law a finding is based on to its detail line. */
function cite(detail: string, citation: string | null): string {
  return citation ? `${detail} (${citation})` : detail;
}

/** California's cap on security deposits. Skipped when no deposit was given. */
function checkDeposit(input: ScanInput): CheckResult | null {
  const result = evaluateSecurityDeposit({ rent: input.rent, deposit: input.securityDeposit });
  if (!result.success || result.data.status === 'skipped') {
    return null;
  }
  const { status, statutoryCitation } = result.data;
  const base = { id: 'deposit', title: 'Security deposit' };
  if (status === 'violation') {
    return {
      check: {
        ...base,
        detail: cite(
          "Deposit is more than two months' rent, above California's legal limit",
          statutoryCitation,
        ),
        status: 'FLAG',
      },
      points: 30,
    };
  }
  if (status === 'warning') {
    return {
      check: {
        ...base,
        detail: cite(
          "Deposit is more than one month's rent, which only some small landlords may charge",
          statutoryCitation,
        ),
        status: 'UNKNOWN',
      },
      points: 10,
    };
  }
  return {
    check: {
      ...base,
      detail: cite("Deposit is within California's limit of one month's rent", statutoryCitation),
      status: 'OK',
    },
    points: 0,
  };
}

/** California's cap on application screening fees. Skipped when no fee was given. */
function checkApplicationFee(input: ScanInput): CheckResult | null {
  const result = evaluateApplicationFee({ applicationFee: input.applicationFee });
  if (!result.success || result.data.status === 'skipped') {
    return null;
  }
  const { status, statutoryCitation } = result.data;
  const base = { id: 'applicationFee', title: 'Application fee' };
  if (status === 'violation') {
    return {
      check: {
        ...base,
        detail: cite(
          `Application fee is above California's $${DEFAULT_MAX_APPLICATION_FEE} limit`,
          statutoryCitation,
        ),
        status: 'FLAG',
      },
      points: 20,
    };
  }
  return {
    check: {
      ...base,
      detail: cite("Application fee is within California's limit", statutoryCitation),
      status: 'OK',
    },
    points: 0,
  };
}

function checkDetails(input: ScanInput): CheckResult {
  const hasDetails = input.description !== '' || input.photoCount > 0;
  return {
    check: {
      id: 'details',
      title: 'Listing details',
      detail: hasDetails
        ? 'Photos and description look consistent'
        : 'No description or photos were added',
      status: hasDetails ? 'OK' : 'UNKNOWN',
    },
    points: 0,
  };
}

/** Scores a listing from 0 (low risk) to 100 (high risk), with the reason for each check. */
export function scoreListing(input: ScanInput): { score: number; checks: ScanCheck[] } {
  const results = [
    checkRent,
    checkPayment,
    checkDeposit,
    checkApplicationFee,
    checkLandlord,
    checkDetails,
  ]
    .map((check) => check(input))
    .filter((result): result is CheckResult => result !== null);
  const score = results.reduce((total, result) => total + result.points, BASE_SCORE);
  return { score: Math.min(100, score), checks: results.map((result) => result.check) };
}
