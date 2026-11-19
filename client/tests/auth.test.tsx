import { act, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import AuthProvider from '../src/auth/AuthProvider';
import {
  redirectAfterSignIn,
  signInPathFor,
  useAuthState,
  type AuthState,
} from '../src/auth/authState';
import { GUIDE } from '../src/content/guide';

/** The props the mocked Clerk forms record, so tests can check what the app passed. */
interface ClerkFormProps {
  path?: string;
  signUpUrl?: string;
  signInUrl?: string;
  fallbackRedirectUrl?: string;
}

const clerk = vi.hoisted(() => ({
  session: { isLoaded: true, isSignedIn: false, getToken: async () => 'token_123' },
  providerProps: {} as Record<string, unknown>,
}));

vi.mock('@clerk/react', () => ({
  ClerkProvider: ({ children, ...props }: { children: ReactNode }) => {
    clerk.providerProps = props;
    return children;
  },
  useAuth: () => clerk.session,
  SignIn: (props: ClerkFormProps) => (
    <div
      data-testid="clerk-sign-in"
      data-path={props.path}
      data-sign-up-url={props.signUpUrl}
      data-redirect={props.fallbackRedirectUrl}
    />
  ),
  SignUp: (props: ClerkFormProps) => (
    <div
      data-testid="clerk-sign-up"
      data-path={props.path}
      data-sign-in-url={props.signInUrl}
      data-redirect={props.fallbackRedirectUrl}
    />
  ),
  UserButton: () => <button type="button">Account</button>,
}));

const KEY = 'pk_test_example';

/**
 * Renders the app inside the sign-in provider at a page.
 *
 * @param path Page to open.
 * @param publishableKey Clerk key; an empty string turns sign-in off.
 * @returns The render result.
 */
function renderAt(path: string, publishableKey: string | undefined = KEY) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider publishableKey={publishableKey}>
        <App loggedIn={false} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clerk.session = { isLoaded: true, isSignedIn: false, getToken: async () => 'token_123' };
  clerk.providerProps = {};
});

describe('log in page', () => {
  it('shows the heading and the Clerk sign-in form', async () => {
    renderAt('/login');
    const form = await screen.findByTestId('clerk-sign-in');
    expect(
      screen.getByRole('heading', { level: 1, name: GUIDE.auth.signIn.title }),
    ).toBeInTheDocument();
    expect(form).toHaveAttribute('data-path', '/login');
    expect(form).toHaveAttribute('data-sign-up-url', '/sign-up');
    expect(form).toHaveAttribute('data-redirect', '/check');
    for (const point of GUIDE.auth.points) {
      expect(screen.getByText(point)).toBeInTheDocument();
    }
  });

  it('keeps Clerk steps like code entry on the same page', async () => {
    renderAt('/login/factor-one');
    expect(await screen.findByTestId('clerk-sign-in')).toBeInTheDocument();
  });

  it('has a matching sign up page that says an account is optional', async () => {
    renderAt('/sign-up');
    const form = await screen.findByTestId('clerk-sign-up');
    expect(
      screen.getByRole('heading', { level: 1, name: GUIDE.auth.signUp.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(GUIDE.auth.signUp.text)).toBeInTheDocument();
    expect(GUIDE.auth.signUp.text).not.toMatch(/need an account/i);
    expect(form).toHaveAttribute('data-path', '/sign-up');
    expect(form).toHaveAttribute('data-sign-in-url', '/login');
    expect(form).toHaveAttribute('data-redirect', '/check');
  });

  it('says sign-in is unavailable when no key is set', async () => {
    renderAt('/login', '');
    expect(await screen.findByRole('status')).toHaveTextContent(GUIDE.auth.unavailableTitle);
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });

  it('shows neither the form nor a redirect until Clerk has loaded the session', async () => {
    clerk.session = { ...clerk.session, isLoaded: false };
    renderAt('/login');
    expect(await screen.findByRole('status')).toHaveTextContent('Loading');
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });

  it('sends a signed-in visitor on to the check form', async () => {
    clerk.session = { ...clerk.session, isSignedIn: true };
    renderAt('/login');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Welcome back' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
  });
});

describe('header', () => {
  it('links to log in with the current page to come back to', async () => {
    renderAt('/how-it-works');
    expect(await screen.findByRole('link', { name: GUIDE.auth.logInLabel })).toHaveAttribute(
      'href',
      '/login?redirect_url=%2Fhow-it-works',
    );
  });

  it('hides the log in link on the log in and sign up pages', async () => {
    renderAt('/login');
    await screen.findByTestId('clerk-sign-in');
    expect(screen.queryByRole('link', { name: GUIDE.auth.logInLabel })).not.toBeInTheDocument();
  });

  it('shows the account menu and signed-in links for a Clerk session', async () => {
    clerk.session = { ...clerk.session, isSignedIn: true };
    renderAt('/');
    expect(await screen.findByRole('button', { name: 'Account' })).toBeInTheDocument();
    const site = within(screen.getByRole('navigation', { name: 'Site' }));
    expect(site.getByRole('link', { name: 'My scans' })).toBeInTheDocument();
    expect(site.getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '/how-it-works',
    );
    expect(screen.queryByRole('link', { name: GUIDE.auth.logInLabel })).not.toBeInTheDocument();
  });

  it('marks only the link to the exact current page with aria-current', async () => {
    clerk.session = { ...clerk.session, isSignedIn: true };
    renderAt('/scans');
    const site = within(await screen.findByRole('navigation', { name: 'Site' }));
    await screen.findByRole('heading', { level: 1, name: 'My scans' });
    expect(site.getByRole('link', { name: 'My scans' })).toHaveAttribute('aria-current', 'page');
    expect(site.getByRole('link', { name: 'Check a listing' })).not.toHaveAttribute('aria-current');
    expect(site.getByRole('link', { name: 'How it works' })).not.toHaveAttribute('aria-current');
  });

  it('does not mark My scans as the current page on a result', async () => {
    clerk.session = { ...clerk.session, isSignedIn: true };
    renderAt('/results/missing');
    const site = within(await screen.findByRole('navigation', { name: 'Site' }));
    expect(site.getByRole('link', { name: 'My scans' })).not.toHaveAttribute('aria-current');
  });

  it('still links to log in when sign-in is not set up', async () => {
    renderAt('/', '');
    expect(await screen.findByRole('link', { name: GUIDE.auth.logInLabel })).toBeInTheDocument();
  });
});

describe('while sign-in is loading', () => {
  it('shows a loading message on the home page instead of the landing page', async () => {
    clerk.session = { ...clerk.session, isLoaded: false };
    renderAt('/');
    expect(await screen.findByRole('status')).toHaveTextContent('Loading');
    expect(
      screen.queryByRole('heading', { level: 1, name: /Check a rental listing/ }),
    ).not.toBeInTheDocument();
  });

  it('shows neither Log in nor the account menu in the header', async () => {
    clerk.session = { ...clerk.session, isLoaded: false };
    const { container } = renderAt('/how-it-works');
    await screen.findByRole('heading', { level: 1, name: 'Follow the road to your risk rating' });
    // The How it works page has its own <header>, so find the site header by its class.
    const siteHeader = container.querySelector<HTMLElement>('header.header');
    if (!siteHeader) {
      throw new Error('No site header');
    }
    const header = within(siteHeader);
    expect(header.queryByRole('link', { name: GUIDE.auth.logInLabel })).not.toBeInTheDocument();
    expect(header.queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
  });
});

describe('Clerk setup', () => {
  it('passes the key, page addresses and theme to Clerk', async () => {
    renderAt('/');
    await waitFor(() => expect(clerk.providerProps.publishableKey).toBe(KEY));
    expect(clerk.providerProps).toMatchObject({
      signInUrl: '/login',
      signUpUrl: '/sign-up',
      afterSignOutUrl: '/',
    });
    expect(clerk.providerProps.appearance).toBeDefined();
  });

  it('lets Clerk change pages through the app router', async () => {
    renderAt('/');
    await waitFor(() => expect(clerk.providerProps.routerPush).toBeDefined());
    const push = clerk.providerProps.routerPush as (to: string) => void;
    act(() => push('/how-it-works'));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Follow the road to your risk rating' }),
    ).toBeInTheDocument();
  });

  it('never loads Clerk without a key', async () => {
    renderAt('/', '');
    await screen.findByRole('heading', { level: 1, name: /Check a rental listing/ });
    expect(clerk.providerProps).toEqual({});
  });

  it("passes token options straight through to Clerk's getToken", async () => {
    const getToken = vi.fn(async () => 'token_456');
    clerk.session = { ...clerk.session, isSignedIn: true, getToken };
    const seen: AuthState[] = [];
    /** Records each sign-in state the app sees. */
    function StateReader() {
      seen.push(useAuthState());
      return null;
    }
    render(
      <MemoryRouter>
        <AuthProvider publishableKey={KEY}>
          <StateReader />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(seen.at(-1)?.isSignedIn).toBe(true));
    const latest = seen.at(-1);
    await expect(latest?.getToken({ template: 'verilet-api', skipCache: true })).resolves.toBe(
      'token_456',
    );
    expect(getToken).toHaveBeenCalledWith({ template: 'verilet-api', skipCache: true });
  });
});

describe('pages that need an account', () => {
  it('sends a signed-out visitor from My scans to the landing page', async () => {
    renderAt('/scans');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Check a rental listing/ }),
    ).toBeInTheDocument();
  });

  it('keeps the page to come back to when switching to sign up', async () => {
    renderAt('/sign-up?redirect_url=%2Fhow-it-works');
    expect(await screen.findByTestId('clerk-sign-up')).toHaveAttribute(
      'data-redirect',
      '/how-it-works',
    );
  });

  it('takes a signed-in visitor straight to the page they asked for', async () => {
    clerk.session = { ...clerk.session, isSignedIn: true };
    renderAt('/login?redirect_url=%2Fscans');
    expect(await screen.findByRole('heading', { level: 1, name: 'My scans' })).toBeInTheDocument();
  });

  it.each([
    ['another website', 'https://evil.example/steal'],
    ['a protocol-relative link', '//evil.example'],
    ['a backslash link', '/\\evil.example'],
    ['the log in page itself', '/login'],
    ['nothing', null],
  ])('falls back to the check form when the return page is %s', (_name, target) => {
    const search = target === null ? '' : `?${new URLSearchParams({ redirect_url: target })}`;
    expect(redirectAfterSignIn(search)).toBe('/check');
  });

  it('builds a log in link that carries the page and its query', () => {
    expect(signInPathFor('/results/scan-1?tab=details')).toBe(
      '/login?redirect_url=%2Fresults%2Fscan-1%3Ftab%3Ddetails',
    );
    expect(redirectAfterSignIn('?redirect_url=%2Fresults%2Fscan-1%3Ftab%3Ddetails')).toBe(
      '/results/scan-1?tab=details',
    );
  });
});

describe('preview account menu', () => {
  it('shows a plain avatar with no made-up initials', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App loggedIn initialScans={[]} />
      </MemoryRouter>,
    );
    const avatar = await screen.findByRole('img', { name: 'Preview account' });
    expect(avatar).toHaveTextContent('');
    expect(screen.queryByText('JD')).not.toBeInTheDocument();
  });
});
