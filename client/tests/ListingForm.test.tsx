import '@testing-library/jest-dom/vitest';
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
  it('only puts text in the status region when there is a message', async () => {
    const { user } = renderForm(async () => ({ rent: '1,200' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(screen.getByText(/Autofill can find the rent/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Listing link'), LINK);
    await user.click(autofillButton());

    expect(await screen.findByRole('status')).toHaveTextContent(/Details filled/);
    expect(screen.queryByText(/Autofill can find the rent/)).not.toBeInTheDocument();
  });

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
    expect(await screen.findByText(/Details filled/)).toBeInTheDocument();
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

  it('asks the student to fill details in when autofill finds nothing', async () => {
    const { user } = renderForm(async () => ({}));

    await user.type(screen.getByLabelText('Listing link'), LINK);
    await user.click(autofillButton());

    expect(
      await screen.findByText(/Couldn't read link\. Please enter details below\./i),
    ).toBeInTheDocument();
    expect(autofillButton()).toBeEnabled();
  });

  it('shows a server error message when autofill fails', async () => {
    const { user } = renderForm(() => Promise.reject(new Error('blocked')));

    await user.type(screen.getByLabelText('Listing link'), LINK);
    await user.click(autofillButton());

    expect(await screen.findByText(/Server error\. Please try again\./i)).toBeInTheDocument();
    expect(autofillButton()).toBeEnabled();
  });

  it('cleanly replaces previous autofilled values when doing another listing scan', async () => {
    const mockAutofill = vi
      .fn<AutofillListing>()
      .mockResolvedValueOnce({
        rent: '1,200',
        location: 'Santa Cruz, CA',
        description: 'First studio',
      })
      .mockResolvedValueOnce({
        rent: '2,400',
        location: 'Capitola, CA',
        description: 'Second apartment',
      });

    const { user } = renderForm(mockAutofill);

    // First scan
    await user.type(screen.getByLabelText('Listing link'), LINK);
    await user.click(autofillButton());

    expect(await screen.findByText(/Details filled/)).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly rent')).toHaveValue('1,200');
    expect(screen.getByLabelText('City or address')).toHaveValue('Santa Cruz, CA');
    expect(screen.getByLabelText('Description and messages (optional)')).toHaveValue(
      'First studio',
    );

    // User edits link to do another listing
    const linkInput = screen.getByLabelText('Listing link');
    await user.clear(linkInput);
    await user.type(linkInput, 'https://example.com/listing/2');

    // Message cleared when editing link
    expect(screen.queryByText(/Details filled/)).not.toBeInTheDocument();
    expect(screen.getByText(/Autofill can find the rent/)).toBeInTheDocument();

    // Second scan
    await user.click(autofillButton());

    expect(await screen.findByText(/Details filled/)).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly rent')).toHaveValue('2,400');
    expect(screen.getByLabelText('City or address')).toHaveValue('Capitola, CA');
    expect(screen.getByLabelText('Description and messages (optional)')).toHaveValue(
      'Second apartment',
    );
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
