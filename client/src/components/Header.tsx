import { Link, useLocation } from 'react-router-dom';
import AccountMenu from '../auth/AccountMenu';
import { AUTH_PATHS } from '../auth/authState';
import { GUIDE } from '../content/guide';

interface HeaderProps {
  loggedIn: boolean;
  initials?: string;
}

/**
 * Site header. Signed out: the logo, How it works and a Log in link. Signed in: the logo, the
 * Check a listing and My scans links, and the account menu.
 */
export default function Header({ loggedIn, initials = 'JD' }: HeaderProps) {
  const { pathname } = useLocation();
  const onScans = pathname.startsWith('/scans') || pathname.startsWith('/results');
  const onHome = pathname === '/' || pathname === '/check';
  const onAuthPage =
    pathname.startsWith(AUTH_PATHS.signIn) || pathname.startsWith(AUTH_PATHS.signUp);

  return (
    <header className="header">
      <div className="header__left">
        <Link to="/" className="logo" aria-label="Verilet home">
          <span className="logo__mark" aria-hidden="true">
            V
          </span>
          <span className="logo__name">Verilet</span>
        </Link>
        {loggedIn && (
          <nav className="nav" aria-label="Main">
            <Link to="/" className="nav__link" aria-current={onHome ? 'page' : undefined}>
              Check a listing
            </Link>
            <Link to="/scans" className="nav__link" aria-current={onScans ? 'page' : undefined}>
              My scans
            </Link>
          </nav>
        )}
      </div>
      {loggedIn ? (
        <AccountMenu initials={initials} />
      ) : (
        <div className="header__right">
          <nav className="nav nav--public" aria-label="Site">
            <Link
              to="/how-it-works"
              className="nav__link"
              aria-current={pathname === '/how-it-works' ? 'page' : undefined}
            >
              How it works
            </Link>
          </nav>
          {!onAuthPage && (
            <Link to={AUTH_PATHS.signIn} className="header__login">
              {GUIDE.auth.logInLabel}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
