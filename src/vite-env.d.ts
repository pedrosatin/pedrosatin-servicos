/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUDIT_ENDPOINT?: string;
  readonly VITE_PSI_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
