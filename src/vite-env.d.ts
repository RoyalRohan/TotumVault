/// <reference types="vite/client" />

declare module 'mammoth/mammoth.browser.min.js' {
  import type mammoth from 'mammoth';
  export default mammoth;
}

declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}

