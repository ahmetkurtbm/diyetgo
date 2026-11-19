/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** Veri modu: `demo` (localStorage) veya `api` (yerel Express API). Varsayılan: `demo`. */
  readonly VITE_DATA_MODE?: 'demo' | 'api'
}

/** Uygulamanın derlendiği an (ISO); Ayarlar'da sürüm bilgisi olarak gösterilir. */
declare const __BUILD_TIME__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}
