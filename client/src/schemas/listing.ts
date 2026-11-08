import { z } from 'zod';
import { BEDROOM_VALUES, PAYMENT_VALUES, type ListingInput } from '../types';

export type TextField =
  | 'listingUrl'
  | 'rent'
  | 'bedrooms'
  | 'location'
  | 'landlord'
  | 'payment'
  | 'securityDeposit'
  | 'applicationFee'
  | 'contactPhone'
  | 'description';
export type FormField = TextField | 'photos';
export type FormValues = Record<TextField, string> & { photos: File[] };
export type FormErrors = Partial<Record<FormField, string>>;

export const EMPTY_FORM: FormValues = {
  listingUrl: '',
  rent: '',
  bedrooms: '',
  location: '',
  landlord: '',
  payment: '',
  securityDeposit: '',
  applicationFee: '',
  contactPhone: '',
  description: '',
  photos: [],
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const MONEY_PATTERN = /^\$?\s*(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;
const PHONE_PATTERN = /^[+\d\s().-]+$/;
const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_PHOTOS = 10;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function parseMoney(value: string): number {
  return Number(value.replace(/[$,\s]/g, ''));
}

function isPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '').length;
  return PHONE_PATTERN.test(value) && digits >= 7 && digits <= 15;
}

/** An optional dollar amount: blank becomes null, and $0 is allowed. */
function optionalMoney(label: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === '' || MONEY_PATTERN.test(value),
      `Enter the ${label} as a number, like 500.`,
    )
    .transform((value) => (value === '' ? null : parseMoney(value)));
}

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
    .refine((value) => MONEY_PATTERN.test(value), 'Enter the rent as a number, like 1200.')
    .transform(parseMoney)
    .refine((value) => value > 0, 'Rent must be more than $0.'),
  bedrooms: z.enum(BEDROOM_VALUES, { error: 'Select the number of bedrooms.' }),
  location: z.string().trim().min(2, 'Enter a city or address.'),
  landlord: z.string().trim().max(120, 'Keep the name under 120 characters.'),
  payment: z.enum(PAYMENT_VALUES, { error: 'Select how the landlord asks for payment.' }),
  securityDeposit: optionalMoney('security deposit'),
  applicationFee: optionalMoney('application fee'),
  contactPhone: z
    .string()
    .trim()
    .refine((value) => value === '' || isPhoneNumber(value), 'Enter a valid phone number.'),
  description: z.string().trim().max(MAX_DESCRIPTION_LENGTH, 'Keep this under 5,000 characters.'),
  photos: z
    .array(z.instanceof(File))
    .max(MAX_PHOTOS, `Add up to ${MAX_PHOTOS} photos.`)
    .refine(
      (files) => files.every((file) => file.type.startsWith('image/')),
      'Photos must be image files.',
    )
    .refine(
      (files) => files.every((file) => file.size <= MAX_PHOTO_BYTES),
      'Each photo must be 10 MB or smaller.',
    ),
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
