/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Trang WHEP của MediaMTX (live stream camera), VD http://localhost:8889
  readonly VITE_STREAM_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
