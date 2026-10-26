import * as cheerio from 'cheerio';

/** Standardized property details extracted from a listing page. */
export interface ScrapedListingData {
  /** Listing headline or property title. */
  title: string | null;
  /** Monthly rent price in USD, or null if unlisted. */
  rent: number | null;
  /** Formatted street and city address, or null. */
  address: string | null;
  /** Listing description or summary. */
  description: string | null;
  /** Array of resolved absolute photo URLs. */
  photos: string[];
}

/** Standardized JSON envelope returned by the scrape service. */
export interface ScrapeResult {
  /** Whether listing extraction succeeded. */
  success: boolean;
  /** Scraped property details when successful, or null on error. */
  data: ScrapedListingData | null;
  /** Error message on failure. */
  message?: string;
}

/**
 * Resolves an image URL candidate against the page base URL.
 * Converts relative paths to absolute URLs.
 *
 * @param photo - Image candidate string or Schema.org ImageObject
 * @param baseUrl - The listing page URL used to resolve relative paths
 * @returns Absolute URL string, or null if invalid
 */
function resolvePhotoUrl(photo: unknown, baseUrl: string): string | null {
  let rawUrl: string | null = null;

  // If string, trim and set rawUrl
  if (typeof photo === 'string') {
    rawUrl = photo.trim();
  }

  // If object, check for url or contentUrl
  else if (photo && typeof photo === 'object') {
    const obj = photo as Record<string, unknown>;
    if (typeof obj.url === 'string') {
      rawUrl = obj.url.trim();
    } else if (typeof obj.contentUrl === 'string') {
      rawUrl = obj.contentUrl.trim();
    }
  }

  // If no rawUrl, return null
  if (!rawUrl) return null;

  // If rawUrl is not an absolute URL, convert it to an absolute URL
  try {
    return new URL(rawUrl, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Scrapes listing metadata from a target URL.
 * Attempts extraction from Schema.org JSON-LD scripts first, then falls back to OpenGraph meta tags.
 * Enforces a 5000ms timeout and handles network or parsing failures.
 *
 * @param url - The fully qualified HTTP/HTTPS listing URL to scrape.
 * @returns Promise resolving to a {@link ScrapeResult} envelope.
 */
export async function scrapeListing(url: string): Promise<ScrapeResult> {
  try {
    // Fetch the listing url with a 5000ms timeout and browser headers
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

    // Find JSON-LD scripts
    const jsonLdScripts = $('script[type="application/ld+json"]');

    // Data storage
    const data: ScrapedListingData = {
      title: null,
      rent: null,
      address: null,
      description: null,
      photos: [],
    };

    // Extract from Schema.org JSON-LD
    jsonLdScripts.each((_, element) => {
      try {
        const parsed = JSON.parse($(element).text());
        const items = Array.isArray(parsed)
          ? parsed
          : parsed['@graph'] && Array.isArray(parsed['@graph'])
            ? parsed['@graph']
            : [parsed];

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
            if (!isNaN(parsedRent)) {
              data.rent = parsedRent;
            }
          }

          if (data.photos.length === 0 && json.image) {
            const rawList: unknown[] = Array.isArray(json.image) ? json.image : [json.image];
            const resolved = rawList
              .map((img: unknown) => resolvePhotoUrl(img, url))
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

    // OpenGraph Meta Tags Fallback
    if (!data.title) {
      data.title = $('meta[property="og:title"]').attr('content') || $('title').text() || null;
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
        const resolvedOg = resolvePhotoUrl(ogImage, url);
        if (resolvedOg) {
          data.photos.push(resolvedOg);
        }
      }
    }

    return { success: true, data };
  } catch {
    return {
      success: false,
      data: null,
      message: 'Failed to scrape listing details',
    };
  }
}
