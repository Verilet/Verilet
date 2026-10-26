import { useEffect, useRef, useState } from 'react';
import DevNav from './components/DevNav';
import Header, { type NavTarget } from './components/Header';
import { MOCK_SCANS } from './data/mockScans';
import { copyShareText } from './lib/share';
import { isLoggedInFromUrl } from './lib/session';
import { checkListing as defaultCheckListing, type CheckListing } from './services/scanService';
import type { ListingInput, ScanResult } from './types';
import CheckView from './views/CheckView';
import HomeView from './views/HomeView';
import ResultsView from './views/ResultsView';
import ScansView from './views/ScansView';

type View = { name: 'check' } | { name: 'scans' } | { name: 'results'; scanId: string };

interface AppProps {
  /** Show the logged-in screens. Defaults to the `?loggedIn=true` URL flag. */
  loggedIn?: boolean;
  initialScans?: ScanResult[];
  /** Injectable for tests; defaults to the placeholder scan service. */
  checkListing?: CheckListing;
}

const SUBMIT_ERROR = "We couldn't check that listing. Please try again.";

function App({
  loggedIn: initialLoggedIn = isLoggedInFromUrl(),
  initialScans,
  checkListing = defaultCheckListing,
}: AppProps) {
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);
  const [view, setView] = useState<View>({ name: 'check' });
  const [scans, setScans] = useState<ScanResult[]>(initialScans ?? (loggedIn ? MOCK_SCANS : []));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<{ id: string; ok: boolean } | null>(null);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(shareTimer.current), []);

  function goTo(next: View) {
    setSubmitError(null);
    setView(next);
  }

  function handleNavigate(target: NavTarget) {
    goTo(target === 'scans' ? { name: 'scans' } : { name: 'check' });
  }

  async function handleSubmit(input: ListingInput) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const scan = await checkListing(input);
      setScans((current) => [scan, ...current]);
      setView({ name: 'results', scanId: scan.id });
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
    goTo({ name: 'results', scanId: sample.id });
  }

  function toggleLoggedIn() {
    setLoggedIn((current) => !current);
    goTo({ name: 'check' });
  }

  const activeScan =
    view.name === 'results' ? scans.find((scan) => scan.id === view.scanId) : undefined;
  const headerActive: NavTarget = view.name === 'check' ? 'check' : 'scans';

  let content;
  if (view.name === 'results' && activeScan) {
    content = (
      <ResultsView
        key={activeScan.id}
        scan={activeScan}
        loggedIn={loggedIn}
        backLabel={loggedIn ? '← My scans' : '← Check another listing'}
        onBack={() => goTo(loggedIn ? { name: 'scans' } : { name: 'check' })}
        onCheckAnother={() => goTo({ name: 'check' })}
        onShare={() => handleShare(activeScan)}
        shareLabel={
          shareStatus?.id === activeScan.id
            ? shareStatus.ok
              ? 'Copied'
              : "Couldn't copy"
            : 'Share result'
        }
        defaultExpanded={loggedIn}
      />
    );
  } else if (loggedIn && view.name === 'scans') {
    content = (
      <ScansView
        scans={scans}
        onViewScan={(scanId) => goTo({ name: 'results', scanId })}
        onShareScan={handleShare}
        shareStatus={shareStatus}
      />
    );
  } else if (loggedIn) {
    content = (
      <HomeView
        scans={scans}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
        onViewScan={(scanId) => goTo({ name: 'results', scanId })}
        onViewAll={() => goTo({ name: 'scans' })}
      />
    );
  } else {
    content = (
      <CheckView onSubmit={handleSubmit} submitting={submitting} submitError={submitError} />
    );
  }

  return (
    <>
      <Header loggedIn={loggedIn} active={headerActive} onNavigate={handleNavigate} />
      {content}
      {import.meta.env.MODE === 'development' && (
        <DevNav
          loggedIn={loggedIn}
          onToggleLoggedIn={toggleLoggedIn}
          onShowCheck={() => goTo({ name: 'check' })}
          onShowResults={previewResults}
          onShowScans={() => goTo({ name: 'scans' })}
        />
      )}
    </>
  );
}

export default App;
