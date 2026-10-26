import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import type { CheckListing } from '../src/services/scanService';
import { scoreListing } from '../src/services/scanService';
import type { ListingInput, ScanResult } from '../src/types';

const validInput: ListingInput = {
  listingUrl: 'https://example.com/listing/1',
  rent: 1200,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: '',
  payment: 'gift-card',
};

const fakeCheck: CheckListing = async (input) => ({
  ...input,
  ...scoreListing(input),
  id: 'scan-new',
  createdAt: new Date().toISOString(),
});

function seedScan(id: string, score: number, location: string): ScanResult {
  return {
    ...validInput,
    ...scoreListing(validInput),
    id,
    score,
    location,
    createdAt: new Date().toISOString(),
  };
}

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

describe('logged-out flow', () => {
  it('shows the check page with its headline and form', () => {
    render(<App loggedIn={false} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Check a rental listing before you pay' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check listing' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'My scans' })).not.toBeInTheDocument();
  });

  it('shows errors and does not check the listing when the form is invalid', async () => {
    const user = userEvent.setup();
    const check = vi.fn(fakeCheck);
    render(<App loggedIn={false} checkListing={check} />);

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
    render(<App loggedIn={false} checkListing={check} />);

    await fillAndSubmit(user);

    expect(
      await screen.findByRole('heading', { level: 1, name: /scam signals/i }),
    ).toBeInTheDocument();
    expect(check).toHaveBeenCalledWith(validInput);
    expect(screen.getByText('2 bed · $1,200 / month · Santa Cruz, CA')).toBeInTheDocument();
    expect(screen.getByText('HIGH RISK')).toBeInTheDocument();

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
    render(<App loggedIn={false} checkListing={fakeCheck} />);
    await fillAndSubmit(user);
    await screen.findByRole('heading', { level: 1, name: /scam signals/i });

    await user.click(screen.getByRole('button', { name: 'Check another listing' }));
    expect(screen.getByLabelText('Listing link')).toHaveValue('');
  });

  it('shows an error and keeps the form values when the check fails', async () => {
    const user = userEvent.setup();
    const failing: CheckListing = () => Promise.reject(new Error('boom'));
    render(<App loggedIn={false} checkListing={failing} />);

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't check that listing");
    expect(screen.getByLabelText('Listing link')).toHaveValue('https://example.com/listing/1');
    expect(screen.getByRole('button', { name: 'Check listing' })).toBeEnabled();
  });
});

describe('logged-in flow', () => {
  const scans = [
    seedScan('a', 82, 'Santa Cruz, CA'),
    seedScan('b', 18, 'Santa Clara, CA'),
    seedScan('c', 54, 'San Jose, CA'),
  ];

  it('shows the welcome page with recent scans', () => {
    render(<App loggedIn initialScans={scans} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: 'Recent scans' });
    expect(within(recent).getAllByRole('listitem')).toHaveLength(3);
    expect(within(recent).getByText('HIGH RISK')).toBeInTheDocument();
  });

  it('shows an empty state when there are no scans', () => {
    render(<App loggedIn initialScans={[]} />);
    expect(screen.getByText(/No scans yet/)).toBeInTheDocument();
  });

  it('filters My scans by rating', async () => {
    const user = userEvent.setup();
    render(<App loggedIn initialScans={scans} />);

    await user.click(screen.getByRole('button', { name: 'My scans' }));
    expect(screen.getByRole('heading', { level: 1, name: 'My scans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All (3)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('row')).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: 'High risk' }));
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[1]).getByText('82')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Medium risk' }));
    expect(within(screen.getAllByRole('row')[1]).getByText('54')).toBeInTheDocument();
  });

  it('opens a saved scan with details expanded and a share button', async () => {
    const user = userEvent.setup();
    render(<App loggedIn initialScans={scans} />);

    await user.click(screen.getByRole('button', { name: 'My scans' }));
    await user.click(within(screen.getAllByRole('row')[1]).getByRole('button', { name: 'View' }));

    expect(await screen.findByRole('button', { name: 'Hide details' })).toBeInTheDocument();
    expect(screen.getByText('Saved to My scans')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share result' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← My scans' }));
    expect(screen.getByRole('heading', { level: 1, name: 'My scans' })).toBeInTheDocument();
  });

  it('adds a newly checked listing to My scans', async () => {
    const user = userEvent.setup();
    render(<App loggedIn initialScans={[]} checkListing={fakeCheck} />);

    await fillAndSubmit(user);
    await screen.findByText('Saved to My scans');
    await user.click(screen.getByRole('button', { name: '← My scans' }));
    expect(screen.getByRole('button', { name: 'All (1)' })).toBeInTheDocument();
  });
});
