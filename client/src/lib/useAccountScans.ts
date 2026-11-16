import { useCallback, useEffect, useState } from 'react';
import type { ScansApi } from '../services/scansApi';
import type { ScanResult } from '../types';

export type ScansStatus = 'loading' | 'ready' | 'error';

interface Loaded {
  api: ScansApi;
  /** Null when loading failed. */
  scans: ScanResult[] | null;
}

/**
 * Loads a signed-in student's saved scans from the API, and keeps newly checked ones at the top.
 * With no API (signed out, or the development preview) it reports ready with no scans.
 */
export function useAccountScans(api: ScansApi | null) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!api) {
      return;
    }
    let active = true;
    api.list().then(
      (scans) => {
        if (active) {
          setLoaded({ api, scans });
        }
      },
      () => {
        if (active) {
          setLoaded({ api, scans: null });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [api]);

  const add = useCallback(
    (scan: ScanResult) =>
      setLoaded((previous) =>
        previous && previous.api === api
          ? { api: previous.api, scans: [scan, ...(previous.scans ?? [])] }
          : previous,
      ),
    [api],
  );

  const current = api && loaded?.api === api ? loaded : null;
  let status: ScansStatus = 'ready';
  if (api && !current) {
    status = 'loading';
  } else if (current && !current.scans) {
    status = 'error';
  }

  return { scans: current?.scans ?? [], status, add };
}
