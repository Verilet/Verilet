import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import type { CheckListing } from '../src/services/scanService';
import { scoreListing } from '../src/services/scanService';
import type { ListingInput } from '../src/types';

const validInput: ListingInput = {
  listingUrl: 'https://example.com/listing/1',
  rent: 1200,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: '',
  payment: 'gift-card',
  securityDeposit: null,
  applicationFee: null,
  contactPhone: '',
  description: '',
  photos: [],
};

const fakeCheck: CheckListing = async (input) => ({
  ...input,
  ...scoreListing(input),
  id: 'scan-new',
  createdAt: new Date().toISOString(),
});

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Listing link'), 'https://example.com/listing/1');
  await user.type(screen.getByLabelText('Monthly rent'), '1,200');
  await user.selectOptions(screen.getByLabelText('Bedrooms'), '2');
  await user.type(screen.getByLabelText('City or address'), 'Santa Cruz, CA');
  await user.selectOptions(
    screen.getByLabelText('How does the landlord ask for payment?'),
    'gift-card',
  );
  await user.click(screen.getByRole('button', { name: 'Check listing' }));
}

/** Renders the app at `/check` (the form page for both logged-out and logged-in users). */
function renderApp(ui: ReactElement, path = '/check') {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe('page refresh', () => {
  it('reopens a checked listing from the same browser tab after a refresh', async () => {
    const user = userEvent.setup();
    const first = renderApp(<App checkListing={fakeCheck} />);
    await fillAndSubmit(user);
    await screen.findByRole('button', { name: 'More details' });
    first.unmount();

    renderApp(<App checkListing={fakeCheck} />, '/results/scan-new');

    expect(screen.getByRole('button', { name: 'More details' })).toBeInTheDocument();
    expect(screen.queryByText("We couldn't find that scan")).not.toBeInTheDocument();
  });

  it('ignores saved scans it cannot read', () => {
    sessionStorage.setItem('verilet:scans', '{not json');
    renderApp(<App />, '/results/scan-new');
    expect(screen.getByRole('heading', { name: "We couldn't find that scan" })).toBeInTheDocument();
  });
});

describe('logged-out flow', () => {
  it('shows the check page with its headline and form', () => {
    renderApp(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Check a rental listing before you pay' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check listing' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My scans' })).not.toBeInTheDocument();
  });

  it('shows errors and does not check the listing when the form is invalid', async () => {
    const user = userEvent.setup();
    const check = vi.fn(fakeCheck);
    renderApp(<App checkListing={check} />);

    await user.type(screen.getByLabelText('Listing link'), 'not a link');
    await user.click(screen.getByRole('button', { name: 'Check listing' }));

    expect(
      screen.getByText('Enter a full link that starts with http:// or https://.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Enter the monthly rent.')).toBeInTheDocument();
    expect(screen.getByText('Select the number of bedrooms.')).toBeInTheDocument();
    expect(screen.getByText('Select how the landlord asks for payment.')).toBeInTheDocument();
    expect(screen.getByLabelText('Listing link')).toHaveFocus();
    expect(check).not.toHaveBeenCalled();
  });

  it('checks a valid listing, shows the result, and toggles details', async () => {
    const user = userEvent.setup();
    const check = vi.fn(fakeCheck);
    renderApp(<App checkListing={check} />);

    await fillAndSubmit(user);

    expect(
      await screen.findByRole('heading', { level: 1, name: /scam signals/i }),
    ).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith(validInput);
    expect(screen.getByText('2 bed · $1,200 / month · Santa Cruz, CA')).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'This listing shows several scam signals' }),
      ).getByText('HIGH RISK'),
    ).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'More details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('What we checked')).not.toBeVisible();

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide details' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('What we checked')).toBeVisible();
    expect(screen.getByText('Landlord asks for payment by gift card')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Share result' })).not.toBeInTheDocument();
  });

  it('returns to a blank form from the results page', async () => {
    const user = userEvent.setup();
    renderApp(<App checkListing={fakeCheck} />);
    await fillAndSubmit(user);
    await screen.findByRole('heading', { level: 1, name: /scam signals/i });

    await user.click(screen.getByRole('button', { name: 'Check another listing' }));
    expect(screen.getByLabelText('Listing link')).toHaveValue('');
  });

  it('shows an error and keeps the form values when the check fails', async () => {
    const user = userEvent.setup();
    const failing: CheckListing = () => Promise.reject(new Error('boom'));
    renderApp(<App checkListing={failing} />);

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't check that listing");
    expect(screen.getByLabelText('Listing link')).toHaveValue('https://example.com/listing/1');
    expect(screen.getByRole('button', { name: 'Check listing' })).toBeEnabled();
  });
});
