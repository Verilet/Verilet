import { z } from 'zod';

/** Schema for a valid input. */
export const GisQueryInputSchema = z.object({
  /** Accepts a string or null or undefined. */
  address: z.string().nullish(),
});

/** Automatically derives the TypeScript input type from GisQueryInputSchema. */
export type GisQueryInput = z.infer<typeof GisQueryInputSchema>;

/** Result classification returned by the GIS service. */
export type GisStatus = 'compliant' | 'warning' | 'skipped';

/** GIS-related warning flags. */
export type GisFlag = 'UNVERIFIED_ADDRESS' | 'GIS_SERVICE_UNAVAILABLE';

/** Santa Cruz County assessor parcel MapServer endpoint. */
const GIS_QUERY_URL =
  'https://sccgis.santacruzcountyca.gov/server/rest/services/data/MapServer/2/query';

/** Parcel information returned from county GIS records.*/
export interface GisParcel {
  /** Assessor parcel number. */
  readonly apn: string;
  /** Standardized property address. */
  readonly siteAddress: string;
  /** Parcel city. */
  readonly city: string;
  /** Parcel zip. */
  readonly zip: string;
  /** Assessor use code. */
  readonly useCode: string;
  /** Assessor use description. */
  readonly useDescription: string;
}

/** GIS verification result details. */
export interface GisQueryData {
  /** Compliance status. */
  readonly status: GisStatus;
  /** Warning flag. */
  readonly flag: GisFlag | null;
  /** Readable explanation of result. */
  readonly message: string;
  /** Parcel details if match is found. */
  readonly parcel: GisParcel | null;
}

/** ArcGIS parcel attributes returned by Santa Cruz County. */
interface GisFeatureAttributes {
  APN?: string;
  SITEADD?: string;
  CITY?: string;
  ZIP?: string;
  USECODE?: string;
  USECDDESC?: string;
}
/** Individual ArcGIS feature record. */
interface GisFeature {
  attributes?: GisFeatureAttributes;
}
/** ArcGIS query response payload. */
interface GisApiResponse {
  features?: GisFeature[];
  error?: unknown;
}

/** JSON envelope returned by the GIS query service. */
export type GisQueryResult =
  | {
      readonly success: true;
      readonly data: GisQueryData;
    }
  | {
      readonly success: false;
      readonly error: string;
    };

/**
 * Removes apartment, suite, unit, and/or similar designators so
 * parcel matching is performed on base address.
 *
 * @param address Address to normalize.
 * @return Address without unit designators.
 */
function stripUnitDesignator(address: string): string {
  return address.replace(/,?\s+(APT\.?|APARTMENT|UNIT|STE\.?|SUITE)\s+\S+.*$/i, '').trim();
}

/**
 * Removes hash-style unit identifiers
 * "123 High St #42" becomes "123 High St".
 *
 * @param address Address to normalize.
 * @return Address without hash-style unit identifiers.
 */
function stripHashUnit(address: string): string {
  return address.replace(/,?\s+#\s*\S+.*$/i, '').trim();
}

/**
 * Builds the ArcGIS query URL for a normalized address.
 *
 * @param normalizedAddress Normalized address to query.
 * @return Fully constructed ArcGIS query URL.
 */
function buildQueryUrl(normalizedAddress: string): string {
  const escapedAddress = normalizedAddress.replace(/'/g, "''");
  const params = new URLSearchParams({
    where: `SITEADD LIKE '%${escapedAddress}%'`,
    outFields: 'APN,SITEADD,CITY,ZIP,USECODE,USECDDESC',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${GIS_QUERY_URL}?${params.toString()}`;
}

/**
 * Normalizes address for GIS parcel lookup
 * "123 High St #42" becomes "123 HIGH ST"
 * "123 High St Apt 3B" becomes "123 HIGH ST"
 * "123   High      St " becomes "123 HIGH ST".
 *
 * @param address Address to normalize.
 * @return Uppercase normalized parcel-searchable address.
 */
export function normalizeAddress(address: string): string {
  return stripHashUnit(stripUnitDesignator(address))
    .trim()
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Return when an address is missing and GIS check cannot be done. */
const SKIPPED_RESULT: GisQueryResult = Object.freeze({
  success: true,
  data: Object.freeze({
    status: 'skipped',
    flag: null,
    message: 'Address not specified; check skipped',
    parcel: null,
  }),
});

/**
 * Evaluates a listing address against Santa Cruz county GIS records.
 *
 * @param input Address information to evaluate.
 * @return GIS verification results.
 */
export async function evaluateGisQuery(input?: GisQueryInput | null): Promise<GisQueryResult> {
  // Handle omitted, null, or undefined input
  if (input == null) {
    return SKIPPED_RESULT;
  }
  // Validate input shape
  const validation = GisQueryInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Invalid address input value',
    };
  }
  const { address } = validation.data;
  // Handle empty, null, or whitespace address
  if (address == null || address.trim() === '') {
    return SKIPPED_RESULT;
  }
  const normalizedAddress = normalizeAddress(address);
  const queryUrl = buildQueryUrl(normalizedAddress);
  try {
    const response = await fetch(queryUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return {
        success: true,
        data: {
          status: 'skipped',
          flag: 'GIS_SERVICE_UNAVAILABLE',
          message: 'County GIS service timed out or unavailable; check skipped',
          parcel: null,
        },
      };
    }
    const result = (await response.json()) as GisApiResponse;
    if (result.error || !result.features) {
      return {
        success: true,
        data: {
          status: 'skipped',
          flag: 'GIS_SERVICE_UNAVAILABLE',
          message: 'County GIS service timed out or unavailable; check skipped',
          parcel: null,
        },
      };
    }
    const feature = result.features[0];
    if (!feature?.attributes) {
      return {
        success: true,
        data: {
          status: 'warning',
          flag: 'UNVERIFIED_ADDRESS',
          message: 'Address could not be verified in Santa Cruz County records',
          parcel: null,
        },
      };
    }
    const attrs = feature.attributes;
    return {
      success: true,
      data: {
        status: 'compliant',
        flag: null,
        message: 'Address verified in county parcel records',
        parcel: {
          apn: attrs.APN ?? '',
          siteAddress: attrs.SITEADD ?? '',
          city: attrs.CITY ?? '',
          zip: attrs.ZIP ?? '',
          useCode: attrs.USECODE ?? '',
          useDescription: attrs.USECDDESC ?? '',
        },
      },
    };
  } catch {
    return {
      success: true,
      data: {
        status: 'skipped',
        flag: 'GIS_SERVICE_UNAVAILABLE',
        message: 'County GIS service timed out or unavailable; check skipped',
        parcel: null,
      },
    };
  }
}
