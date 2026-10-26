import { scoreListing } from '../services/scanService';
import type { ListingInput, ScanResult } from '../types';

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function seed(id: string, days: number, score: number, input: ListingInput): ScanResult {
  return { ...input, ...scoreListing(input), score, id, createdAt: daysAgo(days) };
}

/** Sample history for the logged-in views until scans are loaded from the API. */
export const MOCK_SCANS: ScanResult[] = [
  seed('seed-1', 0, 82, {
    listingUrl: 'https://www.craigslist.org/santa-cruz/apa/1',
    rent: 1200,
    bedrooms: '2',
    location: 'Santa Cruz, CA',
    landlord: '',
    payment: 'gift-card',
  }),
  seed('seed-2', 1, 18, {
    listingUrl: 'https://www.zillow.com/homedetails/2',
    rent: 1650,
    bedrooms: 'studio',
    location: 'Santa Clara, CA',
    landlord: 'Bay Area Property Group',
    payment: 'rental-platform',
  }),
  seed('seed-3', 11, 54, {
    listingUrl: 'https://www.apartments.com/3',
    rent: 2900,
    bedrooms: '3',
    location: 'San Jose, CA',
    landlord: '',
    payment: 'zelle-venmo',
  }),
  seed('seed-4', 14, 22, {
    listingUrl: 'https://www.zillow.com/homedetails/4',
    rent: 1400,
    bedrooms: '1',
    location: 'Sunnyvale, CA',
    landlord: 'J. Alvarez',
    payment: 'bank-transfer',
  }),
  seed('seed-5', 17, 91, {
    listingUrl: 'https://www.craigslist.org/santa-cruz/roo/5',
    rent: 800,
    bedrooms: 'room',
    location: 'Santa Cruz, CA',
    landlord: '',
    payment: 'wire',
  }),
  seed('seed-6', 19, 15, {
    listingUrl: 'https://www.apartments.com/6',
    rent: 2200,
    bedrooms: '2',
    location: 'Mountain View, CA',
    landlord: 'Castro Properties',
    payment: 'rental-platform',
  }),
];
