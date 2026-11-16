/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the Express API, e.g. `http://localhost:5000`. */
  readonly VITE_API_URL?: string;
  /** Clerk publishable key. Sign-in is turned off when it is missing. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
