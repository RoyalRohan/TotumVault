import type MammothApi from 'mammoth';
import {
  dataUrlToUint8Array,
  decodeBytesToText,
  sanitizeHtmlForPreview,
} from './fileFormatUtils';

export interface PdfExtractionResult {
  numPages: number;
  thumbnailUrl: string;
  width: number;
  height: number;
}

export interface DocxPreviewResult {
  html: string;
  plainText: string;
  wordCount: number;
}

export interface SpreadsheetSheetPreview {
  name: string;
  rows: string[][];
}

export interface SlidePreview {
  slideNumber: number;
  lines: string[];
}

export const MAX_ZIP_ENTRIES = 2000;
export const MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES = 16 * 1024 * 1024; // 16 MB per internal entry
export const MAX_TOTAL_ZIP_UNCOMPRESSED_BYTES = 48 * 1024 * 1024; // 48 MB cumulative across archive preview
const MAX_SHARED_STRINGS = 50_000;
const MAX_SHEETS = 30;
const MAX_SLIDES = 200;

const ZIP_PREVIEW_LIMIT_ERROR =
  'Document archive exceeds safe offline preview memory limits. Use Save/Download to open externally.';

interface ZipReadTracker {
  totalBytes: number;
}

interface InternalJsZipStream {
  on(event: 'data', cb: (chunk: Uint8Array) => void): InternalJsZipStream;
  on(event: 'error', cb: (err: unknown) => void): InternalJsZipStream;
  on(event: 'end', cb: () => void): InternalJsZipStream;
  pause(): void;
  resume(): void;
}

type InternalJsZipEntry = import('jszip').JSZipObject & {
  _data?: {
    uncompressedSize?: number;
  };
  internalStream?: (type: 'uint8array') => InternalJsZipStream;
};

async function loadBoundedZip(bytes: Uint8Array) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(toExactArrayBuffer(bytes));
  const entryNames = Object.keys(zip.files);
  if (entryNames.length > MAX_ZIP_ENTRIES) {
    throw new Error(ZIP_PREVIEW_LIMIT_ERROR);
  }

  let declaredTotal = 0;
  for (const name of entryNames) {
    const entry = zip.files[name] as InternalJsZipEntry | undefined;
    if (!entry || entry.dir) continue;
    const declaredSize = entry._data?.uncompressedSize;
    if (typeof declaredSize === 'number' && declaredSize >= 0) {
      if (declaredSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES) {
        throw new Error(ZIP_PREVIEW_LIMIT_ERROR);
      }
      declaredTotal += declaredSize;
      if (declaredTotal > MAX_TOTAL_ZIP_UNCOMPRESSED_BYTES) {
        throw new Error(ZIP_PREVIEW_LIMIT_ERROR);
      }
    }
  }

  return zip;
}

async function readBoundedZipBytes(
  file: import('jszip').JSZipObject,
  tracker: ZipReadTracker
): Promise<Uint8Array> {
  const internalFile = file as InternalJsZipEntry;
  const declaredSize = internalFile._data?.uncompressedSize;
  if (typeof declaredSize === 'number' && declaredSize >= 0) {
    if (
      declaredSize > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES ||
      tracker.totalBytes + declaredSize > MAX_TOTAL_ZIP_UNCOMPRESSED_BYTES
    ) {
      throw new Error(ZIP_PREVIEW_LIMIT_ERROR);
    }
  }

  if (typeof internalFile.internalStream === 'function') {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let entryBytes = 0;
      let aborted = false;
      const stream = internalFile.internalStream!('uint8array');

      stream
        .on('data', (chunk: Uint8Array) => {
          if (aborted) return;
          entryBytes += chunk.byteLength;
          tracker.totalBytes += chunk.byteLength;
          if (
            entryBytes > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES ||
            tracker.totalBytes > MAX_TOTAL_ZIP_UNCOMPRESSED_BYTES
          ) {
            aborted = true;
            try {
              stream.pause();
            } catch {
              // ignore stream pause errors
            }
            chunks.length = 0;
            reject(new Error(ZIP_PREVIEW_LIMIT_ERROR));
            return;
          }
          chunks.push(chunk);
        })
        .on('error', (err: unknown) => {
          if (aborted) return;
          aborted = true;
          chunks.length = 0;
          reject(err instanceof Error ? err : new Error(String(err)));
        })
        .on('end', () => {
          if (aborted) return;
          const out = new Uint8Array(entryBytes);
          let offset = 0;
          for (const c of chunks) {
            out.set(c, offset);
            offset += c.byteLength;
          }
          chunks.length = 0;
          resolve(out);
        })
        .resume();
    });
  }

  const out = await file.async('uint8array');
  tracker.totalBytes += out.byteLength;
  if (
    out.byteLength > MAX_ZIP_ENTRY_UNCOMPRESSED_BYTES ||
    tracker.totalBytes > MAX_TOTAL_ZIP_UNCOMPRESSED_BYTES
  ) {
    throw new Error(ZIP_PREVIEW_LIMIT_ERROR);
  }
  return out;
}

async function readBoundedZipText(
  file: import('jszip').JSZipObject,
  tracker: ZipReadTracker
): Promise<string> {
  const raw = await readBoundedZipBytes(file, tracker);
  return decodeBytesToText(raw);
}

async function verifyBoundedArchiveStreams(bytes: Uint8Array): Promise<void> {
  const zip = await loadBoundedZip(bytes);
  const tracker: ZipReadTracker = { totalBytes: 0 };
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    await readBoundedZipBytes(entry, tracker);
  }
}

function ensurePromiseWithResolversPolyfill() {
  const P = Promise as unknown as {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };

  if (typeof P.withResolvers !== 'function') {
    P.withResolvers = function withResolvers<T>() {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }
}

let pdfjsInitPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

export async function getPdfJs() {
  if (!pdfjsInitPromise) {
    pdfjsInitPromise = (async () => {
      ensurePromiseWithResolversPolyfill();
      const [pdfjsMod, workerMod] = await Promise.all([
        import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
      ]);
      // Attach worker handler directly on globalThis so PDF.js runs reliably inside
      // both Desktop (tauri://localhost) and Android WebView without CSP/Blob worker issues.
      (globalThis as unknown as { pdfjsWorker?: unknown }).pdfjsWorker = workerMod;
      return pdfjsMod;
    })();
  }
  return pdfjsInitPromise;
}

function toExactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function loadPdfDocument(source: string | Uint8Array) {
  const pdfjs = await getPdfJs();
  const rawBytes = typeof source === 'string' ? dataUrlToUint8Array(source) : source;
  // Pass a defensive copy because PDF.js transfers/detaches buffers on worker messaging
  const dataCopy = new Uint8Array(rawBytes);
  const loadingTask = pdfjs.getDocument({
    data: dataCopy,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  return await loadingTask.promise;
}

export async function extractPdfMetadataAndThumbnail(
  source: string | Uint8Array,
  maxThumbDim: number = 320
): Promise<PdfExtractionResult> {
  let pdfDoc: Awaited<ReturnType<typeof loadPdfDocument>> | null = null;
  try {
    pdfDoc = await loadPdfDocument(source);
    const numPages = Math.max(1, pdfDoc.numPages || 1);
    const page = await pdfDoc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });

    const scale = Math.min(2, maxThumbDim / Math.max(baseViewport.width || 1, baseViewport.height || 1));
    const thumbViewport = page.getViewport({ scale: Math.max(0.2, scale) });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(thumbViewport.width));
    canvas.height = Math.max(1, Math.round(thumbViewport.height));
    const ctx = canvas.getContext('2d');

    let thumbnailUrl = '';
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: thumbViewport }).promise;
      thumbnailUrl = canvas.toDataURL('image/jpeg', 0.78);
    }

    page.cleanup();
    return {
      numPages,
      thumbnailUrl,
      width: Math.round(baseViewport.width || 0),
      height: Math.round(baseViewport.height || 0),
    };
  } catch {
    // Gracefully handle password-protected or exotic PDFs so encrypted storage still succeeds
    return {
      numPages: 1,
      thumbnailUrl: '',
      width: 0,
      height: 0,
    };
  } finally {
    if (pdfDoc) {
      try {
        await pdfDoc.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

export async function convertDocxToSafeHtml(bytes: Uint8Array): Promise<DocxPreviewResult> {
  await verifyBoundedArchiveStreams(bytes);

  const mod = (await import('mammoth/mammoth.browser.min.js')) as unknown as {
    default?: typeof MammothApi;
  } & typeof MammothApi;
  const mammoth = mod.default || mod;
  const buffer = toExactArrayBuffer(bytes);

  const [htmlRes, rawTextRes] = await Promise.all([
    mammoth.convertToHtml({ arrayBuffer: buffer }),
    mammoth.extractRawText({ arrayBuffer: toExactArrayBuffer(bytes) }),
  ]);

  const cleanHtml = sanitizeHtmlForPreview(htmlRes.value || '');
  const plainText = (rawTextRes.value || '').trim();
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  return {
    html: cleanHtml,
    plainText,
    wordCount,
  };
}

function getElementsByLocalName(root: Document | Element, localName: string): Element[] {
  const all = Array.from(root.getElementsByTagName('*'));
  return all.filter((el) => el.localName === localName);
}

export async function extractSpreadsheetFromZipOffice(
  bytes: Uint8Array,
  kind: 'xlsx' | 'ods'
): Promise<SpreadsheetSheetPreview[]> {
  const zip = await loadBoundedZip(bytes);
  const tracker: ZipReadTracker = { totalBytes: 0 };
  const parser = new DOMParser();

  if (kind === 'ods') {
    const contentFile = zip.file('content.xml');
    if (!contentFile) return [];
    const xmlStr = await readBoundedZipText(contentFile, tracker);
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    const tables = getElementsByLocalName(doc, 'table').slice(0, MAX_SHEETS);
    const sheets: SpreadsheetSheetPreview[] = [];

    for (let tIdx = 0; tIdx < tables.length; tIdx++) {
      const tbl = tables[tIdx];
      const name = tbl.getAttribute('table:name') || tbl.getAttribute('name') || `Sheet ${tIdx + 1}`;
      const rowElems = getElementsByLocalName(tbl, 'table-row');
      const rows: string[][] = [];

      for (const rEl of rowElems.slice(0, 500)) {
        const cellElems = Array.from(rEl.children).filter(
          (c) => c.localName === 'table-cell' || c.localName === 'covered-table-cell'
        );
        const rowValues: string[] = [];
        for (const cEl of cellElems.slice(0, 60)) {
          const repeat = Math.min(
            20,
            parseInt(cEl.getAttribute('table:number-columns-repeated') || cEl.getAttribute('number-columns-repeated') || '1', 10) || 1
          );
          const val = (cEl.textContent || '').trim();
          for (let r = 0; r < repeat && rowValues.length < 60; r++) {
            rowValues.push(val);
          }
        }
        while (rowValues.length > 0 && rowValues[rowValues.length - 1] === '') {
          rowValues.pop();
        }
        if (rowValues.some((v) => v !== '')) {
          rows.push(rowValues);
        }
      }
      if (rows.length > 0) {
        sheets.push({ name, rows });
      }
    }
    return sheets;
  }

  // XLSX parsing: sharedStrings + workbook sheet names + sheetN.xml (namespace-prefix agnostic)
  const sharedStrings: string[] = [];
  const sharedFile = zip.file('xl/sharedStrings.xml');
  if (sharedFile) {
    const ssXml = await readBoundedZipText(sharedFile, tracker);
    const ssDoc = parser.parseFromString(ssXml, 'application/xml');
    const siList = getElementsByLocalName(ssDoc, 'si').slice(0, MAX_SHARED_STRINGS);
    for (const si of siList) {
      sharedStrings.push((si.textContent || '').trim());
    }
  }

  const sheetNames: string[] = [];
  const wbFile = zip.file('xl/workbook.xml');
  if (wbFile) {
    const wbXml = await readBoundedZipText(wbFile, tracker);
    const wbDoc = parser.parseFromString(wbXml, 'application/xml');
    const sheetElems = getElementsByLocalName(wbDoc, 'sheet').slice(0, MAX_SHEETS);
    for (const sh of sheetElems) {
      const nm = sh.getAttribute('name');
      if (nm) sheetNames.push(nm);
    }
  }

  const sheetFiles = Object.keys(zip.files)
    .filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/sheet(\d+)\.xml/i)?.[1] || '0', 10);
      const nb = parseInt(b.match(/sheet(\d+)\.xml/i)?.[1] || '0', 10);
      return na - nb;
    })
    .slice(0, MAX_SHEETS);

  const colRefToIndex = (ref: string): number => {
    const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
    let idx = 0;
    for (let i = 0; i < letters.length; i++) {
      idx = idx * 26 + (letters.charCodeAt(i) - 64);
    }
    return Math.max(0, idx - 1);
  };

  const sheets: SpreadsheetSheetPreview[] = [];
  for (let i = 0; i < sheetFiles.length; i++) {
    const sf = zip.file(sheetFiles[i]);
    if (!sf) continue;
    const xmlStr = await readBoundedZipText(sf, tracker);
    const sDoc = parser.parseFromString(xmlStr, 'application/xml');
    const rowNodes = getElementsByLocalName(sDoc, 'row');
    const rows: string[][] = [];

    for (const rowNode of rowNodes.slice(0, 500)) {
      const cells = getElementsByLocalName(rowNode, 'c');
      const rowArr: string[] = [];
      for (const c of cells) {
        const ref = c.getAttribute('r') || '';
        const colIdx = ref ? colRefToIndex(ref) : rowArr.length;
        if (colIdx > 60) continue;
        const cellType = c.getAttribute('t') || '';
        const vNode = getElementsByLocalName(c, 'v')[0];
        const isNode = getElementsByLocalName(c, 'is')[0];
        let val = '';

        if (cellType === 's' && vNode) {
          const idx = parseInt(vNode.textContent || '', 10);
          val = sharedStrings[idx] ?? '';
        } else if (cellType === 'inlineStr' && isNode) {
          val = (isNode.textContent || '').trim();
        } else if (vNode) {
          val = (vNode.textContent || '').trim();
        }

        rowArr[colIdx] = val;
      }
      if (rowArr.some((v) => v !== undefined && v !== '')) {
        for (let k = 0; k < rowArr.length; k++) {
          if (rowArr[k] === undefined) rowArr[k] = '';
        }
        rows.push(rowArr);
      }
    }

    sheets.push({
      name: sheetNames[i] || `Sheet ${i + 1}`,
      rows,
    });
  }

  return sheets;
}

export async function extractOdtPlainText(bytes: Uint8Array): Promise<string> {
  const zip = await loadBoundedZip(bytes);
  const tracker: ZipReadTracker = { totalBytes: 0 };
  const contentFile = zip.file('content.xml');
  if (!contentFile) return decodeBytesToText(bytes);

  const xmlStr = await readBoundedZipText(contentFile, tracker);
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  const paragraphs = Array.from(doc.getElementsByTagName('*')).filter(
    (el) => el.localName === 'p' || el.localName === 'h'
  );
  return paragraphs
    .map((p) => (p.textContent || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

export async function extractPptxSlides(bytes: Uint8Array): Promise<SlidePreview[]> {
  const zip = await loadBoundedZip(bytes);
  const tracker: ZipReadTracker = { totalBytes: 0 };
  const parser = new DOMParser();

  const slideFiles = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return na - nb;
    })
    .slice(0, MAX_SLIDES);

  const slides: SlidePreview[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const sf = zip.file(slideFiles[i]);
    if (!sf) continue;
    const xmlStr = await readBoundedZipText(sf, tracker);
    const doc = parser.parseFromString(xmlStr, 'application/xml');
    const pNodes = getElementsByLocalName(doc, 'p');
    const lines = pNodes
      .map((p) => (p.textContent || '').trim())
      .filter(Boolean);
    slides.push({
      slideNumber: i + 1,
      lines,
    });
  }

  return slides;
}
