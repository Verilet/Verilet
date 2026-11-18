/// <reference types="vite/client" />

/** Environment variables the client reads from `client/.env` through `import.meta.env`. */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

/** Types `import.meta.env` with the variables above. */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
