import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import Header from './components/Header';
import { readCarArrival } from './lib/carArrival';
import { loadScans, saveScans } from './lib/scanStorage';
import { checkListing as defaultCheckListing, type CheckListing } from './services/scanService';
import type { ListingInput, ScanResult } from './types';
import AboutView from './views/AboutView';
import CheckView from './views/CheckView';
import LandingView from './views/LandingView';
import ResultsView from './views/ResultsView';

interface AppProps {
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
  goTo: (path: string) => void;
}

function ResultsRoute({ scans, goTo }: ResultsRouteProps) {
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
      backLabel="← Check another listing"
      onBack={() => goTo('/check')}
      onCheckAnother={() => goTo('/check')}
    />
  );
}

function App({ initialScans, checkListing = defaultCheckListing }: AppProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();

  // Every new page starts at the top. Back and forward keep the browser's saved position. This
  // runs before page effects, so the How it works car starts from the top of the road.
  useLayoutEffect(() => {
    if (navigationType !== NavigationType.Pop) window.scrollTo(0, 0);
  }, [location.pathname, navigationType]);

  const carArrival = useMemo(() => readCarArrival(location.state), [location.state]);
  const [scans, setScans] = useState<ScanResult[]>(() => initialScans ?? loadScans() ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  return (
    <div className="app theme-warm">
      <Header />
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route
          path="/check"
          element={
            <CheckView
              onSubmit={handleSubmit}
              submitting={submitting}
              submitError={submitError}
              carArrival={carArrival}
            />
          }
        />
        <Route path="/how-it-works" element={<AboutView />} />
        {/* Old links to the signed-in scans page land on the home page. */}
        <Route path="/scans" element={<Navigate to="/" replace />} />
        <Route path="/results/:scanId" element={<ResultsRoute scans={scans} goTo={goTo} />} />
        <Route
          path="*"
          element={<NotFound title="Page not found" text="That page doesn't exist or has moved." />}
        />
      </Routes>
    </div>
  );
}

export default App;
