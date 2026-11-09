/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the Express API, e.g. `http://localhost:5000`. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
