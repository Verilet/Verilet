import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ListingForm from '../src/components/ListingForm';
import type { AutofillListing } from '../src/services/autofillService';

const LINK = 'https://example.com/listing/1';

function renderForm(autofillListing?: AutofillListing, onSubmit = vi.fn()) {
  render(
    <ListingForm
      onSubmit={onSubmit}
      submitting={false}
      submitError={null}
      autofillListing={autofillListing}
    />,
  );
  return { user: userEvent.setup(), onSubmit };
}

const autofillButton = () => screen.getByRole('button', { name: 'Autofill' });

describe('ListingForm autofill', () => {
  it('fills blank fields from the link and leaves them editable', async () => {
    const autofill = vi.fn<AutofillListing>().mockResolvedValue({
      rent: '1,200',
      location: 'Santa Cruz, CA',
      description: 'Sunny room',
    });
    const { user } = renderForm(autofill);

    await user.type(screen.getByLabelText('Listing link'), LINK);
    await user.click(autofillButton());

    expect(autofill).toHaveBeenCalledWith(LINK);
    expect(await screen.findByText(/We filled in what we could find/)).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly rent')).toHaveValue('1,200');
    expect(screen.getByLabelText('City or address')).toHaveValue('Santa Cruz, CA');
    expect(screen.getByLabelText('Description and messages (optional)')).toHaveValue('Sunny room');

    const rent = screen.getByLabelText('Monthly rent');
    await user.clear(rent);
    await user.type(rent, '1500');
    expect(rent).toHaveValue('1500');
  });

  it('does not overwrite what the student already typed', async () => {
    const { user } = renderForm(async () => ({ rent: '900', location: 'Somewhere else' }));

    await user.type(screen.getByLabelText('Listing link'), LINK);
    await user.type(screen.getByLabelText('Monthly rent'), '1500');
    await user.click(autofillButton());

    expect(await screen.findByLabelText('City or address')).toHaveValue('Somewhere else');
    expect(screen.getByLabelText('Monthly rent')).toHaveValue('1500');
  });

  it('checks the link before calling the service and focuses it when invalid', async () => {
    const autofill = vi.fn<AutofillListing>();
    const { user } = renderForm(autofill);

    await user.type(screen.getByLabelText('Listing link'), 'not a link');
    await user.click(autofillButton());

    expect(autofill).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a full link');
    expect(screen.getByLabelText('Listing link')).toHaveFocus();
  });

  it.each<[string, AutofillListing]>([
    ['finds nothing', async () => ({})],
    ['fails', () => Promise.reject(new Error('blocked'))],
  ])('asks the student to fill the details in when autofill %s', async (_name, autofill) => {
    const { user } = renderForm(autofill);

    await user.type(screen.getByLabelText('Listing link'), LINK);
    await user.click(autofillButton());

    expect(await screen.findByText(/couldn't read details from that link/)).toBeInTheDocument();
    expect(autofillButton()).toBeEnabled();
  });
});

describe('ListingForm optional details', () => {
  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Listing link'), LINK);
    await user.type(screen.getByLabelText('Monthly rent'), '1200');
    await user.selectOptions(screen.getByLabelText('Bedrooms'), '2');
    await user.type(screen.getByLabelText('City or address'), 'Santa Cruz, CA');
    await user.selectOptions(
      screen.getByLabelText('How does the landlord ask for payment?'),
      'check',
    );
  }

  it('submits the optional details with the listing', async () => {
    const { user, onSubmit } = renderForm();
    const photo = new File(['x'], 'room.png', { type: 'image/png' });
    await fillRequired(user);

    await user.type(screen.getByLabelText('Security deposit (optional)'), '1,500');
    await user.type(screen.getByLabelText('Application fee (optional)'), '50');
    await user.type(screen.getByLabelText('Contact phone number (optional)'), '831-555-0100');
    await user.type(screen.getByLabelText('Description and messages (optional)'), 'Sunny room');
    await user.upload(screen.getByLabelText('Photos (optional)'), photo);
    await user.click(screen.getByRole('button', { name: 'Check listing' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        securityDeposit: 1500,
        applicationFee: 50,
        contactPhone: '831-555-0100',
        description: 'Sunny room',
        photos: [photo],
      }),
    );
  });

  it('focuses the first invalid optional field through its ref', async () => {
    const { user, onSubmit } = renderForm();
    await fillRequired(user);

    await user.type(screen.getByLabelText('Application fee (optional)'), 'free');
    await user.click(screen.getByRole('button', { name: 'Check listing' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Application fee (optional)')).toHaveFocus();
  });

  it('keeps the optional fields empty by default', async () => {
    const { user, onSubmit } = renderForm();
    await fillRequired(user);

    await user.click(screen.getByRole('button', { name: 'Check listing' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        securityDeposit: null,
        applicationFee: null,
        contactPhone: '',
        description: '',
        photos: [],
      }),
    );
  });
});
