/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clerk publishable key. Sign-in is turned off when it is missing. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
