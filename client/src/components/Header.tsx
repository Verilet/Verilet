import { Link, useLocation } from 'react-router-dom';
import AccountMenu from '../auth/AccountMenu';
import { AUTH_PATHS } from '../auth/authState';
import { GUIDE } from '../content/guide';

/** Props for the site header. */
interface HeaderProps {
  /** Whether to show the signed-in links and the account menu. */
  loggedIn: boolean;
}

/**
 * Site header: the logo, the site links, and either a Log in link or the account menu. How it
 * works is always linked; signed-in visitors also get Check a listing and My scans. On phones the
 * links move to their own row instead of disappearing.
 *
 * @param props The header's props.
 * @param props.loggedIn Whether the visitor is signed in.
 * @returns The header.
 */
export default function Header({ loggedIn }: HeaderProps) {
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
        <nav className="nav" aria-label="Site">
          {loggedIn && (
            <>
              <Link to="/" className="nav__link" aria-current={onHome ? 'page' : undefined}>
                Check a listing
              </Link>
              <Link to="/scans" className="nav__link" aria-current={onScans ? 'page' : undefined}>
                My scans
              </Link>
            </>
          )}
          <Link
            to="/how-it-works"
            className="nav__link"
            aria-current={pathname === '/how-it-works' ? 'page' : undefined}
          >
            How it works
          </Link>
        </nav>
      </div>
      <div className="header__right">
        {loggedIn ? (
          <AccountMenu />
        ) : (
          !onAuthPage && (
            <Link to={AUTH_PATHS.signIn} className="header__login">
              {GUIDE.auth.logInLabel}
            </Link>
          )
        )}
      </div>
    </header>
  );
}
