/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Veri modu: `demo` (localStorage) veya `api` (yerel Express API). Varsayılan: `demo`. */
  readonly VITE_DATA_MODE?: 'demo' | 'api'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
