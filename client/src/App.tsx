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
import DevNav from './components/DevNav';
import Header from './components/Header';
import { MOCK_SCANS } from './data/mockScans';
import { AUTH_PATHS, useAuthState } from './auth/authState';
import { readCarArrival } from './lib/carArrival';
import { clearGuestCheck, loadGuestCheck, saveGuestCheck } from './lib/guestCheckStorage';
import { copyShareText } from './lib/share';
import { loadScans, saveScans } from './lib/scanStorage';
import { isLoggedInFromUrl } from './lib/session';
import { useAccountScans, type ScansStatus } from './lib/useAccountScans';
import type { GuestCheck } from './schemas/scan';
import { checkAsGuest, createScansApi, toPayload } from './services/scansApi';
import { checkListing as previewCheckListing, type CheckListing } from './services/scanService';
import type { ListingInput, ScanResult } from './types';
import AboutView from './views/AboutView';
import AuthView from './views/AuthView';
import GuestCheckView from './views/GuestCheckView';
import GuestResultView from './views/GuestResultView';
import HomeView from './views/HomeView';
import LandingView from './views/LandingView';
import ResultsView from './views/ResultsView';
import ScansView from './views/ScansView';

interface AppProps {
  /**
   * Preview the logged-in screens without an account, using sample scans kept in this tab.
   * Defaults to the `?loggedIn=true` URL flag, which only works on the dev server.
   */
  loggedIn?: boolean;
  initialScans?: ScanResult[];
  /** Injectable for tests. Defaults to the scans API when signed in, or the preview scorer. */
  checkListing?: CheckListing;
}

const SUBMIT_ERROR = "We couldn't check that listing. Please try again.";

function NotFound({ title, text }: { title: string; text: string }) {
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

function Loading() {
  return (
    <main className="main main--center">
      <p className="intro__text" role="status">
        Loading…
      </p>
    </main>
  );
}

interface ResultsRouteProps {
  scans: ScanResult[];
  scansStatus: ScansStatus;
  /** Fetches a scan that isn't in the loaded list. */
  loadScan?: (id: string) => Promise<ScanResult | null>;
  loggedIn: boolean;
  goTo: (path: string) => void;
  onShare: (scan: ScanResult) => void;
  shareStatus: { id: string; ok: boolean } | null;
}

function ResultsRoute({
  scans,
  scansStatus,
  loadScan,
  loggedIn,
  goTo,
  onShare,
  shareStatus,
}: ResultsRouteProps) {
  const { scanId = '' } = useParams();
  const known = scans.find((candidate) => candidate.id === scanId);
  const [fetched, setFetched] = useState<{ id: string; scan: ScanResult | null } | null>(null);
  const waitingForList = scansStatus === 'loading';

  useEffect(() => {
    if (known || waitingForList || !loadScan) {
      return;
    }
    let active = true;
    loadScan(scanId).then(
      (scan) => {
        if (active) {
          setFetched({ id: scanId, scan });
        }
      },
      () => {
        if (active) {
          setFetched({ id: scanId, scan: null });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [known, waitingForList, loadScan, scanId]);

  const lookedUp = fetched?.id === scanId ? fetched.scan : undefined;
  const scan = known ?? lookedUp;
  if (!scan && (waitingForList || (loadScan && lookedUp === undefined))) {
    return <Loading />;
  }
  if (!scan) {
    return (
      <NotFound
        title="We couldn't find that scan"
        text="It may have been deleted, or it belongs to another account."
      />
    );
  }
  return (
    <ResultsView
      key={scan.id}
      scan={scan}
      loggedIn={loggedIn}
      backLabel="← My scans"
      onBack={() => goTo('/scans')}
      onCheckAnother={() => goTo('/')}
      onShare={() => onShare(scan)}
      shareLabel={
        shareStatus?.id === scan.id ? (shareStatus.ok ? 'Copied' : "Couldn't copy") : 'Share result'
      }
      defaultExpanded={loggedIn}
    />
  );
}

function App({
  loggedIn: initialLoggedIn = import.meta.env.DEV && isLoggedInFromUrl(),
  initialScans,
  checkListing: checkListingOverride,
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

  // Signed-in students' scans live on the server. The development preview keeps them in this tab.
  const accountApi = useMemo(
    () => (auth.configured && auth.isSignedIn ? createScansApi(auth.getToken) : null),
    [auth.configured, auth.isSignedIn, auth.getToken],
  );
  const usingAccount = accountApi !== null && !previewLoggedIn;
  const account = useAccountScans(usingAccount ? accountApi : null);
  const [previewScans, setPreviewScans] = useState<ScanResult[]>(
    () => initialScans ?? loadScans() ?? (initialLoggedIn ? MOCK_SCANS : []),
  );
  const scans = usingAccount ? account.scans : previewScans;
  const scansStatus: ScansStatus = usingAccount ? account.status : 'ready';

  const [guestCheck, setGuestCheck] = useState<GuestCheck | null>(loadGuestCheck);
  const carriedOver = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{ id: string; ok: boolean } | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(shareTimer.current), []);

  useEffect(() => {
    if (!usingAccount) {
      saveScans(previewScans);
    }
  }, [usingAccount, previewScans]);

  // A guest who signs in gets their last check saved to the new account, then sees it in full.
  useEffect(() => {
    if (!usingAccount || !accountApi || account.status === 'loading' || carriedOver.current) {
      return;
    }
    const pending = loadGuestCheck();
    if (!pending) {
      return;
    }
    carriedOver.current = true;
    clearGuestCheck();
    accountApi.save(pending.listing).then(
      (scan) => {
        account.add(scan);
        setGuestCheck(null);
        navigate(`/results/${scan.id}`, { replace: true });
      },
      () => {
        saveGuestCheck(pending);
        setSubmitError("We couldn't save your earlier check. Check it again to save it.");
      },
    );
  }, [usingAccount, accountApi, account, navigate]);

  function goTo(path: string) {
    setSubmitError(null);
    navigate(path);
  }

  async function handleGuestSubmit(input: ListingInput) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const listing = toPayload(input);
      const check = { listing, ...(await checkAsGuest(listing)) };
      saveGuestCheck(check);
      setGuestCheck(check);
      navigate('/check/result');
    } catch {
      setSubmitError(SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  function checkAnotherAsGuest() {
    clearGuestCheck();
    setGuestCheck(null);
    goTo('/check');
  }

  async function handleSubmit(input: ListingInput) {
    const check =
      checkListingOverride ??
      (usingAccount && accountApi ? accountApi.create : previewCheckListing);
    setSubmitting(true);
    setSubmitError(null);
    try {
      const scan = await check(input);
      if (usingAccount) {
        account.add(scan);
      } else {
        setPreviewScans((current) => [scan, ...current]);
      }
      navigate(`/results/${scan.id}`);
    } catch {
      setSubmitError(SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShare(scan: ScanResult) {
    const ok = await copyShareText(scan);
    setShareStatus({ id: scan.id, ok });
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareStatus(null), 2000);
  }

  function previewResults() {
    const sample = MOCK_SCANS[0];
    setPreviewScans((current) =>
      current.some((scan) => scan.id === sample.id) ? current : [sample, ...current],
    );
    goTo(`/results/${sample.id}`);
  }

  function toggleLoggedIn() {
    setPreviewLoggedIn((current) => !current);
    goTo('/');
  }

  /** Pages that need an account send signed-out visitors to log in, keeping any car transition. */
  function requireAccount(page: ReactNode) {
    if (authPending) {
      return <Loading />;
    }
    if (loggedIn) {
      return page;
    }
    return <Navigate to={AUTH_PATHS.signIn} replace state={location.state} />;
  }

  const home = (
    <HomeView
      scans={scans}
      scansStatus={scansStatus}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
      carArrival={carArrival}
      onViewScan={(scanId) => goTo(`/results/${scanId}`)}
      onViewAll={() => goTo('/scans')}
    />
  );

  const warm = !loggedIn;

  return (
    <div className={warm ? 'app theme-warm' : 'app'}>
      <Header loggedIn={loggedIn} />
      <Routes>
        <Route path="/" element={loggedIn ? home : <LandingView />} />
        <Route
          path="/check"
          element={
            authPending ? (
              <Loading />
            ) : loggedIn ? (
              home
            ) : (
              <GuestCheckView
                onSubmit={handleGuestSubmit}
                submitting={submitting}
                submitError={submitError}
                carArrival={carArrival}
              />
            )
          }
        />
        <Route
          path="/check/result"
          element={
            !loggedIn && guestCheck ? (
              <GuestResultView check={guestCheck} onCheckAnother={checkAnotherAsGuest} />
            ) : (
              <Navigate to="/check" replace />
            )
          }
        />
        <Route path={`${AUTH_PATHS.signIn}/*`} element={<AuthView mode="sign-in" />} />
        <Route path={`${AUTH_PATHS.signUp}/*`} element={<AuthView mode="sign-up" />} />
        <Route path="/how-it-works" element={<AboutView />} />
        <Route
          path="/scans"
          element={requireAccount(
            <ScansView
              scans={scans}
              scansStatus={scansStatus}
              onViewScan={(scanId) => goTo(`/results/${scanId}`)}
              onShareScan={handleShare}
              shareStatus={shareStatus}
            />,
          )}
        />
        <Route
          path="/results/:scanId"
          element={requireAccount(
            <ResultsRoute
              scans={scans}
              scansStatus={scansStatus}
              loadScan={usingAccount ? accountApi?.get : undefined}
              loggedIn={loggedIn}
              goTo={goTo}
              onShare={handleShare}
              shareStatus={shareStatus}
            />,
          )}
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
