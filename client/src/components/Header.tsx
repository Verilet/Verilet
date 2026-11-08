import { Link, useLocation } from 'react-router-dom';

interface HeaderProps {
  loggedIn: boolean;
  initials?: string;
}

export default function Header({ loggedIn, initials = 'JD' }: HeaderProps) {
  const { pathname } = useLocation();
  const onScans = pathname.startsWith('/scans') || pathname.startsWith('/results');
  const onHome = pathname === '/' || pathname === '/check';

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
        <div className="avatar" role="img" aria-label={`Signed in as ${initials}`}>
          {initials}
        </div>
      ) : (
        <nav className="nav nav--public" aria-label="Site">
          <Link
            to="/how-it-works"
            className="nav__link"
            aria-current={pathname === '/how-it-works' ? 'page' : undefined}
          >
            How it works
          </Link>
          {/* TODO: link "About" once that page exists. */}
          <span>About</span>
        </nav>
      )}
    </header>
  );
}
