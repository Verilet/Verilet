import { describe, expect, it } from 'vitest';
import { EMPTY_FORM, validateListingForm, type FormValues } from '../src/schemas/listing';

const valid: FormValues = {
  listingUrl: ' https://example.com/rooms/42 ',
  rent: '$1,200',
  bedrooms: 'studio',
  location: ' Santa Cruz, CA ',
  landlord: '',
  payment: 'check',
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

  it('rejects unknown bedroom and payment options', () => {
    const result = validateListingForm({ ...valid, bedrooms: '9', payment: 'barter' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.bedrooms).toBeDefined();
      expect(result.errors.payment).toBeDefined();
    }
  });
});
