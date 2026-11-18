import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Link,
  Navigate,
  NavigationType,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
} from 'react-router-dom';
import { AUTH_PATHS, signInPathFor, useAuthState } from './auth/authState';
import DevNav from './components/DevNav';
import Header from './components/Header';
import { MOCK_SCANS } from './data/mockScans';
import { readCarArrival } from './lib/carArrival';
import { loadScans, saveScans } from './lib/scanStorage';
import { isLoggedInFromUrl } from './lib/session';
import { copyShareText } from './lib/share';
import { checkListing as defaultCheckListing, type CheckListing } from './services/scanService';
import type { ListingInput, ScanResult } from './types';
import AboutView from './views/AboutView';
import AuthView from './views/AuthView';
import CheckView from './views/CheckView';
import HomeView from './views/HomeView';
import LandingView from './views/LandingView';
import ResultsView from './views/ResultsView';
import ScansView from './views/ScansView';

/** Props for the app root. */
interface AppProps {
  /**
   * Preview the logged-in screens without an account, using sample scans kept in this tab.
   * Defaults to the `?loggedIn=true` URL flag, which only works on the dev server.
   */
  loggedIn?: boolean;
  /** Scans to start with instead of the ones saved in this browser tab. */
  initialScans?: ScanResult[];
  /** Injectable for tests; defaults to the placeholder scan service. */
  checkListing?: CheckListing;
}

/** Shown on the form when a check fails. */
const SUBMIT_ERROR = "We couldn't check that listing. Please try again.";

/** Props for the not-found page. */
interface NotFoundProps {
  /** Page heading, e.g. "Page not found". */
  title: string;
  /** One sentence explaining what happened. */
  text: string;
}

/**
 * A not-found page with a link back into the app.
 *
 * @param props The page's props.
 * @param props.title Page heading.
 * @param props.text Explanation under the heading.
 * @returns The not-found page.
 */
function NotFound({ title, text }: NotFoundProps) {
  return (
    <main className="main main--center">
      <div className="intro">
        <h1 className="intro__title">{title}</h1>
        <p className="intro__text">{text}</p>
        <Link to="/" className="button button--primary">
          {title === "We couldn't find that scan" ? 'Check a listing' : 'Go to the home page'}
        </Link>
      </div>
    </main>
  );
}

/**
 * Shown while sign-in is still checking for an existing session.
 *
 * @returns A loading message.
 */
function Loading() {
  return (
    <main className="main main--center">
      <p className="intro__text" role="status">
        Loading…
      </p>
    </main>
  );
}

/** Props for the results route. */
interface ResultsRouteProps {
  /** Scans kept in this browser tab. */
  scans: ScanResult[];
  /** Whether the visitor is signed in, which changes the back link and details panel. */
  loggedIn: boolean;
  /** Navigates to another page. */
  goTo: (path: string) => void;
  /** Copies a short summary of a scan. */
  onShare: (scan: ScanResult) => void;
  /** Outcome of the most recent share, for brief feedback on the button. */
  shareStatus: { id: string; ok: boolean } | null;
}

/**
 * Opens the scan named in the address, or a not-found page when this tab doesn't have it.
 *
 * @param props The route's props.
 * @returns The results page for the scan, or a not-found page.
 */
function ResultsRoute({ scans, loggedIn, goTo, onShare, shareStatus }: ResultsRouteProps) {
  const { scanId } = useParams();
  const scan = scans.find((candidate) => candidate.id === scanId);
  if (!scan) {
    return (
      <NotFound
        title="We couldn't find that scan"
        text="Scans are only kept in the browser tab they were made in, so this one can't be opened here."
      />
    );
  }
  return (
    <ResultsView
      key={scan.id}
      scan={scan}
      loggedIn={loggedIn}
      backLabel={loggedIn ? '← My scans' : '← Check another listing'}
      onBack={() => goTo(loggedIn ? '/scans' : '/check')}
      onCheckAnother={() => goTo(loggedIn ? '/' : '/check')}
      onShare={() => onShare(scan)}
      shareLabel={
        shareStatus?.id === scan.id ? (shareStatus.ok ? 'Copied' : "Couldn't copy") : 'Share result'
      }
      defaultExpanded={loggedIn}
    />
  );
}

/**
 * The app: header, routes, and the development Preview bar. Keeps scans in the browser tab.
 *
 * @param props The app's props.
 * @param props.loggedIn Preview the signed-in screens without an account.
 * @param props.initialScans Scans to start with.
 * @param props.checkListing Scores a listing; defaults to the placeholder scorer.
 * @returns The app.
 */
function App({
  loggedIn: initialLoggedIn = import.meta.env.DEV && isLoggedInFromUrl(),
  initialScans,
  checkListing = defaultCheckListing,
}: AppProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  // Every new page starts at the top. Back and forward keep the browser's saved position. This
  // runs before page effects, so the How it works car starts from the top of the road.
  useLayoutEffect(() => {
    if (navigationType !== NavigationType.Pop) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, navigationType]);

  const carArrival = useMemo(() => readCarArrival(location.state), [location.state]);
  const auth = useAuthState();
  const [previewLoggedIn, setPreviewLoggedIn] = useState(initialLoggedIn);
  const loggedIn = previewLoggedIn || auth.isSignedIn;
  const authPending = auth.configured && !auth.isLoaded;

  // Scans are kept in this browser tab for now, whether signed in or previewing.
  const [scans, setScans] = useState<ScanResult[]>(
    () => initialScans ?? loadScans() ?? (initialLoggedIn ? MOCK_SCANS : []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{ id: string; ok: boolean } | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(shareTimer.current), []);

  useEffect(() => saveScans(scans), [scans]);

  /**
   * Goes to another page and clears any error from the last check.
   *
   * @param path Page to open.
   */
  function goTo(path: string) {
    setSubmitError(null);
    navigate(path);
  }

  /**
   * Checks a listing, keeps the result, and opens it. Shows an error on the form if it fails.
   *
   * @param input The validated form values.
   */
  async function handleSubmit(input: ListingInput) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const scan = await checkListing(input);
      setScans((current) => [scan, ...current]);
      navigate(`/results/${scan.id}`);
    } catch {
      setSubmitError(SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Copies a short summary of a scan and shows whether it worked for two seconds.
   *
   * @param scan The scan to share.
   */
  async function handleShare(scan: ScanResult) {
    const ok = await copyShareText(scan);
    setShareStatus({ id: scan.id, ok });
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareStatus(null), 2000);
  }

  /** Opens a sample result from the Preview bar, adding it to the list first if needed. */
  function previewResults() {
    const sample = MOCK_SCANS[0];
    setScans((current) =>
      current.some((scan) => scan.id === sample.id) ? current : [sample, ...current],
    );
    goTo(`/results/${sample.id}`);
  }

  /** Switches the Preview bar between the signed-in and signed-out screens. */
  function toggleLoggedIn() {
    setPreviewLoggedIn((current) => !current);
    goTo('/');
  }

  /**
   * Shows a page only to signed-in visitors. Others go to log in, which brings them back here
   * afterwards, keeping any car transition.
   *
   * @param page The page that needs an account.
   * @returns The page, a loading message while sign-in is checked, or a redirect to log in.
   */
  function requireAccount(page: ReactNode) {
    if (authPending) {
      return <Loading />;
    }
    if (loggedIn) {
      return page;
    }
    // The log in page sends them back here afterwards, through Clerk's redirect_url.
    return (
      <Navigate
        to={signInPathFor(location.pathname + location.search)}
        replace
        state={location.state}
      />
    );
  }

  const home = (
    <HomeView
      scans={scans}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
      carArrival={carArrival}
      onViewScan={(scanId) => goTo(`/results/${scanId}`)}
      onViewAll={() => goTo('/scans')}
    />
  );
  const checkForm = (
    <CheckView
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
      carArrival={carArrival}
    />
  );

  const warm = !loggedIn;

  return (
    <div className={warm ? 'app theme-warm' : 'app'}>
      <Header loggedIn={loggedIn} />
      <Routes>
        <Route path="/" element={loggedIn ? home : <LandingView />} />
        <Route path="/check" element={authPending ? <Loading /> : loggedIn ? home : checkForm} />
        <Route path={`${AUTH_PATHS.signIn}/*`} element={<AuthView mode="sign-in" />} />
        <Route path={`${AUTH_PATHS.signUp}/*`} element={<AuthView mode="sign-up" />} />
        <Route path="/how-it-works" element={<AboutView />} />
        <Route
          path="/scans"
          element={requireAccount(
            <ScansView
              scans={scans}
              onViewScan={(scanId) => goTo(`/results/${scanId}`)}
              onShareScan={handleShare}
              shareStatus={shareStatus}
            />,
          )}
        />
        <Route
          path="/results/:scanId"
          element={
            <ResultsRoute
              scans={scans}
              loggedIn={loggedIn}
              goTo={goTo}
              onShare={handleShare}
              shareStatus={shareStatus}
            />
          }
        />
        <Route
          path="*"
          element={<NotFound title="Page not found" text="That page doesn't exist or has moved." />}
        />
      </Routes>
      {import.meta.env.MODE === 'development' && (
        <DevNav
          loggedIn={loggedIn}
          onToggleLoggedIn={toggleLoggedIn}
          onShowCheck={() => goTo(loggedIn ? '/' : '/check')}
          onShowResults={previewResults}
          onShowScans={() => goTo('/scans')}
        />
      )}
    </div>
  );
}

export default App;
