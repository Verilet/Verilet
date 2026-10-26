import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import ChevronIcon from './ChevronIcon';
import {
  EMPTY_FORM,
  validateListingForm,
  type FormErrors,
  type FormField,
  type FormValues,
} from '../schemas/listing';
import { BEDROOM_OPTIONS, PAYMENT_OPTIONS, type ListingInput } from '../types';

interface ListingFormProps {
  onSubmit: (input: ListingInput) => void;
  submitting: boolean;
  submitError: string | null;
}

const FIELD_ORDER: FormField[] = [
  'listingUrl',
  'rent',
  'bedrooms',
  'location',
  'landlord',
  'payment',
];

export default function ListingForm({ onSubmit, submitting, submitError }: ListingFormProps) {
  const baseId = useId();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const idFor = (field: FormField) => `${baseId}-${field}`;
  const errorIdFor = (field: FormField) => `${baseId}-${field}-error`;

  function handleChange(field: FormField) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
      if (errors[field]) {
        setErrors((current) => ({ ...current, [field]: undefined }));
      }
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const result = validateListingForm(values);
    if (!result.success) {
      setErrors(result.errors);
      const firstInvalid = FIELD_ORDER.find((field) => result.errors[field]);
      if (firstInvalid) document.getElementById(idFor(firstInvalid))?.focus();
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
        <input
          id={idFor('listingUrl')}
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
        {fieldError('listingUrl')}
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor={idFor('rent')}>
            Monthly rent
          </label>
          <input
            id={idFor('rent')}
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

      {submitError && (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      )}

      <button type="submit" className="button button--primary button--block" disabled={submitting}>
        {submitting ? 'Checking…' : 'Check listing'}
      </button>
    </form>
  );
}
