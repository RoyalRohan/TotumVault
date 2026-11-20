import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Download,
  FileText,
  Lock,
  Moon,
  Sun,
} from 'lucide-react';
import { formatBytes } from './documentUtils';
import {
  dataUrlToUint8Array,
  decodeBytesToText,
  extractFileExtension,
  extractPlainTextFromRtf,
  getFileTypeBadge,
  isImageMimeType,
  parseCsvRows,
  resolveDocumentMimeType,
} from './fileFormatUtils';
import {
  convertDocxToSafeHtml,
  extractOdtPlainText,
  extractPptxSlides,
  extractSpreadsheetFromZipOffice,
  loadPdfDocument,
  SlidePreview,
  SpreadsheetSheetPreview,
} from './documentPreviewEngine';

interface DocumentFilePreviewProps {
  dataUrl: string;
  mimeType: string;
  fileName?: string;
  fileSize?: number;
  zoomScale: number;
  viewRotation: number;
  panOffset: { x: number; y: number };
  isPanning: boolean;
  onDownload: () => void;
}

type ParsedPreview =
  | { type: 'loading' }
  | { type: 'docx'; html: string; plainText: string; wordCount: number }
  | { type: 'spreadsheet'; sheets: SpreadsheetSheetPreview[]; activeText: string }
  | { type: 'slides'; slides: SlidePreview[]; plainText: string }
  | { type: 'text'; text: string; mono: boolean }
  | { type: 'binary'; reason?: string };

export const DocumentFilePreview: React.FC<DocumentFilePreviewProps> = ({
  dataUrl,
  mimeType,
  fileName,
  fileSize,
  zoomScale,
  viewRotation,
  panOffset,
  isPanning,
  onDownload,
}) => {
  const resolvedMime = resolveDocumentMimeType(fileName, mimeType);
  const badge = getFileTypeBadge(resolvedMime, fileName);
  const ext = extractFileExtension(fileName) || badge.extension;
  const isImage = isImageMimeType(resolvedMime, fileName);
  const isPdf = resolvedMime === 'application/pdf' || ext === 'pdf';

  // PDF viewer state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null);
  const renderTaskRef = useRef<{ cancel?: () => void } | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number>(0);
  const [pdfPageNum, setPdfPageNum] = useState<number>(1);
  const [pdfStatus, setPdfStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Rich document viewer state (DOCX / XLSX / CSV / PPTX / ODT / RTF / TXT)
  const [parsedPreview, setParsedPreview] = useState<ParsedPreview>({ type: 'loading' });
  const [activeSheetIdx, setActiveSheetIdx] = useState<number>(0);
  const [paperTheme, setPaperTheme] = useState<'light' | 'dark'>('light');
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // 1. PDF lifecycle loader
  useEffect(() => {
    if (!isPdf || !dataUrl) return;
    let cancelled = false;

    const cleanupPdf = async () => {
      if (renderTaskRef.current?.cancel) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
      renderTaskRef.current = null;
      if (pdfDocRef.current) {
        try {
          await pdfDocRef.current.destroy();
        } catch {}
        pdfDocRef.current = null;
      }
    };

    const initPdf = async () => {
      setPdfStatus('loading');
      setPdfPageNum(1);
      setPdfNumPages(0);
      await cleanupPdf();

      try {
        const bytes = dataUrlToUint8Array(dataUrl);
        const doc = await loadPdfDocument(bytes);
        if (cancelled) {
          await doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        setPdfNumPages(doc.numPages || 1);
        setPdfStatus('ready');
      } catch {
        if (!cancelled) {
          setPdfStatus('error');
        }
      }
    };

    initPdf();
    return () => {
      cancelled = true;
      cleanupPdf();
    };
  }, [isPdf, dataUrl]);

  // 2. Render active PDF page to canvas cleanly on page change / zoom change
  useEffect(() => {
    if (!isPdf || pdfStatus !== 'ready' || !pdfDocRef.current || !canvasRef.current) return;
    let cancelled = false;

    const renderPage = async () => {
      if (renderTaskRef.current?.cancel) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }

      try {
        const doc = pdfDocRef.current;
        if (!doc) return;
        const page = await doc.getPage(pdfPageNum);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Render sharply with device pixel ratio and current zoom cap so canvas stays crisp without OOM
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const renderScale = Math.min(3.5, Math.max(1.25, zoomScale * 1.35)) * dpr;
        const viewport = page.getViewport({ scale: renderScale });

        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        page.cleanup();
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException' && !cancelled) {
          setPdfStatus('error');
        }
      }
    };

    renderPage();
    return () => {
      cancelled = true;
      if (renderTaskRef.current?.cancel) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [isPdf, pdfStatus, pdfPageNum, zoomScale]);

  // 3. Non-image, non-PDF rich document parsing
  useEffect(() => {
    if (isImage || isPdf || !dataUrl) return;
    let cancelled = false;

    const parseDocument = async () => {
      setParsedPreview({ type: 'loading' });
      setActiveSheetIdx(0);

      try {
        const bytes = dataUrlToUint8Array(dataUrl);

        if (
          resolvedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          resolvedMime === 'application/vnd.ms-word.document.macroEnabled.12' ||
          ext === 'docx' ||
          ext === 'docm'
        ) {
          const docx = await convertDocxToSafeHtml(bytes);
          if (!cancelled) {
            setParsedPreview({
              type: 'docx',
              html: docx.html,
              plainText: docx.plainText,
              wordCount: docx.wordCount,
            });
          }
          return;
        }

        if (resolvedMime === 'application/vnd.oasis.opendocument.text' || ext === 'odt') {
          const text = await extractOdtPlainText(bytes);
          if (!cancelled) {
            setParsedPreview({ type: 'text', text, mono: false });
          }
          return;
        }

        if (resolvedMime === 'application/rtf' || resolvedMime === 'text/rtf' || ext === 'rtf') {
          const raw = decodeBytesToText(bytes);
          const text = extractPlainTextFromRtf(raw);
          if (!cancelled) {
            setParsedPreview({ type: 'text', text: text || raw, mono: false });
          }
          return;
        }

        if (
          resolvedMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          resolvedMime === 'application/vnd.oasis.opendocument.spreadsheet' ||
          ext === 'xlsx' ||
          ext === 'ods'
        ) {
          const sheets = await extractSpreadsheetFromZipOffice(
            bytes,
            ext === 'ods' || resolvedMime.includes('opendocument.spreadsheet') ? 'ods' : 'xlsx'
          );
          if (!cancelled) {
            if (sheets.length > 0) {
              const activeText = sheets[0].rows.map((r) => r.join('\t')).join('\n');
              setParsedPreview({ type: 'spreadsheet', sheets, activeText });
            } else {
              setParsedPreview({ type: 'binary', reason: 'Empty spreadsheet workbook.' });
            }
          }
          return;
        }

        if (resolvedMime === 'text/csv' || resolvedMime === 'text/tab-separated-values' || ext === 'csv' || ext === 'tsv') {
          const raw = decodeBytesToText(bytes);
          const delimiter = ext === 'tsv' || resolvedMime === 'text/tab-separated-values' ? '\t' : ',';
          const rows = parseCsvRows(raw, delimiter);
          if (!cancelled) {
            if (rows.length > 0) {
              setParsedPreview({
                type: 'spreadsheet',
                sheets: [{ name: badge.shortLabel, rows }],
                activeText: raw,
              });
            } else {
              setParsedPreview({ type: 'text', text: raw, mono: true });
            }
          }
          return;
        }

        if (
          resolvedMime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
          ext === 'pptx'
        ) {
          const slides = await extractPptxSlides(bytes);
          if (!cancelled) {
            if (slides.length > 0) {
              const plainText = slides
                .map((s) => `Slide ${s.slideNumber}\n${s.lines.join('\n')}`)
                .join('\n\n');
              setParsedPreview({ type: 'slides', slides, plainText });
            } else {
              setParsedPreview({ type: 'binary', reason: 'No slide text extracted.' });
            }
          }
          return;
        }

        if (
          resolvedMime.startsWith('text/') ||
          resolvedMime === 'application/json' ||
          resolvedMime === 'application/xml' ||
          resolvedMime === 'application/yaml' ||
          ext === 'txt' ||
          ext === 'md' ||
          ext === 'markdown' ||
          ext === 'json' ||
          ext === 'xml' ||
          ext === 'yaml' ||
          ext === 'yml' ||
          ext === 'log'
        ) {
          let text = decodeBytesToText(bytes);
          if (resolvedMime === 'application/json' || ext === 'json') {
            try {
              text = JSON.stringify(JSON.parse(text), null, 2);
            } catch {}
          }
          const isMono = ext === 'json' || ext === 'xml' || ext === 'yaml' || ext === 'yml' || ext === 'log' || ext === 'html';
          if (!cancelled) {
            setParsedPreview({ type: 'text', text, mono: isMono });
          }
          return;
        }

        if (!cancelled) {
          setParsedPreview({ type: 'binary' });
        }
      } catch {
        if (!cancelled) {
          setParsedPreview({
            type: 'binary',
            reason: 'In-app preview is unavailable for this file formatting. Save a copy to view natively.',
          });
        }
      }
    };

    parseDocument();
    return () => {
      cancelled = true;
    };
  }, [isImage, isPdf, dataUrl, resolvedMime, ext, badge.shortLabel]);

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {}
  };

  // ==================== IMAGE VIEW ====================
  if (isImage) {
    return (
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale}) rotate(${viewRotation}deg)`,
          transition: isPanning ? 'none' : 'transform 0.15s ease-out',
        }}
        className="max-h-full max-w-full flex items-center justify-center select-none shadow-2xl rounded-lg overflow-hidden border border-zinc-800/60"
      >
        <img
          src={dataUrl}
          alt={fileName || 'Document page'}
          className="max-h-[calc(100vh-170px)] sm:max-h-[calc(100vh-160px)] max-w-[95vw] sm:max-w-[90vw] object-contain pointer-events-none select-none"
          draggable={false}
        />
      </div>
    );
  }

  // ==================== PDF VIEW ====================
  if (isPdf) {
    if (pdfStatus === 'error') {
      return (
        <BinaryFallbackCard
          badge={badge}
          fileName={fileName}
          fileSize={fileSize}
          reason="This PDF is password-protected or uses an unsupported PDF encoding. Download it to open with your system PDF reader."
          onDownload={onDownload}
        />
      );
    }

    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
        {pdfStatus === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Rendering PDF document...</span>
          </div>
        )}

        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale}) rotate(${viewRotation}deg)`,
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
          className={`${pdfStatus === 'ready' ? 'flex' : 'hidden'} items-center justify-center select-none shadow-2xl rounded-lg overflow-hidden border border-zinc-800/70 bg-white`}
        >
          <canvas
            ref={canvasRef}
            className="max-h-[calc(100vh-210px)] sm:max-h-[calc(100vh-195px)] max-w-[95vw] sm:max-w-[88vw] w-auto h-auto pointer-events-none select-none"
          />
        </div>

        {pdfStatus === 'ready' && pdfNumPages > 1 && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 backdrop-blur-md shadow-2xl text-xs text-zinc-200 z-20"
          >
            <button
              type="button"
              disabled={pdfPageNum <= 1}
              onClick={() => setPdfPageNum((p) => Math.max(1, p - 1))}
              className="p-1 rounded-full hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
              title="Previous PDF page"
              aria-label="Previous PDF page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-semibold text-[11px] px-1 whitespace-nowrap">
              PDF {pdfPageNum} / {pdfNumPages}
            </span>
            <button
              type="button"
              disabled={pdfPageNum >= pdfNumPages}
              onClick={() => setPdfPageNum((p) => Math.min(pdfNumPages, p + 1))}
              className="p-1 rounded-full hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
              title="Next PDF page"
              aria-label="Next PDF page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==================== WORD / SPREADSHEET / TEXT / PRESENTATION READERS ====================
  if (parsedPreview.type === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 text-zinc-400">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Preparing offline reader...</span>
      </div>
    );
  }

  if (parsedPreview.type === 'binary') {
    return (
      <BinaryFallbackCard
        badge={badge}
        fileName={fileName}
        fileSize={fileSize}
        reason={parsedPreview.reason}
        onDownload={onDownload}
      />
    );
  }

  const fontSizePx = Math.round(14 * Math.max(0.75, Math.min(2.2, zoomScale)));
  const isLightPaper = paperTheme === 'light';

  if (parsedPreview.type === 'docx') {
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-full h-full flex flex-col max-w-4xl mx-auto rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-zinc-900/95 border-b border-zinc-800 shrink-0 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`}>
              {badge.shortLabel}
            </span>
            <span className="text-zinc-400 font-mono text-[11px] truncate">
              {parsedPreview.wordCount} words
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleCopyText(parsedPreview.plainText)}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors text-[11px] font-medium"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
            </button>
            <button
              type="button"
              onClick={() => setPaperTheme(isLightPaper ? 'dark' : 'light')}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer transition-colors"
              title="Toggle paper appearance"
              aria-label="Toggle paper appearance"
            >
              {isLightPaper ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div
          className={`flex-1 overflow-y-auto p-5 sm:p-8 select-text transition-colors ${
            isLightPaper ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-zinc-100'
          }`}
          style={{ fontSize: `${fontSizePx}px` }}
        >
          {parsedPreview.html ? (
            <div
              className={`max-w-none leading-relaxed break-words
                [&_h1]:text-[1.6em] [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                [&_h2]:text-[1.35em] [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2
                [&_h3]:text-[1.15em] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5
                [&_p]:my-2.5
                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
                [&_li]:my-1
                [&_blockquote]:border-l-4 [&_blockquote]:border-purple-500/60 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:opacity-85 [&_blockquote]:my-3
                [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-[0.9em]
                [&_th]:border [&_td]:border [&_th]:px-2.5 [&_th]:py-1.5 [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:font-semibold [&_th]:text-left
                ${
                  isLightPaper
                    ? '[&_th]:border-zinc-300 [&_td]:border-zinc-300 [&_th]:bg-zinc-100'
                    : '[&_th]:border-zinc-700 [&_td]:border-zinc-800 [&_th]:bg-zinc-900'
                }
              `}
              dangerouslySetInnerHTML={{ __html: parsedPreview.html }}
            />
          ) : (
            <p className="text-sm opacity-60 italic">No readable body content found in this Word file.</p>
          )}
        </div>
      </div>
    );
  }

  if (parsedPreview.type === 'spreadsheet') {
    const activeSheet = parsedPreview.sheets[activeSheetIdx] || parsedPreview.sheets[0];
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-full h-full flex flex-col max-w-5xl mx-auto rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 text-xs overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`}>
              {badge.shortLabel}
            </span>
            {parsedPreview.sheets.map((sh, i) => (
              <button
                key={`${sh.name}_${i}`}
                type="button"
                onClick={() => setActiveSheetIdx(i)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeSheetIdx === i
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {sh.name}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-mono text-zinc-400 shrink-0">
            {activeSheet.rows.length} rows
          </span>
        </div>

        <div className="flex-1 overflow-auto select-text" style={{ fontSize: `${Math.max(11, fontSizePx - 1)}px` }}>
          <table className="w-full border-collapse text-left text-zinc-200">
            <tbody>
              {activeSheet.rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={
                    rIdx === 0
                      ? 'bg-zinc-900/95 font-semibold text-white sticky top-0 z-10'
                      : rIdx % 2 === 1
                      ? 'bg-zinc-950'
                      : 'bg-zinc-900/35'
                  }
                >
                  <td className="border border-zinc-800/80 px-2 py-1.5 text-[10px] font-mono text-zinc-500 select-none text-right w-9">
                    {rIdx + 1}
                  </td>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="border border-zinc-800/80 px-2.5 py-1.5 whitespace-pre-wrap min-w-[72px] max-w-[320px]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (parsedPreview.type === 'slides') {
    return (
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className="w-full h-full flex flex-col max-w-4xl mx-auto rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`}>
              {badge.shortLabel}
            </span>
            <span className="text-zinc-400 font-mono text-[11px]">
              {parsedPreview.slides.length} {parsedPreview.slides.length === 1 ? 'slide' : 'slides'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopyText(parsedPreview.plainText)}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5 cursor-pointer text-[11px] font-medium"
          >
            {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 select-text" style={{ fontSize: `${fontSizePx}px` }}>
          {parsedPreview.slides.map((slide) => (
            <div
              key={slide.slideNumber}
              className="p-4 sm:p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 shadow-sm"
            >
              <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded">
                Slide {slide.slideNumber}
              </span>
              {slide.lines.length > 0 ? (
                <div className="space-y-1.5 text-zinc-200 leading-relaxed">
                  {slide.lines.map((line, idx) => (
                    <p key={idx} className={idx === 0 ? 'font-bold text-white text-[1.1em]' : ''}>
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 italic">Visual slide without readable text elements</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Plain Text / Markdown / ODT / RTF / JSON Reader
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="w-full h-full flex flex-col max-w-4xl mx-auto rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold border ${badge.badgeBg} ${badge.badgeText} ${badge.badgeBorder}`}>
            {badge.shortLabel}
          </span>
          {fileName && <span className="text-zinc-400 truncate text-[11px]">{fileName}</span>}
        </div>
        <button
          type="button"
          onClick={() => handleCopyText(parsedPreview.text)}
          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1.5 cursor-pointer text-[11px] font-medium shrink-0"
        >
          {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
        </button>
      </div>

      <pre
        className={`flex-1 overflow-auto p-4 sm:p-6 text-zinc-200 whitespace-pre-wrap break-words leading-relaxed select-text ${
          parsedPreview.mono ? 'font-mono' : 'font-sans'
        }`}
        style={{ fontSize: `${fontSizePx}px` }}
      >
        {parsedPreview.text || 'Empty document'}
      </pre>
    </div>
  );
};

interface BinaryFallbackCardProps {
  badge: ReturnType<typeof getFileTypeBadge>;
  fileName?: string;
  fileSize?: number;
  reason?: string;
  onDownload: () => void;
}

const BinaryFallbackCard: React.FC<BinaryFallbackCardProps> = ({
  badge,
  fileName,
  fileSize,
  reason,
  onDownload,
}) => (
  <div
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
    onTouchStart={(e) => e.stopPropagation()}
    className="w-full max-w-md mx-auto p-6 rounded-2xl bg-zinc-900/95 border border-zinc-800 text-center space-y-4 shadow-2xl"
  >
    <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center gap-1 shadow-inner">
      <FileText className="w-6 h-6 text-purple-400" />
      <span className={`text-[10px] font-mono font-bold px-1.5 rounded ${badge.badgeText}`}>
        {badge.shortLabel}
      </span>
    </div>

    <div className="space-y-1">
      <h3 className="text-sm font-bold text-white break-all">{fileName || badge.label}</h3>
      <p className="text-xs text-zinc-400">
        {badge.label}
        {fileSize ? ` • ${formatBytes(fileSize)}` : ''}
      </p>
    </div>

    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
      <Lock className="w-3 h-3" />
      <span>AES-256-GCM Encrypted Offline</span>
    </div>

    <p className="text-xs text-zinc-400 leading-relaxed">
      {reason ||
        'Direct in-app rendering is unavailable for this legacy/binary file format. Save a copy to open it with an app on your device.'}
    </p>

    <button
      type="button"
      onClick={onDownload}
      className="w-full py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
    >
      <Download className="w-4 h-4" />
      <span>Save Copy to Open Natively</span>
    </button>
  </div>
);
