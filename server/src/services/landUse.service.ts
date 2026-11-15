import { z } from 'zod';

/** Schema for valid land-use input. */
export const LandUseInputSchema = z.object({
  /** Assessor land-use code. */
  useCode: z.string().nullish(),
  /** Assessor land-use description. */
  useDescription: z.string().nullish(),
});

/** Automatically derives the input type from the schema. */
export type LandUseInput = z.infer<typeof LandUseInputSchema>;

/** Classification status returned by the land-use service. */
export type LandUseStatus = 'compliant' | 'violation' | 'warning' | 'skipped';

/** Land-use classification categories. */
export type LandUseCategory = 'residential' | 'commercial' | 'vacant';

/** Flags returned for non-residential or vacant properties. */
export type LandUseFlag = 'NON_RESIDENTIAL_LAND_USE' | 'VACANT_OR_UNBUILT_PARCEL';

/** Land-use classification result details. */
export interface LandUseData {
  readonly status: LandUseStatus;
  readonly flag: LandUseFlag | null;
  readonly message: string;
  readonly category: LandUseCategory | null;
}

/** Result envelope returned by the land-use service. */
export type LandUseResult =
  | {
      readonly success: true;
      readonly data: LandUseData;
    }
  | {
      readonly success: false;
      readonly error: string;
    };

/** Known assessor land-use codes and their categories. */
const LAND_USE_CODES: Record<string, LandUseCategory> = {
  // Residential
  '020': 'residential',
  '021': 'residential',
  '030': 'residential',
  '041': 'residential',

  // Commercial / non-residential
  '121': 'commercial',
  '171': 'commercial',
  '921': 'commercial',

  // Vacant / unbuilt
  '010': 'vacant',
  '830': 'vacant',
  '090': 'vacant',
};

/** Result returned when land-use information is missing. */
const SKIPPED_RESULT: LandUseResult = Object.freeze({
  success: true,
  data: Object.freeze({
    status: 'skipped',
    flag: null,
    message: 'Land use code not specified; check skipped',
    category: null,
  }),
});

/**
 * Determines a category from a land-use description.
 *
 * @param description Assessor land-use description.
 * @return Matching category, or null if it cannot be identified.
 */
function classifyDescription(description: string): LandUseCategory | null {
  const normalizedDescription = description.trim().toLowerCase();
  if (
    /\b(single residence|single family|condo(?:minium)?|duplex|multi[- ]?units?|residential|apartment)\b/.test(
      normalizedDescription,
    )
  ) {
    return 'residential';
  }
  if (
    /\b(store|stores|office|offices|commercial|municipal|county building|industrial)\b/.test(
      normalizedDescription,
    )
  ) {
    return 'commercial';
  }
  if (/\b(vacant|token value|common area|unbuilt)\b/.test(normalizedDescription)) {
    return 'vacant';
  }
  return null;
}

/**
 * Create the result for a recognized land-use category.
 *
 * @param category Identified land-use category.
 * @return Classification result.
 */
function createClassificationResult(category: LandUseCategory): LandUseResult {
  if (category === 'residential') {
    return {
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Complies with lawful residential land use',
        category: 'residential',
      },
    };
  }
  if (category === 'commercial') {
    return {
      success: true,
      data: {
        status: 'violation',
        flag: 'NON_RESIDENTIAL_LAND_USE',
        message: 'Property is designated for commercial or municipal use, not residential living',
        category: 'commercial',
      },
    };
  }
  return {
    success: true,
    data: {
      status: 'warning',
      flag: 'VACANT_OR_UNBUILT_PARCEL',
      message: 'Property is classified as vacant land or unbuilt parcel',
      category: 'vacant',
    },
  };
}

/**
 * Evaluates assessor land-use information.
 *
 * @param input Land-use code and description to evaluate.
 * @return Land-use classification result.
 */
export function evaluateLandUse(input?: unknown): LandUseResult {
  // Handle omitted or null input
  if (input == null) {
    return SKIPPED_RESULT;
  }
  // Validate input
  const validation = LandUseInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Invalid land use input values',
    };
  }
  const { useCode, useDescription } = validation.data;
  // Both fields are required for classification
  if (
    useCode == null ||
    useDescription == null ||
    useCode.trim() === '' ||
    useDescription.trim() === ''
  ) {
    return SKIPPED_RESULT;
  }
  // Prefer the assessor code when recognized
  const normalizedCode = useCode.trim();
  const codeCategory = LAND_USE_CODES[normalizedCode];
  if (codeCategory) {
    return createClassificationResult(codeCategory);
  }
  // Fall back to description of unrecognized codes
  const descriptionCategory = classifyDescription(useDescription);
  if (descriptionCategory) {
    return createClassificationResult(descriptionCategory);
  }
  // Unknown codes and descriptions cannot be classified
  return SKIPPED_RESULT;
}
