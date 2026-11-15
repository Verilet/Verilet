import type { Model } from 'mongoose';
import { z } from 'zod';
import {
  SanJoseRentModel,
  SantaCruzRentModel,
  type RentBaseline,
} from '../../models/rentBaseline.model.js';

/** Rental space types the price checker can compare. */
export const SPACE_TYPES = [
  'shared_room',
  'single_room',
  'studio',
  '1br',
  '2br',
  '3br',
  '4br',
] as const;

/** One of the supported rental space types. */
export type SpaceType = (typeof SPACE_TYPES)[number];

/** Regions with rent data. */
export const REGIONS = ['santa_cruz', 'san_jose'] as const;

/** One of the supported regions. */
export type Region = (typeof REGIONS)[number];

export const BASE_LINE = 0.5;

interface RegionData {
  /** Region name used in explanations. */
  label: string;
  model: Model<RentBaseline>;
  roomTypes: Record<SpaceType, string[]>;
}

export const REGION_DATA: Record<Region, RegionData> = {
  santa_cruz: {
    label: 'Santa Cruz County',
    model: SantaCruzRentModel,
    roomTypes: {
      shared_room: [],
      single_room: ['room in shared house'],
      studio: ['Studio'],
      '1br': ['1br/Duplex', '1br Apartment/Condo'],
      '2br': ['2br'],
      '3br': ['3br'],
      '4br': ['4br'],
    },
  },
  san_jose: {
    label: 'the San Jose-Sunnyvale-Santa Clara area',
    model: SanJoseRentModel,
    roomTypes: {
      shared_room: [],
      single_room: ['1br in a shared home'],
      studio: ['Studio'],
      '1br': ['1br'],
      '2br': ['2br'],
      '3br': ['3br'],
      '4br': ['4br'],
    },
  },
};

/** Zod schema for the price checker's input. */
export const PriceCheckInputSchema = z.object({
  /** Listing's monthly rent */
  rent: z.number().positive(),
  /** Rental space type being offered. */
  spaceType: z.enum(SPACE_TYPES),
  /** 5-digit ZIP code of the listing */
  zip: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  /** Region of the listing */
  region: z.enum(REGIONS).optional(),
});

/** Input accepted by the price checker. */
export type PriceCheckInput = z.infer<typeof PriceCheckInputSchema>;

/** Zod schema for the price checker's result. */
export const PriceCheckResultSchema = z.object({
  /** Which checker produced this result. */
  checker: z.literal('price'),
  /** pass, violation, or not_evaluated when no baseline was found. */
  status: z.enum(['pass', 'violation', 'not_evaluated']),
  /** Severity of a violation */
  severity: z.literal('critical').nullable(),
  /** Listing's monthly rent */
  rent: z.number(),
  /** Average monthly rent */
  baseline: z.number().nullable(),
  /** Whether the baseline is a ZIP level or region-wide average. */
  baselineSource: z.enum(['zip', 'county']).nullable(),
  /** Region whose data was used, or null if no baseline was found. */
  region: z.enum(REGIONS).nullable(),
  /** Rent as a percentage of the baseline, rounded to 1 decimal. */
  percentOfBaseline: z.number().nullable(),
  /** Explanation for the user. */
  explanation: z.string(),
});

/** Result returned by the price checker. */
export type PriceCheckResult = z.infer<typeof PriceCheckResultSchema>;

/** A baseline rent found in the database, and how it was matched. */
export interface BaselineMatch {
  rent: number;
  source: 'zip' | 'county';
  region: Region;
}

/** For writing the explanation sentence. */
const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  shared_room: 'shared room',
  single_room: 'single room',
  studio: 'studio',
  '1br': '1-bedroom',
  '2br': '2-bedroom',
  '3br': '3-bedroom',
  '4br': '4-bedroom',
};

/**
 * Formats a number as whole US dollars, e.g. 2400 -> "$2,400".
 *
 * @param amount Numeric dollar amount.
 * @return Formatted USD currency string.
 */
function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * Returns the lowest price among matching records.
 *
 * @param docs Array of rent baseline documents.
 * @return Lowest price found among records.
 */
function lowestPrice(docs: RentBaseline[]): number {
  return Math.min(...docs.map((doc) => doc.price));
}

/**
 * Decides which region's data to use: if region is not given, uses ZIP
 * to find the region. If neither is given or valid, returns null.
 *
 * @param zip Optional 5-digit ZIP code.
 * @param region Optional explicit region name.
 * @return Resolved region name, or null if unresolvable.
 */
export async function resolveRegion(zip?: string, region?: Region): Promise<Region | null> {
  if (region) {
    return region;
  }
  if (!zip) {
    return null;
  }

  for (const candidate of REGIONS) {
    if (await REGION_DATA[candidate].model.exists({ zipCode: zip })) {
      return candidate;
    }
  }

  // A ZIP outside every region would otherwise be compared against the wrong area's prices
  return null;
}

/**
 * Finds the average rent baseline for a space type in a region, checking ZIP first then county-wide.
 * If no ZIP or region-wide baseline matches, returns null.
 *
 * @param region The region to search.
 * @param spaceType The type of rental space.
 * @param zip Optional 5-digit ZIP code.
 * @return The matched baseline record with rent, source, and region, or null if not found.
 */
export async function findBaseline(
  region: Region,
  spaceType: SpaceType,
  zip?: string,
): Promise<BaselineMatch | null> {
  const { model, roomTypes: regionRoomTypes } = REGION_DATA[region];
  const roomTypes = regionRoomTypes[spaceType];
  if (roomTypes.length === 0) {
    return null;
  }

  if (zip) {
    const byZip = await model.find({ zipCode: zip, roomType: { $in: roomTypes } });
    if (byZip.length > 0) {
      return { rent: lowestPrice(byZip), source: 'zip', region };
    }
  }

  // Find Region-wide averages
  const regionWide = await model.find({
    zipCode: { $exists: false },
    roomType: { $in: roomTypes },
  });
  if (regionWide.length > 0) {
    return { rent: lowestPrice(regionWide), source: 'county', region };
  }

  return null;
}

/**
 * Compares listing rent against a baseline to determine if it is an outlier violation.
 *
 * @param input Validated price check input.
 * @param match Baseline match from the database, or null.
 * @return Evaluation result with status, percentage, and user explanation.
 */
export function evaluatePrice(
  input: PriceCheckInput,
  match: BaselineMatch | null,
): PriceCheckResult {
  const label = SPACE_TYPE_LABELS[input.spaceType];

  if (!match) {
    return {
      checker: 'price',
      status: 'not_evaluated',
      severity: null,
      rent: input.rent,
      baseline: null,
      baselineSource: null,
      region: null,
      percentOfBaseline: null,
      explanation: `No average rent is on file for a ${label} in this location, so the price was not checked.`,
    };
  }

  const percentOfBaseline = Math.round((input.rent / match.rent) * 1000) / 10;
  const place = match.source === 'zip' ? `ZIP ${input.zip}` : REGION_DATA[match.region].label;
  const comparison = `${formatUsd(input.rent)} is ${percentOfBaseline}% of the average ${formatUsd(match.rent)} for a ${label} in ${place}.`;

  if (input.rent < match.rent * BASE_LINE) {
    return {
      checker: 'price',
      status: 'violation',
      severity: 'critical',
      rent: input.rent,
      baseline: match.rent,
      baselineSource: match.source,
      region: match.region,
      percentOfBaseline,
      explanation: `${comparison} Rents here rarely fall below half the local average, so this price is suspicious.`,
    };
  }

  return {
    checker: 'price',
    status: 'pass',
    severity: null,
    rent: input.rent,
    baseline: match.rent,
    baselineSource: match.source,
    region: match.region,
    percentOfBaseline,
    explanation: `${comparison} This is within the normal range.`,
  };
}

/**
 * Runs the full price check: validates input, resolves region, retrieves baseline, and evaluates.
 *
 * @param rawInput Untrusted input payload to parse and validate.
 * @return Final price check evaluation result.
 */
export async function checkPrice(rawInput: unknown): Promise<PriceCheckResult> {
  const input = PriceCheckInputSchema.parse(rawInput);
  const region = await resolveRegion(input.zip, input.region);
  const match = region ? await findBaseline(region, input.spaceType, input.zip) : null;
  return evaluatePrice(input, match);
}
