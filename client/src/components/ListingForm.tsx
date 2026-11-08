import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import CarArrival from './CarArrival';
import ChevronIcon from './ChevronIcon';
import PageFadeIn from './PageFadeIn';
import type { CarArrivalInfo } from '../lib/carArrival';
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

interface ListingFormProps {
  onSubmit: (input: ListingInput) => void;
  submitting: boolean;
  submitError: string | null;
  /** Injectable for tests; defaults to the placeholder autofill service. */
  autofillListing?: AutofillListing;
  /** Set when the visitor arrives through a car transition. */
  carArrival?: CarArrivalInfo | null;
}

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

const AUTOFILL_DONE = 'We filled in what we could find. Check it and add anything missing.';
const AUTOFILL_EMPTY = "We couldn't read details from that link. Please fill them in below.";

export default function ListingForm({
  onSubmit,
  submitting,
  submitError,
  autofillListing = defaultAutofillListing,
  carArrival = null,
}: ListingFormProps) {
  const baseId = useId();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [autofilling, setAutofilling] = useState(false);
  const [autofillMessage, setAutofillMessage] = useState<string | null>(null);
  const fieldRefs = useRef<Partial<Record<FormField, HTMLElement | null>>>({});

  const linkInputRef = useRef<HTMLInputElement>(null);
  const arrivingByCar = carArrival !== null;

  useEffect(() => {
    if (arrivingByCar) linkInputRef.current?.focus();
  }, [arrivingByCar]);

  const idFor = (field: FormField) => `${baseId}-${field}`;
  const errorIdFor = (field: FormField) => `${baseId}-${field}-error`;

  function clearError(field: FormField) {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function handleChange(field: TextField) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      clearError(field);
    };
  }

  function handlePhotosChange(event: ChangeEvent<HTMLInputElement>) {
    const photos = Array.from(event.target.files ?? []);
    setValues((current) => ({ ...current, photos }));
    clearError('photos');
  }

  /** Fills only the blank fields, so nothing the student already typed is overwritten. */
  async function handleAutofill() {
    if (autofilling) return;
    const link = listingFormSchema.shape.listingUrl.safeParse(values.listingUrl);
    if (!link.success) {
      setErrors((current) => ({ ...current, listingUrl: link.error.issues[0].message }));
      setAutofillMessage(null);
      fieldRefs.current.listingUrl?.focus();
      return;
    }
    setAutofilling(true);
    setAutofillMessage(null);
    try {
      const found = await autofillListing(link.data);
      setValues((current) => ({
        ...current,
        rent: current.rent || (found.rent ?? ''),
        location: current.location || (found.location ?? ''),
        description: current.description || (found.description ?? ''),
      }));
      const foundAnything = Boolean(found.rent || found.location || found.description);
      setAutofillMessage(foundAnything ? AUTOFILL_DONE : AUTOFILL_EMPTY);
    } catch {
      setAutofillMessage(AUTOFILL_EMPTY);
    } finally {
      setAutofilling(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const result = validateListingForm(values);
    if (!result.success) {
      setErrors(result.errors);
      const firstInvalid = FIELD_ORDER.find((field) => result.errors[field]);
      if (firstInvalid) fieldRefs.current[firstInvalid]?.focus();
      return;
    }
    setErrors({});
    onSubmit(result.data);
  }

  const describedBy = (field: FormField) => (errors[field] ? errorIdFor(field) : undefined);

  const fieldError = (field: FormField) =>
    errors[field] ? (
      <p className="field__error" id={errorIdFor(field)} role="alert">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form className="listing-form" onSubmit={handleSubmit} noValidate>
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
        <p className="field__hint" role="status">
          {autofillMessage ??
            'Autofill can find the rent, address, and description. You can edit anything it fills in.'}
        </p>
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
            <option value="" disabled>
              Select an option
            </option>
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

      <button type="submit" className="button button--primary button--block" disabled={submitting}>
        {submitting ? 'Checking…' : 'Check listing'}
      </button>
      {carArrival &&
        (carArrival.from ? (
          <CarArrival from={carArrival.from} targetRef={linkInputRef} />
        ) : (
          <PageFadeIn />
        ))}
    </form>
  );
}
