import { act, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import AuthProvider from '../src/auth/AuthProvider';
import { GUIDE } from '../src/content/guide';

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
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true, data: [] })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('log in page', () => {
  it('shows the heading and the Clerk sign-in form', () => {
    renderAt('/login');
    expect(
      screen.getByRole('heading', { level: 1, name: GUIDE.auth.signIn.title }),
    ).toBeInTheDocument();
    const form = screen.getByTestId('clerk-sign-in');
    expect(form).toHaveAttribute('data-path', '/login');
    expect(form).toHaveAttribute('data-sign-up-url', '/sign-up');
    expect(form).toHaveAttribute('data-redirect', '/check');
    for (const point of GUIDE.auth.points) {
      expect(screen.getByText(point)).toBeInTheDocument();
    }
  });

  it('keeps Clerk steps like code entry on the same page', () => {
    renderAt('/login/factor-one');
    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
  });

  it('has a matching sign up page', () => {
    renderAt('/sign-up');
    expect(
      screen.getByRole('heading', { level: 1, name: GUIDE.auth.signUp.title }),
    ).toBeInTheDocument();
    const form = screen.getByTestId('clerk-sign-up');
    expect(form).toHaveAttribute('data-path', '/sign-up');
    expect(form).toHaveAttribute('data-sign-in-url', '/login');
    expect(form).toHaveAttribute('data-redirect', '/check');
  });

  it('says sign-in is unavailable when no key is set', () => {
    renderAt('/login', '');
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(GUIDE.auth.unavailableTitle);
  });

  it('sends a signed-in visitor on to the check form', () => {
    clerk.session = { ...clerk.session, isSignedIn: true };
    renderAt('/login');
    expect(screen.queryByTestId('clerk-sign-in')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });
});

describe('header', () => {
  it('links to log in when signed out', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: GUIDE.auth.logInLabel })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('hides the log in link on the log in and sign up pages', () => {
    renderAt('/login');
    expect(screen.queryByRole('link', { name: GUIDE.auth.logInLabel })).not.toBeInTheDocument();
  });

  it('shows the account menu and signed-in links for a Clerk session', () => {
    clerk.session = { ...clerk.session, isSignedIn: true };
    renderAt('/');
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
    const main = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(main.getByRole('link', { name: 'My scans' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: GUIDE.auth.logInLabel })).not.toBeInTheDocument();
  });

  it('still links to log in when sign-in is not set up', () => {
    renderAt('/', '');
    expect(screen.getByRole('link', { name: GUIDE.auth.logInLabel })).toBeInTheDocument();
  });
});

describe('Clerk setup', () => {
  it('passes the key, page addresses and theme to Clerk', () => {
    renderAt('/');
    expect(clerk.providerProps).toMatchObject({
      publishableKey: KEY,
      signInUrl: '/login',
      signUpUrl: '/sign-up',
      afterSignOutUrl: '/',
    });
    expect(clerk.providerProps.appearance).toBeDefined();
  });

  it('lets Clerk change pages through the app router', () => {
    renderAt('/');
    const push = clerk.providerProps.routerPush as (to: string) => void;
    act(() => push('/how-it-works'));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Follow the road to your risk rating' }),
    ).toBeInTheDocument();
  });

  it('skips Clerk entirely without a key', () => {
    renderAt('/', '');
    expect(clerk.providerProps).toEqual({});
  });
});
