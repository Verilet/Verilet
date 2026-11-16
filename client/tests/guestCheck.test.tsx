import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { AuthContext, type AuthState } from '../src/auth/authState';
import { GUIDE } from '../src/content/guide';

vi.mock('@clerk/react', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });

const scored = {
  score: 90,
  checks: [
    {
      id: 'rent',
      title: 'Rent vs. area price',
      detail: 'Rent is much lower than typical for this area',
      status: 'FLAG',
    },
    {
      id: 'payment',
      title: 'Payment method',
      detail: 'Landlord asks for payment by gift card',
      status: 'FLAG',
    },
    {
      id: 'landlord',
      title: 'Landlord check',
      detail: 'No landlord name was given',
      status: 'UNKNOWN',
    },
    {
      id: 'details',
      title: 'Listing details',
      detail: 'No description or photos were added',
      status: 'UNKNOWN',
    },
  ],
};

const listing = {
  listingUrl: 'https://example.com/listing/1',
  rent: 700,
  bedrooms: '2',
  location: 'Santa Cruz, CA',
  landlord: '',
  payment: 'gift-card',
  securityDeposit: null,
  applicationFee: null,
  contactPhone: '',
  description: '',
  photoCount: 0,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string, auth?: AuthState) {
  const app = <App loggedIn={false} />;
  return render(
    <MemoryRouter initialEntries={[path]}>
      {auth ? <AuthContext.Provider value={auth}>{app}</AuthContext.Provider> : app}
    </MemoryRouter>,
  );
}

async function checkAsGuest(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Listing link'), listing.listingUrl);
  await user.type(screen.getByLabelText('Monthly rent'), '700');
  await user.selectOptions(screen.getByLabelText('Bedrooms'), '2');
  await user.type(screen.getByLabelText('City or address'), listing.location);
  await user.selectOptions(
    screen.getByLabelText('How does the landlord ask for payment?'),
    'gift-card',
  );
  await user.click(screen.getByRole('button', { name: 'Check listing' }));
}

describe('guest check', () => {
  it('shows the form without an account', () => {
    renderAt('/check');
    expect(
      screen.getByRole('heading', { level: 1, name: GUIDE.guest.formTitle }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Listing link')).toBeInTheDocument();
  });

  it('scores the listing without a token and shows the short result', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(ok(scored));
    renderAt('/check');

    await checkAsGuest(user);

    expect(
      await screen.findByRole('heading', { level: 1, name: /scam signals/i }),
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/check$/);
    expect(init.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init.body as string)).toMatchObject({ rent: 700, photoCount: 0 });
  });

  it('always shows every red flag, and keeps the rest for signed-in students', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(ok(scored));
    renderAt('/check');
    await checkAsGuest(user);

    const flags = within(await screen.findByRole('list'));
    expect(flags.getByText('Rent is much lower than typical for this area')).toBeInTheDocument();
    expect(flags.getByText('Landlord asks for payment by gift card')).toBeInTheDocument();
    expect(screen.queryByText('No landlord name was given')).not.toBeInTheDocument();
    const prompt = within(screen.getByRole('region', { name: GUIDE.guest.ctaTitle }));
    expect(prompt.getByRole('link', { name: GUIDE.auth.logInLabel })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(prompt.getByRole('link', { name: GUIDE.guest.signUpLabel })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });

  it('says so when no check raised a red flag', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      ok({ score: 15, checks: scored.checks.map((check) => ({ ...check, status: 'OK' })) }),
    );
    renderAt('/check');
    await checkAsGuest(user);

    expect(await screen.findByText(GUIDE.guest.noFlags)).toBeInTheDocument();
  });

  it('shows an error on the form when the check fails', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(
      Response.json({ success: false, error: 'Too many checks' }, { status: 429 }),
    );
    renderAt('/check');
    await checkAsGuest(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't check that listing");
    expect(screen.getByLabelText('Listing link')).toHaveValue(listing.listingUrl);
  });

  it('starts over from the result page', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(ok(scored));
    renderAt('/check');
    await checkAsGuest(user);
    await screen.findByRole('heading', { level: 1, name: /scam signals/i });

    await user.click(screen.getByRole('button', { name: 'Check another listing' }));

    expect(screen.getByLabelText('Listing link')).toHaveValue('');
    expect(sessionStorage.getItem('verilet:guestCheck')).toBeNull();
  });

  it('sends a visit to the result page with no check back to the form', () => {
    renderAt('/check/result');
    expect(screen.getByLabelText('Listing link')).toBeInTheDocument();
  });
});

describe('signing in after a guest check', () => {
  const signedIn: AuthState = {
    configured: true,
    isLoaded: true,
    isSignedIn: true,
    getToken: async () => 'token_123',
  };

  it('saves the check to the new account and opens it in full', async () => {
    sessionStorage.setItem('verilet:guestCheck', JSON.stringify({ listing, ...scored }));
    fetchMock.mockResolvedValueOnce(ok([])).mockResolvedValueOnce(
      ok(
        {
          ...listing,
          ...scored,
          id: 'saved1',
          createdAt: '2026-11-09T10:00:00.000Z',
        },
        201,
      ),
    );

    renderAt('/check', signedIn);

    expect(await screen.findByText('Saved to My scans')).toBeInTheDocument();
    expect(screen.getByText('No landlord name was given')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toMatch(/\/api\/scans$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(listing);
    expect(sessionStorage.getItem('verilet:guestCheck')).toBeNull();
  });

  it('keeps the check and explains if saving fails', async () => {
    sessionStorage.setItem('verilet:guestCheck', JSON.stringify({ listing, ...scored }));
    fetchMock
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(Response.json({ success: false, error: 'down' }, { status: 500 }));

    renderAt('/check', signedIn);

    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't save your earlier check");
    expect(sessionStorage.getItem('verilet:guestCheck')).not.toBeNull();
  });
});
