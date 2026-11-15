import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { z } from 'zod';

/** Zod schema for listing property details. */
export const ScrapedListingDataSchema = z.object({
  /** Listing headline or property title. */
  title: z.string().nullable(),
  /** Monthly rent price in USD, or null if unlisted. */
  rent: z.number().nullable(),
  /** Formatted street and city address, or null. */
  address: z.string().nullable(),
  /** Listing description or summary. */
  description: z.string().nullable(),
  /** Array of resolved absolute photo URLs. */
  photos: z.array(z.string()),
});

/** Property details extracted from a listing page. */
export type ScrapedListingData = z.infer<typeof ScrapedListingDataSchema>;

/** Zod schema for scrape service response envelope. */
export const ScrapeResultSchema = z.object({
  /** Whether listing extraction succeeded. */
  success: z.boolean(),
  /** Scraped property details when successful, or null on error. */
  data: ScrapedListingDataSchema.nullable(),
  /** Error message on failure. */
  message: z.string().optional(),
});

/** JSON envelope returned by the scrape service. */
export type ScrapeResult = z.infer<typeof ScrapeResultSchema>;

/** Schema.org structured image entry. */
export interface SchemaOrgImage {
  url?: string;
  contentUrl?: string;
}

/** Input type for photo URL resolution candidate. */
export type PhotoInput = string | SchemaOrgImage | null | undefined;

/**
 * Resolves an image URL candidate against the page base URL.
 * Converts relative paths to absolute URLs.
 *
 * @param photo Image candidate string or SchemaOrgImage entry.
 * @param baseUrl The listing page URL used to resolve relative paths.
 * @returns Absolute URL string, or null if invalid.
 */
function resolvePhotoUrl(photo: PhotoInput, baseUrl: string): string | null {
  let rawUrl: string | null = null;

  if (typeof photo === 'string') {
    rawUrl = photo.trim();
  } else if (photo && typeof photo === 'object') {
    if (typeof photo.url === 'string') {
      rawUrl = photo.url.trim();
    } else if (typeof photo.contentUrl === 'string') {
      rawUrl = photo.contentUrl.trim();
    }
  }

  if (!rawUrl) return null;

  try {
    const resolved = new URL(rawUrl, baseUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether a URL belongs to Craigslist.
 *
 * @param url The listing URL string to inspect.
 * @returns True if the URL is a Craigslist domain.
 */
export function isCraigslistUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const lowerHost = hostname.toLowerCase();
    return lowerHost === 'craigslist.org' || lowerHost.endsWith('.craigslist.org');
  } catch {
    return false;
  }
}

/**
 * Cheerio extractor for Craigslist listing, populating data with rent, title, address, description, and photos.
 *
 * @param $ Loaded Cheerio API instance.
 * @param data Target ScrapedListingData to populate.
 * @param baseUrl The base listing URL to resolve photo paths.
 */
function extractCraigslistData($: CheerioAPI, data: ScrapedListingData, baseUrl: string): void {
  // Rent
  const rawPrice = $('.price, .postingtitletext .price, .price-tag').first().text().trim();
  if (rawPrice) {
    const cleaned = rawPrice.replace(/[^0-9.]/g, '');
    const parsedRent = Number(cleaned);
    if (!isNaN(parsedRent) && parsedRent > 0) {
      data.rent = parsedRent;
    }
  }

  // Title
  let titleText = $('#titletextonly').first().text().trim();
  if (!titleText) {
    const titleHeader = $('h1.postingtitle').first().clone();
    titleHeader.find('.price, .housing, small').remove();
    titleText = titleHeader.text().trim();
  }
  if (titleText) {
    data.title = titleText;
  }

  // Address
  let addrText = '';
  const mapAddressEl = $('.mapaddress').first();
  if (mapAddressEl.length > 0) {
    const clone = mapAddressEl.clone();
    clone.find('small, a').remove();
    addrText = clone.text().trim();
  }
  if (!addrText) {
    const smallText = $('.postingtitletext small, .postingtitle small').first().text().trim();
    if (smallText) {
      addrText = smallText.replace(/^\((.*)\)$/, '$1').trim();
    }
  }
  if (addrText.length > 0) {
    data.address = addrText;
  }

  // Description
  const postingBody = $('#postingbody').clone();
  postingBody.find('.print-qrcode-container, .print-information, .qrcode').remove();
  postingBody.find('br').replaceWith('\n');
  let desc = postingBody.text().trim();
  desc = desc.replace(/QR Code Link to This Post/gi, '').trim();
  if (desc) {
    data.description = desc;
  }

  // Photos
  const photoUrls = new Set<string>();
  $('#thumbs a[href], #thumbs img[src]').each((_, el) => {
    // Avoid extracting low-resolution thumbnails when an enclosing anchor provides the high-res image
    if ($(el).is('img') && $(el).closest('a[href]').length > 0) {
      return;
    }
    const raw = $(el).attr('href') || $(el).attr('src');
    if (raw) {
      const resolved = resolvePhotoUrl(raw, baseUrl);
      if (resolved) {
        photoUrls.add(resolved);
      }
    }
  });
  if (photoUrls.size > 0) {
    data.photos = Array.from(photoUrls);
  }
}

/**
 * Extracts property details from Schema.org JSON-LD scripts.
 * Populates only fields in `data` that are currently null or empty.
 *
 * @param $ Loaded Cheerio API instance.
 * @param data Target ScrapedListingData to populate.
 * @param baseUrl The base listing URL to resolve photo paths.
 */
function extractJsonLdData($: CheerioAPI, data: ScrapedListingData, baseUrl: string): void {
  const jsonLdScripts = $('script[type="application/ld+json"]');
  jsonLdScripts.each((_, element) => {
    try {
      // Parse and normalize JSON-LD payload
      const parsed = JSON.parse($(element).text());
      const items = Array.isArray(parsed)
        ? parsed
        : parsed['@graph'] && Array.isArray(parsed['@graph'])
          ? parsed['@graph']
          : [parsed];

      // Iterate over each item in the JSON-LD script to extract property details
      for (const json of items) {
        if (!json || typeof json !== 'object') continue;

        if (!data.title && (json.name || json.headline)) {
          data.title = json.name || json.headline;
        }

        if (!data.description && json.description) {
          data.description = json.description;
        }

        if (!data.address && json.address) {
          if (typeof json.address === 'string') {
            data.address = json.address;
          } else {
            const street = json.address.streetAddress;
            const locality = json.address.addressLocality;
            const region = json.address.addressRegion;
            data.address = [street, locality, region].filter(Boolean).join(', ');
          }
        }

        const rawPrice = json.offers?.price ?? json.price;
        if (!data.rent && rawPrice) {
          const parsedRent = Number(rawPrice);
          if (!isNaN(parsedRent) && parsedRent > 0) {
            data.rent = parsedRent;
          }
        }

        if (data.photos.length === 0 && json.image) {
          const rawList: (string | SchemaOrgImage)[] = Array.isArray(json.image)
            ? (json.image as (string | SchemaOrgImage)[])
            : [json.image as string | SchemaOrgImage];
          const resolved = rawList
            .map((img: string | SchemaOrgImage) => resolvePhotoUrl(img, baseUrl))
            .filter((img: string | null): img is string => img !== null);
          if (resolved.length > 0) {
            data.photos = resolved;
          }
        }
      }
    } catch {
      // Ignore unparseable JSON-LD scripts
    }
  });
}

/**
 * Extracts property details from OpenGraph and standard HTML meta tags.
 * Populates only fields in `data` that are currently null or empty.
 *
 * @param $ Loaded Cheerio API instance.
 * @param data Target ScrapedListingData to populate.
 * @param baseUrl Base listing URL to resolve photo paths.
 */
function extractOpenGraphData($: CheerioAPI, data: ScrapedListingData, baseUrl: string): void {
  if (!data.title) {
    data.title = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || null;
  }

  if (!data.description) {
    data.description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      null;
  }

  if (data.photos.length === 0) {
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const resolvedOg = resolvePhotoUrl(ogImage, baseUrl);
      if (resolvedOg) {
        data.photos.push(resolvedOg);
      }
    }
  }
}

/**
 * Checks if all required listing fields have been populated with non-empty values.
 *
 * @param data Target ScrapedListingData to evaluate.
 * @returns True if all fields are non-null and photos array is non-empty.
 */
function isCompleteListing(data: ScrapedListingData): boolean {
  return (
    Boolean(data.title) &&
    Boolean(data.rent) &&
    Boolean(data.address) &&
    Boolean(data.description) &&
    data.photos.length > 0
  );
}

/**
 * Scrapes listing metadata from a target URL.
 * Attempts extraction from Craigslist, then falls back to Schema.org JSON-LD scripts and OpenGraph meta tags.
 * Enforces a 5000ms timeout and handles network or parsing failures.
 *
 * @param url The listing URL to scrape.
 * @returns Promise resolving to a ScrapeResult envelope.
 */
export async function scrapeListing(url: string): Promise<ScrapeResult> {
  try {
    // Fetch the listing url with a timeout and browser headers
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    // Check if response is ok, if not return failed to scrape message
    if (!response.ok) {
      return {
        success: false,
        data: null,
        message: 'Failed to scrape listing details',
      };
    }

    // Guard against non-HTML responses
    const contentType = response.headers?.get?.('content-type');
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml+xml')
    ) {
      return {
        success: false,
        data: null,
        message: 'Failed to scrape listing details',
      };
    }

    // Load html into cheerio
    const html = await response.text();
    const $ = cheerio.load(html);

    // Data storage
    const data: ScrapedListingData = {
      title: null,
      rent: null,
      address: null,
      description: null,
      photos: [],
    };

    // Craigslist Cheerio extractor if URL matches Craigslist domain
    if (isCraigslistUrl(url)) {
      extractCraigslistData($, data, url);

      // Return if all fields are already satisfied
      if (isCompleteListing(data)) {
        return { success: true, data };
      }
    }

    // Schema.org JSON-LD Fallback
    extractJsonLdData($, data, url);

    // Return if all fields are populated after JSON-LD
    if (isCompleteListing(data)) {
      return { success: true, data };
    }

    // OpenGraph Meta Tags Fallback
    extractOpenGraphData($, data, url);

    return { success: true, data };
  } catch {
    return {
      success: false,
      data: null,
      message: 'Failed to scrape listing details',
    };
  }
}
