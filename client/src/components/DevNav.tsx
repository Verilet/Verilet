/** Props for the development Preview bar. */
interface DevNavProps {
  /** Whether the signed-in screens are showing. */
  loggedIn: boolean;
  /** Switches between the signed-in and signed-out screens. */
  onToggleLoggedIn: () => void;
  /** Opens the check form (or the home page when signed in). */
  onShowCheck: () => void;
  /** Opens a sample result. */
  onShowResults: () => void;
  /** Opens My scans. */
  onShowScans: () => void;
}

/**
 * Development-only shortcut bar for jumping between screens while the real flow (sign-in, API) is
 * still being built. App renders it only in `npm run dev`, never in production builds or tests.
 *
 * @param props The bar's props.
 * @returns The Preview bar.
 */
export default function DevNav({
  loggedIn,
  onToggleLoggedIn,
  onShowCheck,
  onShowResults,
  onShowScans,
}: DevNavProps) {
  return (
    <aside className="dev-nav" aria-label="Development preview">
      <span className="dev-nav__label">Preview</span>
      <button type="button" onClick={onShowCheck}>
        {loggedIn ? 'Home' : 'Check'}
      </button>
      <button type="button" onClick={onShowResults}>
        Results
      </button>
      {loggedIn && (
        <button type="button" onClick={onShowScans}>
          My scans
        </button>
      )}
      <button type="button" className="dev-nav__toggle" onClick={onToggleLoggedIn}>
        {loggedIn ? 'Logged in' : 'Logged out'}
      </button>
    </aside>
  );
}
