import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from 'react';
import CarArrival from './CarArrival';
import ChevronIcon from './ChevronIcon';
import PageFadeIn from './PageFadeIn';
import type { CarArrivalInfo } from '../lib/carArrival';
import { prefersReducedMotion } from '../lib/motion';
import {
  EMPTY_FORM,
  listingFormSchema,
  validateListingForm,
  type FormErrors,
  type FormField,
  type FormValues,
  type TextField,
} from '../schemas/listing';
import {
  autofillListing as defaultAutofillListing,
  type AutofillListing,
} from '../services/autofillService';
import { BEDROOM_OPTIONS, PAYMENT_OPTIONS, type ListingInput } from '../types';
import '../styles/form.css';

interface ListingFormProps {
  onSubmit: (input: ListingInput) => void;
  submitting: boolean;
  submitError: string | null;
  /** Injectable for tests; defaults to the live autofill service. */
  autofillListing?: AutofillListing;
  /** Set when the visitor arrives through a car transition. */
  carArrival?: CarArrivalInfo | null;
}

/** Focus order for sequentially highlighting invalid form fields. */
const FIELD_ORDER: FormField[] = [
  'listingUrl',
  'rent',
  'bedrooms',
  'location',
  'landlord',
  'payment',
  'securityDeposit',
  'applicationFee',
  'contactPhone',
  'description',
  'photos',
];

/** Banner status text displayed while the scraper request is in flight. */
const AUTOFILL_READING = 'Reading listing details…';

/** Banner status text displayed when at least one field was extracted. */
const AUTOFILL_DONE = 'Details filled. Please review below.';

/** Banner status text displayed when no details could be extracted from the link. */
const AUTOFILL_EMPTY = "Couldn't read link. Please enter details below.";

/** Banner status text displayed when the scrape endpoint fails or times out. */
const AUTOFILL_SERVER_ERROR = 'Server error. Please try again.';

/**
 * Interactive rental listing form allowing student renters to input or autofill
 * property details, review extracted information, and submit the listing for scam checks.
 *
 * @param props Component properties configuring submission handlers and autofill service.
 * @returns Rendered JSX element representing the rental listing form.
 */
export default function ListingForm({
  onSubmit,
  submitting,
  submitError,
  autofillListing = defaultAutofillListing,
  carArrival = null,
}: ListingFormProps): ReactElement {
  const baseId = useId();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [autofilling, setAutofilling] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState<string | null>(null);
  const fieldRefs = useRef<Partial<Record<FormField, HTMLElement | null>>>({});
  const userTypedFields = useRef<Set<TextField>>(new Set());
  const autofilledFields = useRef<Set<TextField>>(new Set());

  const linkInputRef = useRef<HTMLInputElement>(null);
  const arrivingByCar = carArrival !== null;

  useEffect(() => {
    if (arrivingByCar) {
      linkInputRef.current?.focus();
    }
  }, [arrivingByCar]);

  /** Generates a stable unique HTML element ID scoped to this form instance. */
  const idFor = (field: FormField): string => `${baseId}-${field}`;

  /** Generates an accessible error element ID for a given form field. */
  const errorIdFor = (field: FormField): string => `${baseId}-${field}-error`;

  /**
   * Clears the current validation error for a specified form field.
   *
   * @param field The field to clear error state for.
   */
  function clearError(field: FormField): void {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  /**
   * Higher-order change event handler for text, select, and textarea fields.
   * Updates state, clears field error, and tracks manual user input vs. autofill provenance.
   *
   * @param field The text field being edited.
   * @returns Change event handler callback for the input element.
   */
  function handleChange(
    field: TextField,
  ): (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      clearError(field);
      if (field === 'listingUrl') {
        setAutofillMessage(null);
      } else {
        if (value.trim()) {
          userTypedFields.current.add(field);
        } else {
          userTypedFields.current.delete(field);
        }
        autofilledFields.current.delete(field);
      }
    };
  }

  /**
   * Change event handler for photo file attachments.
   *
   * @param event File input change event.
   */
  function handlePhotosChange(event: ChangeEvent<HTMLInputElement>): void {
    const photos = Array.from(event.target.files ?? []);
    setValues((current) => ({ ...current, photos }));
    clearError('photos');
  }

  /**
   * Triggers the listing autofill workflow by validating the listing link, invoking
   * the scrape service, and populating extracted details while preserving user-typed fields.
   */
  async function handleAutofill(): Promise<void> {
    if (submitting || autofilling) {
      return;
    }
    const trimmedUrl = values.listingUrl.trim();
    if (!trimmedUrl) {
      setErrors((current) => ({ ...current, listingUrl: 'Enter the listing link.' }));
      setAutofillMessage(null);
      fieldRefs.current.listingUrl?.focus();
      return;
    }
    const link = listingFormSchema.shape.listingUrl.safeParse(trimmedUrl);
    if (!link.success) {
      setErrors((current) => ({ ...current, listingUrl: link.error.issues[0].message }));
      setAutofillMessage(null);
      fieldRefs.current.listingUrl?.focus();
      return;
    }
    clearError('listingUrl');
    setAutofilling(true);
    setAutofillMessage(AUTOFILL_READING);
    try {
      const found = await autofillListing(link.data);
      const foundAnything = Boolean(found.rent || found.location || found.description);
      if (!foundAnything) {
        setAutofillMessage(AUTOFILL_EMPTY);
        return;
      }

      const isUserTypedRent = userTypedFields.current.has('rent');
      const isUserTypedLocation = userTypedFields.current.has('location');
      const isUserTypedDescription = userTypedFields.current.has('description');
      const wasAutofilledRent = autofilledFields.current.has('rent');
      const wasAutofilledLocation = autofilledFields.current.has('location');
      const wasAutofilledDescription = autofilledFields.current.has('description');

      setValues((current) => {
        const nextRent = isUserTypedRent
          ? current.rent
          : (found.rent ?? (wasAutofilledRent ? '' : current.rent));

        const nextLocation = isUserTypedLocation
          ? current.location
          : (found.location ?? (wasAutofilledLocation ? '' : current.location));

        const nextDescription = isUserTypedDescription
          ? current.description
          : (found.description ?? (wasAutofilledDescription ? '' : current.description));

        return {
          ...current,
          rent: nextRent,
          location: nextLocation,
          description: nextDescription,
        };
      });

      // Track newly autofilled fields only if populated by autofill
      if (!isUserTypedRent && found.rent) {
        autofilledFields.current.add('rent');
      } else if (!isUserTypedRent) {
        autofilledFields.current.delete('rent');
      }
      if (!isUserTypedLocation && found.location) {
        autofilledFields.current.add('location');
      } else if (!isUserTypedLocation) {
        autofilledFields.current.delete('location');
      }
      if (!isUserTypedDescription && found.description) {
        autofilledFields.current.add('description');
      } else if (!isUserTypedDescription) {
        autofilledFields.current.delete('description');
      }

      // Clear prior validation errors for successfully populated fields
      setErrors((current) => {
        const updated = { ...current };
        if (!isUserTypedRent && found.rent) {
          delete updated.rent;
        }
        if (!isUserTypedLocation && found.location) {
          delete updated.location;
        }
        if (!isUserTypedDescription && found.description) {
          delete updated.description;
        }
        return updated;
      });

      setAutofillMessage(AUTOFILL_DONE);
    } catch {
      setAutofillMessage(AUTOFILL_SERVER_ERROR);
    } finally {
      setAutofilling(false);
    }
  }

  /**
   * Handles form submission: validates all fields with Zod, sets error state or focuses
   * the first invalid field on failure, and dispatches validated data on success.
   *
   * @param event Form submission event.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (submitting || autofilling) {
      return;
    }
    const result = validateListingForm(values);
    if (result.success === false) {
      setErrors(result.errors);
      const firstInvalid = FIELD_ORDER.find((field) => result.errors[field]);
      if (firstInvalid) {
        fieldRefs.current[firstInvalid]?.focus();
      }
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }

  /** Resolves the accessibility error ID for aria-describedby if a field has an error. */
  const describedBy = (field: FormField): string | undefined =>
    errors[field] ? errorIdFor(field) : undefined;

  /** Renders the accessible inline error banner for a field if validation failed. */
  const fieldError = (field: FormField): ReactElement | null =>
    errors[field] ? (
      <p className="field__error" id={errorIdFor(field)} role="alert">
        {errors[field]}
      </p>
    ) : null;

  const reducedMotion = submitting && prefersReducedMotion();

  return (
    <form className="listing-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="listing-form__fieldset" disabled={submitting}>
        <div className="field">
          <label className="field__label" htmlFor={idFor('listingUrl')}>
            Listing link
          </label>
          <div className="field__inline">
            <input
              id={idFor('listingUrl')}
              ref={(element) => {
                fieldRefs.current.listingUrl = element;
                linkInputRef.current = element;
              }}
              className="input"
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              value={values.listingUrl}
              onChange={handleChange('listingUrl')}
              aria-invalid={errors.listingUrl ? true : undefined}
              aria-describedby={describedBy('listingUrl')}
            />
            <button
              type="button"
              className="button button--secondary"
              onClick={handleAutofill}
              disabled={autofilling}
            >
              {autofilling ? 'Reading…' : 'Autofill'}
            </button>
          </div>
          {fieldError('listingUrl')}
          <div className="field__hint">
            {!autofillMessage && (
              <p>
                Autofill can find the rent, address, and description. You can edit anything it fills
                in.
              </p>
            )}
            {/* Stays mounted but empty, so screen readers announce a message only when one appears. */}
            <div role="status">{autofillMessage}</div>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor={idFor('rent')}>
              Monthly rent
            </label>
            <input
              id={idFor('rent')}
              ref={(element) => {
                fieldRefs.current.rent = element;
              }}
              className="input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="$ 1,200"
              value={values.rent}
              onChange={handleChange('rent')}
              aria-invalid={errors.rent ? true : undefined}
              aria-describedby={describedBy('rent')}
            />
            {fieldError('rent')}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={idFor('bedrooms')}>
              Bedrooms
            </label>
            <div className="select">
              <select
                id={idFor('bedrooms')}
                ref={(element) => {
                  fieldRefs.current.bedrooms = element;
                }}
                className="input"
                value={values.bedrooms}
                onChange={handleChange('bedrooms')}
                aria-invalid={errors.bedrooms ? true : undefined}
                aria-describedby={describedBy('bedrooms')}
                data-empty={values.bedrooms === '' ? 'true' : undefined}
              >
                <option value="" disabled>
                  Select
                </option>
                {BEDROOM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
            {fieldError('bedrooms')}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={idFor('location')}>
            City or address
          </label>
          <input
            id={idFor('location')}
            ref={(element) => {
              fieldRefs.current.location = element;
            }}
            className="input"
            type="text"
            autoComplete="off"
            placeholder="e.g. Santa Cruz, CA"
            value={values.location}
            onChange={handleChange('location')}
            aria-invalid={errors.location ? true : undefined}
            aria-describedby={describedBy('location')}
          />
          {fieldError('location')}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={idFor('landlord')}>
            Landlord or agency name (optional)
          </label>
          <input
            id={idFor('landlord')}
            ref={(element) => {
              fieldRefs.current.landlord = element;
            }}
            className="input"
            type="text"
            autoComplete="off"
            placeholder="Name as shown in the listing"
            value={values.landlord}
            onChange={handleChange('landlord')}
            aria-invalid={errors.landlord ? true : undefined}
            aria-describedby={describedBy('landlord')}
          />
          {fieldError('landlord')}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={idFor('payment')}>
            How does the landlord ask for payment?
          </label>
          <div className="select">
            <select
              id={idFor('payment')}
              ref={(element) => {
                fieldRefs.current.payment = element;
              }}
              className="input"
              value={values.payment}
              onChange={handleChange('payment')}
              aria-invalid={errors.payment ? true : undefined}
              aria-describedby={describedBy('payment')}
              data-empty={values.payment === '' ? 'true' : undefined}
            >
              <option value="">Select an option</option>
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </div>
          {fieldError('payment')}
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor={idFor('securityDeposit')}>
              Security deposit (optional)
            </label>
            <input
              id={idFor('securityDeposit')}
              ref={(element) => {
                fieldRefs.current.securityDeposit = element;
              }}
              className="input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="$ 1,200"
              value={values.securityDeposit}
              onChange={handleChange('securityDeposit')}
              aria-invalid={errors.securityDeposit ? true : undefined}
              aria-describedby={describedBy('securityDeposit')}
            />
            {fieldError('securityDeposit')}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={idFor('applicationFee')}>
              Application fee (optional)
            </label>
            <input
              id={idFor('applicationFee')}
              ref={(element) => {
                fieldRefs.current.applicationFee = element;
              }}
              className="input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="$ 50"
              value={values.applicationFee}
              onChange={handleChange('applicationFee')}
              aria-invalid={errors.applicationFee ? true : undefined}
              aria-describedby={describedBy('applicationFee')}
            />
            {fieldError('applicationFee')}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={idFor('contactPhone')}>
            Contact phone number (optional)
          </label>
          <input
            id={idFor('contactPhone')}
            ref={(element) => {
              fieldRefs.current.contactPhone = element;
            }}
            className="input"
            type="tel"
            autoComplete="off"
            placeholder="The number in the listing"
            value={values.contactPhone}
            onChange={handleChange('contactPhone')}
            aria-invalid={errors.contactPhone ? true : undefined}
            aria-describedby={describedBy('contactPhone')}
          />
          {fieldError('contactPhone')}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={idFor('description')}>
            Description and messages (optional)
          </label>
          <textarea
            id={idFor('description')}
            ref={(element) => {
              fieldRefs.current.description = element;
            }}
            className="input input--multiline"
            rows={4}
            placeholder="Paste the listing description or messages from the landlord"
            value={values.description}
            onChange={handleChange('description')}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={describedBy('description')}
          />
          {fieldError('description')}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={idFor('photos')}>
            Photos (optional)
          </label>
          <input
            id={idFor('photos')}
            ref={(element) => {
              fieldRefs.current.photos = element;
            }}
            className="input input--file"
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotosChange}
            aria-invalid={errors.photos ? true : undefined}
            aria-describedby={describedBy('photos')}
          />
          {fieldError('photos')}
        </div>

        {submitError && (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          className="button button--primary button--block"
          disabled={autofilling}
        >
          {submitting ? 'Checking…' : 'Check listing'}
        </button>
      </fieldset>

      {submitting && (
        <div className="listing-form__overlay" role="status" aria-busy="true">
          <div className="listing-form__overlay-card">
            <svg
              className={
                reducedMotion
                  ? 'listing-form__gear'
                  : 'listing-form__gear listing-form__gear--spinning'
              }
              viewBox="0 0 24 24"
              width="36"
              height="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
            <p className="listing-form__overlay-title">Checking listing details…</p>
            <p className="listing-form__overlay-text">
              Running price, deposit, property, and scam-signal checks.
            </p>
          </div>
        </div>
      )}

      {carArrival &&
        (carArrival.from ? (
          <CarArrival from={carArrival.from} targetRef={linkInputRef} />
        ) : (
          <PageFadeIn />
        ))}
    </form>
  );
}
