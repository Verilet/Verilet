export type NavTarget = 'check' | 'scans';

interface HeaderProps {
  loggedIn: boolean;
  /** Which logged-in nav item is current. */
  active?: NavTarget;
  initials?: string;
  onNavigate: (target: NavTarget) => void;
}

export default function Header({ loggedIn, active, initials = 'JD', onNavigate }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__left">
        <button
          type="button"
          className="logo"
          onClick={() => onNavigate('check')}
          aria-label="Verilet home"
        >
          <span className="logo__mark" aria-hidden="true" />
          <span className="logo__name">Verilet</span>
        </button>
        {loggedIn && (
          <nav className="nav" aria-label="Main">
            <button
              type="button"
              className="nav__link"
              aria-current={active === 'check' ? 'page' : undefined}
              onClick={() => onNavigate('check')}
            >
              Check a listing
            </button>
            <button
              type="button"
              className="nav__link"
              aria-current={active === 'scans' ? 'page' : undefined}
              onClick={() => onNavigate('scans')}
            >
              My scans
            </button>
          </nav>
        )}
      </div>
      {loggedIn ? (
        <div className="avatar" role="img" aria-label={`Signed in as ${initials}`}>
          {initials}
        </div>
      ) : (
        // TODO: link these once the "How it works" and "About" pages exist.
        <nav className="nav nav--public" aria-label="Site">
          <span>How it works</span>
          <span>About</span>
        </nav>
      )}
    </header>
  );
}
