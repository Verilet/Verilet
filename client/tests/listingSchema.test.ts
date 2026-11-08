import { describe, expect, it } from 'vitest';
import {
  EMPTY_FORM,
  MAX_PHOTOS,
  validateListingForm,
  type FormValues,
} from '../src/schemas/listing';

const valid: FormValues = {
  listingUrl: ' https://example.com/rooms/42 ',
  rent: '$1,200',
  bedrooms: 'studio',
  location: ' Santa Cruz, CA ',
  landlord: '',
  payment: 'check',
  securityDeposit: '',
  applicationFee: '',
  contactPhone: '',
  description: '',
  photos: [],
};

describe('validateListingForm', () => {
  it('trims and converts valid input', () => {
    const result = validateListingForm(valid);
    expect(result).toEqual({
      success: true,
      data: {
        listingUrl: 'https://example.com/rooms/42',
        rent: 1200,
        bedrooms: 'studio',
        location: 'Santa Cruz, CA',
        landlord: '',
        payment: 'check',
        securityDeposit: null,
        applicationFee: null,
        contactPhone: '',
        description: '',
        photos: [],
      },
    });
  });

  it('reports an error for each empty required field and allows an empty landlord', () => {
    const result = validateListingForm(EMPTY_FORM);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(Object.keys(result.errors).sort()).toEqual([
      'bedrooms',
      'listingUrl',
      'location',
      'payment',
      'rent',
    ]);
  });

  it.each(['ftp://example.com', 'example.com', 'javascript:alert(1)', 'not a url'])(
    'rejects the link %s',
    (link) => {
      const result = validateListingForm({ ...valid, listingUrl: link });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.listingUrl).toBeDefined();
    },
  );

  it.each(['abc', '0', '-5', '12,34', '1.234'])('rejects the rent %s', (rent) => {
    const result = validateListingForm({ ...valid, rent });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.rent).toBeDefined();
  });

  it.each([
    ['1200', 1200],
    ['1,200', 1200],
    ['$ 1,200.50', 1200.5],
  ])('accepts the rent %s', (rent, expected) => {
    const result = validateListingForm({ ...valid, rent });
    expect(result.success && result.data.rent).toBe(expected);
  });

  it('converts the optional money fields and allows $0', () => {
    const result = validateListingForm({
      ...valid,
      securityDeposit: '$1,500',
      applicationFee: '0',
    });
    expect(result.success && result.data.securityDeposit).toBe(1500);
    expect(result.success && result.data.applicationFee).toBe(0);
  });

  it.each([
    ['securityDeposit', 'abc'],
    ['applicationFee', '-5'],
    ['contactPhone', '123'],
    ['contactPhone', 'call me'],
    ['description', 'x'.repeat(5001)],
  ] as const)('rejects %s set to %s', (field, value) => {
    const result = validateListingForm({ ...valid, [field]: value });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[field]).toBeDefined();
  });

  it('accepts a formatted phone number', () => {
    const result = validateListingForm({ ...valid, contactPhone: ' (831) 555-0100 ' });
    expect(result.success && result.data.contactPhone).toBe('(831) 555-0100');
  });

  it('accepts image photos and rejects other files, too many, or too large', () => {
    const image = new File(['x'], 'room.png', { type: 'image/png' });
    const accepted = validateListingForm({ ...valid, photos: [image] });
    expect(accepted.success && accepted.data.photos).toEqual([image]);

    const large = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(large, 'size', { value: 11 * 1024 * 1024 });
    const rejected = [
      [new File(['x'], 'notes.pdf', { type: 'application/pdf' })],
      Array.from({ length: MAX_PHOTOS + 1 }, () => image),
      [large],
    ];
    for (const photos of rejected) {
      const result = validateListingForm({ ...valid, photos });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.errors.photos).toBeDefined();
    }
  });

  it('rejects unknown bedroom and payment options', () => {
    const result = validateListingForm({ ...valid, bedrooms: '9', payment: 'barter' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.bedrooms).toBeDefined();
      expect(result.errors.payment).toBeDefined();
    }
  });
});
