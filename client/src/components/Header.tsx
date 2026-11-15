import { Link, useLocation } from 'react-router-dom';

/** Site header: the logo, which links home, and a link to How it works. */
export default function Header() {
  const { pathname } = useLocation();

  return (
    <header className="header">
      <Link to="/" className="logo" aria-label="Verilet home">
        <span className="logo__mark" aria-hidden="true">
          V
        </span>
        <span className="logo__name">Verilet</span>
      </Link>
      <nav className="nav nav--public" aria-label="Site">
        <Link
          to="/how-it-works"
          className="nav__link"
          aria-current={pathname === '/how-it-works' ? 'page' : undefined}
        >
          How it works
        </Link>
      </nav>
    </header>
  );
}
