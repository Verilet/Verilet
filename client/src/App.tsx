import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { readCarArrival } from './lib/carArrival';
import { copyShareText } from './lib/share';
import { loadScans, saveScans } from './lib/scanStorage';
import { isLoggedInFromUrl } from './lib/session';
import { checkListing as defaultCheckListing, type CheckListing } from './services/scanService';
import type { ListingInput, ScanResult } from './types';
import AboutView from './views/AboutView';
import CheckView from './views/CheckView';
import HomeView from './views/HomeView';
import LandingView from './views/LandingView';
import ResultsView from './views/ResultsView';
import ScansView from './views/ScansView';

interface AppProps {
  /** Show the logged-in screens. Defaults to the `?loggedIn=true` URL flag. */
  loggedIn?: boolean;
  initialScans?: ScanResult[];
  /** Injectable for tests; defaults to the placeholder scan service. */
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

interface ResultsRouteProps {
  scans: ScanResult[];
  loggedIn: boolean;
  goTo: (path: string) => void;
  onShare: (scan: ScanResult) => void;
  shareStatus: { id: string; ok: boolean } | null;
}

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

function App({
  loggedIn: initialLoggedIn = isLoggedInFromUrl(),
  initialScans,
  checkListing = defaultCheckListing,
}: AppProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  // Every new page starts at the top. Back and forward keep the browser's saved position. This
  // runs before page effects, so the How it works car starts from the top of the road.
  useLayoutEffect(() => {
    if (navigationType !== NavigationType.Pop) window.scrollTo(0, 0);
  }, [location.pathname, navigationType]);

  const carArrival = useMemo(() => readCarArrival(location.state), [location.state]);
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);
  const [scans, setScans] = useState<ScanResult[]>(
    () => initialScans ?? loadScans() ?? (loggedIn ? MOCK_SCANS : []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{ id: string; ok: boolean } | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(shareTimer.current), []);

  useEffect(() => saveScans(scans), [scans]);

  function goTo(path: string) {
    setSubmitError(null);
    navigate(path);
  }

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

  async function handleShare(scan: ScanResult) {
    const ok = await copyShareText(scan);
    setShareStatus({ id: scan.id, ok });
    clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareStatus(null), 2000);
  }

  function previewResults() {
    const sample = MOCK_SCANS[0];
    setScans((current) =>
      current.some((scan) => scan.id === sample.id) ? current : [sample, ...current],
    );
    goTo(`/results/${sample.id}`);
  }

  function toggleLoggedIn() {
    setLoggedIn((current) => !current);
    goTo('/');
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
        <Route path="/check" element={loggedIn ? home : checkForm} />
        <Route path="/how-it-works" element={<AboutView />} />
        <Route
          path="/scans"
          element={
            loggedIn ? (
              <ScansView
                scans={scans}
                onViewScan={(scanId) => goTo(`/results/${scanId}`)}
                onShareScan={handleShare}
                shareStatus={shareStatus}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
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
