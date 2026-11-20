export type DocumentFileKind =
  | 'image'
  | 'pdf'
  | 'word'
  | 'spreadsheet'
  | 'presentation'
  | 'text'
  | 'archive'
  | 'other';

export interface DocumentFileBadge {
  kind: DocumentFileKind;
  shortLabel: string;
  label: string;
  extension: string;
  filterName: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB per attachment

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  docm: 'application/vnd.ms-word.document.macroEnabled.12',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain',
  log: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  html: 'text/html',
  htm: 'text/html',
  epub: 'application/epub+zip',
  zip: 'application/zip',
};

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-word.document.macroEnabled.12': 'docm',
  'application/vnd.oasis.opendocument.text': 'odt',
  'application/rtf': 'rtf',
  'text/rtf': 'rtf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.oasis.opendocument.spreadsheet': 'ods',
  'text/csv': 'csv',
  'text/tab-separated-values': 'tsv',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.oasis.opendocument.presentation': 'odp',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'application/yaml': 'yaml',
  'text/html': 'html',
  'application/epub+zip': 'epub',
  'application/zip': 'zip',
};

interface BadgeStyle {
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

const KIND_STYLES: Record<DocumentFileKind, BadgeStyle> = {
  pdf: {
    badgeBg: 'bg-rose-500/15',
    badgeText: 'text-rose-500 dark:text-rose-400',
    badgeBorder: 'border-rose-500/30',
  },
  word: {
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-600 dark:text-blue-400',
    badgeBorder: 'border-blue-500/30',
  },
  spreadsheet: {
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
    badgeBorder: 'border-emerald-500/30',
  },
  presentation: {
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-600 dark:text-orange-400',
    badgeBorder: 'border-orange-500/30',
  },
  text: {
    badgeBg: 'bg-indigo-500/15',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
    badgeBorder: 'border-indigo-500/30',
  },
  image: {
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-600 dark:text-purple-400',
    badgeBorder: 'border-purple-500/30',
  },
  archive: {
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-600 dark:text-amber-400',
    badgeBorder: 'border-amber-500/30',
  },
  other: {
    badgeBg: 'bg-zinc-500/15',
    badgeText: 'text-zinc-500 dark:text-zinc-300',
    badgeBorder: 'border-zinc-500/30',
  },
};

export function extractFileExtension(fileName?: string | null): string {
  if (!fileName) return '';
  const cleanName = fileName.trim().split(/[\\/]/).pop() || '';
  const dotIdx = cleanName.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === cleanName.length - 1) return '';
  return cleanName.slice(dotIdx + 1).toLowerCase();
}

/**
 * Resolves the canonical MIME type from browser-reported MIME type and filename extension.
 * Android and Linux file pickers frequently report empty or generic MIME types for Office/Markdown docs.
 */
export function resolveDocumentMimeType(fileName?: string | null, reportedMime?: string | null): string {
  const cleanedMime = (reportedMime || '').split(';')[0].trim().toLowerCase();
  const ext = extractFileExtension(fileName);

  if (ext && EXTENSION_TO_MIME[ext]) {
    if (!cleanedMime || cleanedMime === 'application/octet-stream' || cleanedMime === 'binary/octet-stream') {
      return EXTENSION_TO_MIME[ext];
    }
    // Prefer extension mapping for text/office types browsers often coerce to text/plain or application/zip
    if (ext === 'csv' || ext === 'md' || ext === 'markdown' || ext === 'docx' || ext === 'xlsx' || ext === 'pptx' || ext === 'odt' || ext === 'ods' || ext === 'odp') {
      return EXTENSION_TO_MIME[ext];
    }
  }

  if (cleanedMime) return cleanedMime;
  if (ext && EXTENSION_TO_MIME[ext]) return EXTENSION_TO_MIME[ext];
  return 'application/octet-stream';
}

export function isImageMimeType(mimeType?: string | null, fileName?: string | null): boolean {
  const mime = resolveDocumentMimeType(fileName, mimeType);
  return mime.startsWith('image/');
}

export function getFileTypeBadge(mimeType?: string | null, fileName?: string | null): DocumentFileBadge {
  const mime = resolveDocumentMimeType(fileName, mimeType);
  const rawExt = extractFileExtension(fileName);
  const ext = rawExt || MIME_TO_EXTENSION[mime] || 'bin';

  if (mime === 'application/pdf' || ext === 'pdf') {
    return {
      kind: 'pdf',
      shortLabel: 'PDF',
      label: 'PDF Document',
      extension: 'pdf',
      filterName: 'PDF Document (*.pdf)',
      ...KIND_STYLES.pdf,
    };
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.ms-word.document.macroEnabled.12' ||
    ext === 'docx' ||
    ext === 'docm'
  ) {
    return {
      kind: 'word',
      shortLabel: 'DOCX',
      label: 'Word Document',
      extension: ext === 'docm' ? 'docm' : 'docx',
      filterName: 'Word Document (*.docx)',
      ...KIND_STYLES.word,
    };
  }

  if (mime === 'application/msword' || ext === 'doc') {
    return {
      kind: 'word',
      shortLabel: 'DOC',
      label: 'Word 97-2003 Document',
      extension: 'doc',
      filterName: 'Word 97-2003 (*.doc)',
      ...KIND_STYLES.word,
    };
  }

  if (mime === 'application/vnd.oasis.opendocument.text' || ext === 'odt') {
    return {
      kind: 'word',
      shortLabel: 'ODT',
      label: 'OpenDocument Text',
      extension: 'odt',
      filterName: 'OpenDocument Text (*.odt)',
      ...KIND_STYLES.word,
    };
  }

  if (mime === 'application/rtf' || mime === 'text/rtf' || ext === 'rtf') {
    return {
      kind: 'word',
      shortLabel: 'RTF',
      label: 'Rich Text Document',
      extension: 'rtf',
      filterName: 'Rich Text Format (*.rtf)',
      ...KIND_STYLES.word,
    };
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.oasis.opendocument.spreadsheet' ||
    ext === 'xlsx' ||
    ext === 'xls' ||
    ext === 'ods'
  ) {
    const labelExt = ext === 'xls' ? 'XLS' : ext === 'ods' ? 'ODS' : 'XLSX';
    return {
      kind: 'spreadsheet',
      shortLabel: labelExt,
      label: `${labelExt} Spreadsheet`,
      extension: labelExt.toLowerCase(),
      filterName: `${labelExt} Spreadsheet (*.${labelExt.toLowerCase()})`,
      ...KIND_STYLES.spreadsheet,
    };
  }

  if (mime === 'text/csv' || mime === 'text/tab-separated-values' || ext === 'csv' || ext === 'tsv') {
    const isTsv = mime === 'text/tab-separated-values' || ext === 'tsv';
    return {
      kind: 'spreadsheet',
      shortLabel: isTsv ? 'TSV' : 'CSV',
      label: isTsv ? 'TSV Table' : 'CSV Spreadsheet',
      extension: isTsv ? 'tsv' : 'csv',
      filterName: isTsv ? 'TSV Table (*.tsv)' : 'CSV Spreadsheet (*.csv)',
      ...KIND_STYLES.spreadsheet,
    };
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.oasis.opendocument.presentation' ||
    ext === 'pptx' ||
    ext === 'ppt' ||
    ext === 'odp'
  ) {
    const labelExt = ext === 'ppt' ? 'PPT' : ext === 'odp' ? 'ODP' : 'PPTX';
    return {
      kind: 'presentation',
      shortLabel: labelExt,
      label: `${labelExt} Presentation`,
      extension: labelExt.toLowerCase(),
      filterName: `${labelExt} Presentation (*.${labelExt.toLowerCase()})`,
      ...KIND_STYLES.presentation,
    };
  }

  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || mime === 'application/yaml') {
    const upperExt = (MIME_TO_EXTENSION[mime] || ext || 'TXT').toUpperCase();
    return {
      kind: 'text',
      shortLabel: upperExt.slice(0, 4),
      label: `${upperExt} Document`,
      extension: ext || MIME_TO_EXTENSION[mime] || 'txt',
      filterName: `${upperExt} File (*.${ext || 'txt'})`,
      ...KIND_STYLES.text,
    };
  }

  if (mime.startsWith('image/')) {
    const upperExt = (MIME_TO_EXTENSION[mime] || ext || 'IMG').toUpperCase();
    return {
      kind: 'image',
      shortLabel: upperExt === 'JPEG' ? 'JPG' : upperExt.slice(0, 4),
      label: `${upperExt} Image`,
      extension: ext || MIME_TO_EXTENSION[mime] || 'jpg',
      filterName: `${upperExt} Image (*.${ext || 'jpg'})`,
      ...KIND_STYLES.image,
    };
  }

  if (mime === 'application/zip' || mime === 'application/epub+zip' || ext === 'zip' || ext === 'epub') {
    const isEpub = mime === 'application/epub+zip' || ext === 'epub';
    return {
      kind: 'archive',
      shortLabel: isEpub ? 'EPUB' : 'ZIP',
      label: isEpub ? 'EPUB E-Book' : 'ZIP Archive',
      extension: isEpub ? 'epub' : 'zip',
      filterName: isEpub ? 'EPUB E-Book (*.epub)' : 'ZIP Archive (*.zip)',
      ...KIND_STYLES.archive,
    };
  }

  const fallbackLabel = ext && ext !== 'bin' ? ext.toUpperCase().slice(0, 5) : 'FILE';
  return {
    kind: 'other',
    shortLabel: fallbackLabel,
    label: ext && ext !== 'bin' ? `${fallbackLabel} File` : 'Document File',
    extension: ext || 'bin',
    filterName: `Document File (*.${ext || '*'})`,
    ...KIND_STYLES.other,
  };
}

export function suggestTitleFromFileName(fileName: string): string {
  const base = fileName.trim().split(/[\\/]/).pop() || '';
  const dotIdx = base.lastIndexOf('.');
  const withoutExt = dotIdx > 0 ? base.slice(0, dotIdx) : base;
  return withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || base;
}

export function buildDownloadFileName(
  docTitle: string,
  mimeType: string,
  pageFileName?: string | null,
  pageNumber?: number,
  isMultiPage?: boolean
): string {
  const badge = getFileTypeBadge(mimeType, pageFileName);
  const ext = badge.extension || 'bin';

  if (pageFileName && pageFileName.trim()) {
    const cleaned = pageFileName.trim().replace(/[<>:"/\\|?*]+/g, '_');
    return cleaned.includes('.') ? cleaned : `${cleaned}.${ext}`;
  }

  const cleanTitle = (docTitle || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'document';

  return isMultiPage && pageNumber
    ? `${cleanTitle}_part${pageNumber}.${ext}`
    : `${cleanTitle}.${ext}`;
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const cleaned = base64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): string {
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export function decodeBytesToText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

const ALLOWED_HTML_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark',
  'blockquote', 'pre', 'code', 'hr',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'sup', 'sub', 'span', 'div', 'a', 'img',
]);

/**
 * Strictly sanitizes HTML produced from .docx conversion before rendering into the DOM.
 * Only structural/formatting elements and safe raster `data:image/` images are retained.
 */
export function sanitizeHtmlForPreview(unsafeHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(unsafeHtml, 'text/html');

  const sanitizeNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || '');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed' || tag === 'svg' || tag === 'form') {
      return null;
    }

    if (!ALLOWED_HTML_TAGS.has(tag)) {
      const frag = document.createDocumentFragment();
      el.childNodes.forEach((child) => {
        const cleanChild = sanitizeNode(child);
        if (cleanChild) frag.appendChild(cleanChild);
      });
      return frag;
    }

    const cleanEl = document.createElement(tag);

    if (tag === 'td' || tag === 'th') {
      const colspan = el.getAttribute('colspan');
      const rowspan = el.getAttribute('rowspan');
      if (colspan && /^\d+$/.test(colspan)) cleanEl.setAttribute('colspan', colspan);
      if (rowspan && /^\d+$/.test(rowspan)) cleanEl.setAttribute('rowspan', rowspan);
    }

    if (tag === 'img') {
      const src = (el.getAttribute('src') || '').trim();
      // Reject svg data URLs to prevent script execution inside images
      if (/^data:image\/(png|jpeg|jpg|gif|webp|bmp);base64,/i.test(src)) {
        cleanEl.setAttribute('src', src);
      }
      const alt = el.getAttribute('alt');
      if (alt) cleanEl.setAttribute('alt', alt);
      cleanEl.setAttribute('style', 'max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0;');
    }

    if (tag === 'a') {
      const href = (el.getAttribute('href') || '').trim();
      if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
        cleanEl.setAttribute('title', href);
      }
      // Keep external links inert inside the encrypted offline reader for strict Air-Gap safety
      cleanEl.setAttribute('role', 'text');
    }

    el.childNodes.forEach((child) => {
      const cleanChild = sanitizeNode(child);
      if (cleanChild) cleanEl.appendChild(cleanChild);
    });

    return cleanEl;
  };

  const container = document.createElement('div');
  doc.body.childNodes.forEach((child) => {
    const clean = sanitizeNode(child);
    if (clean) container.appendChild(clean);
  });

  return container.innerHTML;
}

export function parseCsvRows(input: string, delimiter: string = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      if (input[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else if (c === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }

  return rows;
}

/**
 * Extracts readable plain text from Rich Text Format (.rtf) payloads without external parsers.
 */
export function extractPlainTextFromRtf(rtf: string): string {
  const skipDestinations = new Set([
    'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object',
    'header', 'footer', 'headerl', 'headerr', 'headerf', 'footerl', 'footerr', 'footerf',
    'footnote', 'listtable', 'listoverridetable', 'revtbl', 'rsidtbl',
  ]);

  let out = '';
  const stack: Array<{ skip: boolean; uc: number }> = [];
  let skipCurrent = false;
  let ucCount = 1;
  let skipChars = 0;

  for (let i = 0; i < rtf.length; i++) {
    const ch = rtf[i];
    if (ch === '{') {
      stack.push({ skip: skipCurrent, uc: ucCount });
      if (rtf.slice(i + 1, i + 3) === '\\*') {
        skipCurrent = true;
      }
      continue;
    }
    if (ch === '}') {
      const prev = stack.pop();
      if (prev) {
        skipCurrent = prev.skip;
        ucCount = prev.uc;
      }
      skipChars = 0;
      continue;
    }
    if (ch === '\\') {
      const next = rtf[i + 1];
      if (!next) break;
      if (next === '\\' || next === '{' || next === '}') {
        if (!skipCurrent && skipChars === 0) out += next;
        if (skipChars > 0) skipChars--;
        i++;
        continue;
      }
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4);
        const code = parseInt(hex, 16);
        if (!skipCurrent && !Number.isNaN(code)) {
          out += String.fromCharCode(code);
        }
        i += 3;
        continue;
      }
      if (next === '\r' || next === '\n') {
        if (!skipCurrent) out += '\n';
        i++;
        continue;
      }

      const match = rtf.slice(i + 1).match(/^([a-zA-Z]+)(-?\d+)? ?/);
      if (match) {
        const word = match[1];
        const param = match[2];
        i += match[0].length;

        if (skipDestinations.has(word)) {
          skipCurrent = true;
        } else if (!skipCurrent) {
          if (word === 'par' || word === 'line') out += '\n';
          else if (word === 'tab') out += '\t';
          else if (word === 'emdash') out += '—';
          else if (word === 'endash') out += '–';
          else if (word === 'lquote') out += '‘';
          else if (word === 'rquote') out += '’';
          else if (word === 'ldblquote') out += '“';
          else if (word === 'rdblquote') out += '”';
          else if (word === 'bullet') out += '•';
          else if (word === 'uc' && param) ucCount = Math.max(0, parseInt(param, 10) || 1);
          else if (word === 'u' && param) {
            let codePoint = parseInt(param, 10);
            if (codePoint < 0) codePoint += 65536;
            out += String.fromCharCode(codePoint);
            skipChars = ucCount;
          }
        }
        continue;
      }
    }

    if (ch === '\r' || ch === '\n') continue;
    if (skipChars > 0) {
      skipChars--;
      continue;
    }
    if (!skipCurrent) {
      out += ch;
    }
  }

  return out.replace(/\n{3,}/g, '\n\n').trim();
}
