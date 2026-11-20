import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import { AUTH_PATHS, useAuthState } from './auth/authState';
import Header from './components/Header';
import { readCarArrival } from './lib/carArrival';
import { loadScans, saveScans } from './lib/scanStorage';
import { readPreviewFlag, savePreviewFlag } from './lib/session';
import { copyShareText } from './lib/share';
import { checkListing as defaultCheckListing, type CheckListing } from './services/scanService';
import type { ListingInput, ScanResult } from './types';
import AboutView from './views/AboutView';
import CheckView from './views/CheckView';
import HomeView from './views/HomeView';
import LandingView from './views/LandingView';
import ResultsView from './views/ResultsView';
import ScansView from './views/ScansView';

/** Props for the app root. */
interface AppProps {
  /**
   * Preview the signed-in (true) or signed-out (false) screens, whatever the real session is.
   * Left out, the dev server reads the `?loggedIn` flag and everyone else follows real sign-in.
   */
  loggedIn?: boolean;
  /** Scans to start with instead of the ones saved in this browser tab. */
  initialScans?: ScanResult[];
  /** Injectable for tests; defaults to the placeholder scan service. */
  checkListing?: CheckListing;
}

/** The log in and sign up pages use Clerk's forms, so they load only when someone opens them. */
const AuthView = lazy(() => import('./views/AuthView'));

/**
 * The Preview bar is a development tool. Every development-only check in the app is written as
 * `import.meta.env.MODE === 'development'` so the build can drop that code from production.
 */
const DevNav =
  import.meta.env.MODE === 'development' ? lazy(() => import('./components/DevNav')) : null;

/**
 * Loads the sample scans the Preview bar shows. Only exists on the dev server, so the samples are
 * never bundled for users.
 */
const loadSampleScans =
  import.meta.env.MODE === 'development'
    ? async (): Promise<ScanResult[]> => (await import('./data/mockScans')).MOCK_SCANS
    : null;

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
 * Shown while sign-in is still checking for an existing session, or a page is still loading.
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
 * @param props.loggedIn Preview the signed-in (true) or signed-out (false) screens.
 * @param props.initialScans Scans to start with.
 * @param props.checkListing Scores a listing; defaults to the placeholder scorer.
 * @returns The app.
 */
function App({
  loggedIn: previewProp,
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
  // The Preview bar overrides real sign-in in either direction; null follows the real session.
  const [preview, setPreview] = useState<boolean | null>(() => {
    if (previewProp !== undefined) {
      return previewProp;
    }
    return import.meta.env.MODE === 'development' ? readPreviewFlag(location.search) : null;
  });
  const loggedIn = preview ?? auth.isSignedIn;
  const authPending = preview === null && auth.configured && !auth.isLoaded;

  // Remember the preview for this tab, outside of rendering.
  useEffect(() => {
    if (import.meta.env.MODE === 'development' && previewProp === undefined) {
      savePreviewFlag(preview);
    }
  }, [preview, previewProp]);

  // Real scans are kept in this browser tab. Sample scans for the preview are only loaded on the
  // dev server, are kept in memory, and are never saved with the real ones.
  const [scans, setScans] = useState<ScanResult[]>(() => initialScans ?? loadScans() ?? []);
  const [samples, setSamples] = useState<ScanResult[]>([]);
  const [showSamples, setShowSamples] = useState(preview === true && initialScans === undefined);
  const visibleScans = useMemo(
    () => (showSamples ? [...scans, ...samples] : scans),
    [scans, samples, showSamples],
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{ id: string; ok: boolean } | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(shareTimer.current), []);

  useEffect(() => saveScans(scans), [scans]);

  useEffect(() => {
    if (!showSamples || !loadSampleScans || samples.length > 0) {
      return;
    }
    let active = true;
    loadSampleScans().then((sampleScans) => {
      if (active) {
        setSamples(sampleScans);
      }
    });
    return () => {
      active = false;
    };
  }, [showSamples, samples.length]);

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

  /** Opens a sample result from the Preview bar, loading the sample scans first if needed. */
  async function previewResults() {
    if (!loadSampleScans) {
      return;
    }
    const sampleScans = samples.length > 0 ? samples : await loadSampleScans();
    setSamples(sampleScans);
    setShowSamples(true);
    goTo(`/results/${sampleScans[0].id}`);
  }

  /** Switches the Preview bar between the signed-in and signed-out screens, even when signed in. */
  function toggleLoggedIn() {
    if (!loggedIn) {
      setShowSamples(true);
    }
    setPreview(!loggedIn);
    goTo('/');
  }

  /**
   * Shows a page only to signed-in visitors. Others go to the landing page, keeping any car
   * transition (SCRUM-48-T-7 criterion 10).
   *
   * @param page The page that needs an account.
   * @returns The page, a loading message while sign-in is checked, or a redirect home.
   */
  function requireAccount(page: ReactNode) {
    if (authPending) {
      return <Loading />;
    }
    if (loggedIn) {
      return page;
    }
    return <Navigate to="/" replace state={location.state} />;
  }

  /**
   * The signed-in home page. Only called by the routes that show it.
   *
   * @returns The home page with the listing form and recent scans.
   */
  function renderHome() {
    return (
      <HomeView
        scans={visibleScans}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
        carArrival={carArrival}
      />
    );
  }

  /**
   * The page for `/`: a loading message while sign-in is checked, then home or the landing page.
   *
   * @returns The page to show at `/`.
   */
  function renderRoot() {
    if (authPending) {
      return <Loading />;
    }
    return loggedIn ? renderHome() : <LandingView />;
  }

  /**
   * The page for `/check`: the signed-in home page, or the check form for everyone else.
   *
   * @returns The page to show at `/check`.
   */
  function renderCheck() {
    if (authPending) {
      return <Loading />;
    }
    if (loggedIn) {
      return renderHome();
    }
    return (
      <CheckView
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
        carArrival={carArrival}
      />
    );
  }

  const warm = !loggedIn;

  return (
    <div className={warm ? 'app theme-warm' : 'app'}>
      <Header loggedIn={loggedIn} pending={authPending} />
      <Routes>
        <Route path="/" element={renderRoot()} />
        <Route path="/check" element={renderCheck()} />
        <Route
          path={`${AUTH_PATHS.signIn}/*`}
          element={
            <Suspense fallback={<Loading />}>
              <AuthView mode="sign-in" />
            </Suspense>
          }
        />
        <Route
          path={`${AUTH_PATHS.signUp}/*`}
          element={
            <Suspense fallback={<Loading />}>
              <AuthView mode="sign-up" />
            </Suspense>
          }
        />
        <Route path="/how-it-works" element={<AboutView />} />
        <Route
          path="/scans"
          element={requireAccount(
            <ScansView scans={visibleScans} onShareScan={handleShare} shareStatus={shareStatus} />,
          )}
        />
        <Route
          path="/results/:scanId"
          element={
            <ResultsRoute
              scans={visibleScans}
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
      {DevNav && (
        <Suspense fallback={null}>
          <DevNav
            loggedIn={loggedIn}
            onToggleLoggedIn={toggleLoggedIn}
            onShowCheck={() => goTo(loggedIn ? '/' : '/check')}
            onShowResults={previewResults}
            onShowScans={() => goTo('/scans')}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
