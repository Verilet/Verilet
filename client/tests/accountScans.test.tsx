import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { AuthContext, type AuthState } from '../src/auth/authState';
import { ApiError, apiRequest } from '../src/services/apiClient';
import { createScansApi } from '../src/services/scansApi';
import { z } from 'zod';

// The header shows Clerk's account button for a signed-in student, which needs Clerk's provider.
vi.mock('@clerk/react', () => ({
  UserButton: () => <button type="button">Account</button>,
}));

const SIGNED_IN: AuthState = {
  configured: true,
  isLoaded: true,
  isSignedIn: true,
  getToken: async () => 'token_123',
};

/** A scan as the server sends it. */
function serverScan(id: string, location: string) {
  return {
    id,
    createdAt: '2026-11-01T10:00:00.000Z',
    listingUrl: 'https://example.com/listing/1',
    rent: 1200,
    bedrooms: '2',
    location,
    landlord: '',
    payment: 'gift-card',
    securityDeposit: null,
    applicationFee: null,
    contactPhone: '',
    description: '',
    photoCount: 0,
    score: 90,
    checks: [
      {
        id: 'payment',
        title: 'Payment method',
        detail: 'Landlord asks for payment by gift card',
        status: 'FLAG',
      },
    ],
  };
}

const ok = (data: unknown, status = 200) => Response.json({ success: true, data }, { status });
const fail = (error: string, status: number) =>
  Response.json({ success: false, error }, { status });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSignedIn(path = '/', auth: AuthState = SIGNED_IN) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        <App loggedIn={false} />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const requestAt = (index: number) => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

describe('signed-in scans', () => {
  it('loads saved scans from the server with the session token', async () => {
    fetchMock.mockResolvedValueOnce(ok([serverScan('s1', 'Santa Cruz, CA')]));
    renderSignedIn();

    const recent = within(await screen.findByRole('region', { name: 'Recent scans' }));
    expect(await recent.findByText(/Santa Cruz/)).toBeInTheDocument();
    const { url, init, headers } = requestAt(0);
    expect(url).toMatch(/\/api\/scans$/);
    expect(init.method).toBe('GET');
    expect(headers.Authorization).toBe('Bearer token_123');
  });

  it('shows loading, then an error if the scans cannot be loaded', async () => {
    let reject: (reason: unknown) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise((_resolve, fail) => (reject = fail)));
    renderSignedIn();

    const recent = within(screen.getByRole('region', { name: 'Recent scans' }));
    expect(recent.getByRole('status')).toHaveTextContent('Loading your scans');
    reject(new TypeError('network down'));
    expect(await recent.findByRole('alert')).toHaveTextContent("We couldn't load your scans");
  });

  it('saves a new check on the server and opens its result', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok(serverScan('new1', 'Santa Cruz, CA'), 201));
    renderSignedIn('/check');
    await screen.findByText(/No scans yet/);

    await user.type(screen.getByLabelText('Listing link'), 'https://example.com/listing/1');
    await user.type(screen.getByLabelText('Monthly rent'), '1,200');
    await user.selectOptions(screen.getByLabelText('Bedrooms'), '2');
    await user.type(screen.getByLabelText('City or address'), 'Santa Cruz, CA');
    await user.selectOptions(
      screen.getByLabelText('How does the landlord ask for payment?'),
      'gift-card',
    );
    await user.upload(
      screen.getByLabelText('Photos (optional)'),
      new File(['x'], 'room.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: 'Check listing' }));

    expect(await screen.findByText('Saved to My scans')).toBeInTheDocument();
    const { url, init, headers } = requestAt(1);
    expect(url).toMatch(/\/api\/scans$/);
    expect(init.method).toBe('POST');
    expect(headers.Authorization).toBe('Bearer token_123');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ rent: 1200, payment: 'gift-card', photoCount: 1 });
    expect(body).not.toHaveProperty('photos');
  });

  it('opens a result that is not in the loaded list by asking the server', async () => {
    fetchMock
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok(serverScan('older', 'Santa Clara, CA')));
    renderSignedIn('/results/older');

    expect(await screen.findByText(/Santa Clara, CA/)).toBeInTheDocument();
    expect(requestAt(1).url).toMatch(/\/api\/scans\/older$/);
  });

  it("shows not found for a scan the server doesn't have", async () => {
    fetchMock.mockResolvedValueOnce(ok([])).mockResolvedValueOnce(fail('Not found', 404));
    renderSignedIn('/results/missing');

    expect(
      await screen.findByRole('heading', { name: "We couldn't find that scan" }),
    ).toBeInTheDocument();
  });

  it('waits for Clerk before deciding where a visitor goes', () => {
    renderSignedIn('/check', { ...SIGNED_IN, isLoaded: false, isSignedIn: false });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('apiRequest', () => {
  const schema = z.object({ value: z.number() });

  it('returns the parsed data of a success envelope', async () => {
    fetchMock.mockResolvedValueOnce(ok({ value: 3 }));
    await expect(apiRequest('/api/x', { schema })).resolves.toEqual({ value: 3 });
  });

  it("throws the server's message from an error envelope", async () => {
    fetchMock.mockResolvedValueOnce(fail('Log in to continue.', 401));
    await expect(apiRequest('/api/x', { schema })).rejects.toMatchObject({
      message: 'Log in to continue.',
      status: 401,
    });
  });

  it('rejects a response in the wrong shape', async () => {
    fetchMock.mockResolvedValueOnce(ok({ value: 'three' }));
    await expect(apiRequest('/api/x', { schema })).rejects.toBeInstanceOf(ApiError);
  });

  it('reports an unreachable server', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiRequest('/api/x', { schema })).rejects.toMatchObject({ status: 0 });
  });
});

describe('createScansApi', () => {
  it('refuses to call the server without a session token', async () => {
    const api = createScansApi(async () => null);
    await expect(api.list()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
