import { Link, useLocation } from 'react-router-dom';
import AccountMenu from '../auth/AccountMenu';
import { AUTH_PATHS, signInPathFor } from '../auth/authState';
import { GUIDE } from '../content/guide';
import '../styles/header.css';

/** Props for the site header. */
interface HeaderProps {
  /** Whether to show the signed-in links and the account menu. */
  loggedIn: boolean;
  /** True while sign-in is still checking for a session; the account area stays empty. */
  pending?: boolean;
}

/**
 * Site header: the logo, the site links, and either a Log in link or the account menu. How it
 * works is always linked; signed-in visitors also get Check a listing and My scans. On phones the
 * links move to their own row instead of disappearing.
 *
 * @param props The header's props.
 * @param props.loggedIn Whether the visitor is signed in.
 * @param props.pending Whether sign-in is still loading.
 * @returns The header.
 */
export default function Header({ loggedIn, pending = false }: HeaderProps) {
  const { pathname, search } = useLocation();
  const onAuthPage =
    pathname.startsWith(AUTH_PATHS.signIn) || pathname.startsWith(AUTH_PATHS.signUp);

  /**
   * Marks a link as the current page only when it points at exactly this page.
   *
   * @param to The link's path.
   * @returns `'page'` for the current page, otherwise undefined.
   */
  function currentFor(to: string): 'page' | undefined {
    return pathname === to ? 'page' : undefined;
  }

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
              <Link to="/check" className="nav__link" aria-current={currentFor('/check')}>
                Check a listing
              </Link>
              <Link to="/scans" className="nav__link" aria-current={currentFor('/scans')}>
                My scans
              </Link>
            </>
          )}
          <Link to="/how-it-works" className="nav__link" aria-current={currentFor('/how-it-works')}>
            How it works
          </Link>
        </nav>
      </div>
      <div className="header__right">
        {!pending && loggedIn && <AccountMenu />}
        {!pending && !loggedIn && !onAuthPage && (
          // Logging in from here brings the visitor back to this page afterwards.
          <Link
            to={signInPathFor(pathname + search)}
            className="button button--secondary header__login"
          >
            {GUIDE.auth.logInLabel}
          </Link>
        )}
      </div>
    </header>
  );
}
