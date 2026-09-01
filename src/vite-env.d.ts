/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  /** Public browser key for CARTO basemap tile requests. */
  readonly VITE_CARTO_BASEMAP_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
