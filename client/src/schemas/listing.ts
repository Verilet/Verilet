import { z } from 'zod';
import {
  BEDROOM_OPTIONS,
  PAYMENT_OPTIONS,
  type Bedrooms,
  type ListingInput,
  type PaymentMethod,
} from '../types';

export type FormField = 'listingUrl' | 'rent' | 'bedrooms' | 'location' | 'landlord' | 'payment';
export type FormValues = Record<FormField, string>;
export type FormErrors = Partial<Record<FormField, string>>;

export const EMPTY_FORM: FormValues = {
  listingUrl: '',
  rent: '',
  bedrooms: '',
  location: '',
  landlord: '',
  payment: '',
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const RENT_PATTERN = /^\$?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;
const bedroomValues: readonly string[] = BEDROOM_OPTIONS.map((option) => option.value);
const paymentValues: readonly string[] = PAYMENT_OPTIONS.map((option) => option.value);

export const listingFormSchema = z.object({
  listingUrl: z
    .string()
    .trim()
    .min(1, 'Enter the listing link.')
    .refine(isHttpUrl, 'Enter a full link that starts with http:// or https://.'),
  rent: z
    .string()
    .trim()
    .min(1, 'Enter the monthly rent.')
    .refine((value) => RENT_PATTERN.test(value), 'Enter the rent as a number, like 1200.')
    .transform((value) => Number(value.replace(/[$,\s]/g, '')))
    .refine((value) => value > 0, 'Rent must be more than $0.'),
  bedrooms: z
    .string()
    .refine((value) => bedroomValues.includes(value), 'Select the number of bedrooms.')
    .transform((value) => value as Bedrooms),
  location: z.string().trim().min(2, 'Enter a city or address.'),
  landlord: z.string().trim().max(120, 'Keep the name under 120 characters.'),
  payment: z
    .string()
    .refine((value) => paymentValues.includes(value), 'Select how the landlord asks for payment.')
    .transform((value) => value as PaymentMethod),
});

export type ValidationResult =
  { success: true; data: ListingInput } | { success: false; errors: FormErrors };

export function validateListingForm(values: FormValues): ValidationResult {
  const parsed = listingFormSchema.safeParse(values);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  const errors: FormErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as FormField | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { success: false, errors };
}
