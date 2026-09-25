import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Plus,
  Trash2,
  Star,
  Info,
  Download,
  Edit2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { DocumentDetail, DocumentCategoryType } from '../../types';
import { getCategoryConfig, formatBytes, DOCUMENT_CATEGORIES } from './documentUtils';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useHorizontalScroll } from '../../utils/useHorizontalScroll';

interface DocumentViewerModalProps {
  documentId: string | null;
  onClose: () => void;
  onAddPage: (docId: string) => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  documentId,
  onClose,
  onAddPage,
}) => {
  const {
    getDocumentDetail,
    getDocumentPageData,
    deleteDocument,
    deleteDocumentPage,
    reorderDocumentPages,
    toggleDocumentFavorite,
    saveDocument,
    showToast,
  } = useVault();

  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [activeImageData, setActiveImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Zoom and pan state
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewRotation, setViewRotation] = useState<number>(0);

  // Touch gesture refs (pinch-to-zoom & double-tap)
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  // UI Drawer / Modal states
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(false);
  const [showDeleteDocConfirm, setShowDeleteDocConfirm] = useState<boolean>(false);
  const [showDeletePageConfirm, setShowDeletePageConfirm] = useState<boolean>(false);
  const [isEditingMetadata, setIsEditingMetadata] = useState<boolean>(false);

  // Mouse wheel horizontal scrolling for thumbnails
  const { scrollRef: thumbnailsScrollRef } = useHorizontalScroll<HTMLDivElement>();

  // Edit metadata form state
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentCategoryType>('other');
  const [editDescription, setEditDescription] = useState('');
  const [editDocDate, setEditDocDate] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');

  // Load document details
  const loadDocument = useCallback(async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const detail = await getDocumentDetail(documentId);
      setDocumentDetail(detail);

      // Populate edit form initial values
      setEditTitle(detail.metadata.title);
      setEditCategory(detail.metadata.doc_type as DocumentCategoryType);
      setEditDescription(detail.metadata.description || '');
      setEditDocDate(detail.metadata.document_date || '');
      setEditExpiryDate(detail.metadata.expiry_date || '');
      setEditTags(detail.metadata.tags || []);

      if (detail.pages.length > 0) {
        // Load first page full decrypted image
        const safeIndex = Math.min(currentPageIndex, detail.pages.length - 1);
        const pageId = detail.pages[safeIndex].id;
        const dataUrl = await getDocumentPageData(pageId);
        setActiveImageData(dataUrl);
      }
    } catch (err: any) {
      showToast(err?.toString() || 'Failed to load document', 'error');
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [documentId, getDocumentDetail, getDocumentPageData, currentPageIndex, showToast, onClose]);

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  // Load specific page when page index changes
  const switchPage = async (index: number) => {
    if (!documentDetail || index < 0 || index >= documentDetail.pages.length) return;
    setCurrentPageIndex(index);
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setViewRotation(0);

    const page = documentDetail.pages[index];
    try {
      const dataUrl = await getDocumentPageData(page.id);
      setActiveImageData(dataUrl);
    } catch (err: any) {
      showToast('Failed to load page image', 'error');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditingMetadata) setIsEditingMetadata(false);
        else if (showDeleteDocConfirm) setShowDeleteDocConfirm(false);
        else if (showDeletePageConfirm) setShowDeletePageConfirm(false);
        else onClose();
      } else if (e.key === 'ArrowRight' && !isEditingMetadata) {
        if (documentDetail && currentPageIndex < documentDetail.pages.length - 1) {
          switchPage(currentPageIndex + 1);
        }
      } else if (e.key === 'ArrowLeft' && !isEditingMetadata) {
        if (currentPageIndex > 0) {
          switchPage(currentPageIndex - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentDetail, currentPageIndex, isEditingMetadata, showDeleteDocConfirm, showDeletePageConfirm, onClose]);

  // Zoom controls
  const handleZoomIn = () => setZoomScale((s) => Math.min(4, s + 0.25));
  const handleZoomOut = () => setZoomScale((s) => Math.max(0.5, s - 0.25));
  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setViewRotation(0);
  };

  // Mouse pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Touch controls: 2-finger pinch-to-zoom & 1-finger pan & double-tap toggle zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      lastTouchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
        // Double tap: toggle between 1x and 2.5x zoom
        setZoomScale((prev) => {
          if (prev > 1.2) {
            setPanOffset({ x: 0, y: 0 });
            return 1;
          }
          return 2.5;
        });
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      if (zoomScale > 1) {
        setIsPanning(true);
        const t = e.touches[0];
        panStartRef.current = { x: t.clientX - panOffset.x, y: t.clientY - panOffset.y };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistanceRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (dist > 10 && lastTouchDistanceRef.current > 10) {
        const factor = dist / lastTouchDistanceRef.current;
        lastTouchDistanceRef.current = dist;
        setZoomScale((prev) => Math.max(0.6, Math.min(4, prev * factor)));
      }
    } else if (e.touches.length === 1 && isPanning && zoomScale > 1) {
      const t = e.touches[0];
      setPanOffset({
        x: t.clientX - panStartRef.current.x,
        y: t.clientY - panStartRef.current.y,
      });
    }
  };

  const handleTouchEnd = () => {
    lastTouchDistanceRef.current = null;
    setIsPanning(false);
  };

  // Favorite toggle
  const handleToggleFavorite = async () => {
    if (!documentDetail) return;
    await toggleDocumentFavorite(documentDetail.metadata.id);
    setDocumentDetail((prev) =>
      prev
        ? {
            ...prev,
            metadata: { ...prev.metadata, favorite: !prev.metadata.favorite },
          }
        : null
    );
  };

  // Delete page action
  const handleDeletePage = async () => {
    if (!documentDetail || documentDetail.pages.length <= 1) {
      showToast('Cannot delete the only page in document', 'error');
      return;
    }

    const pageId = documentDetail.pages[currentPageIndex].id;
    try {
      await deleteDocumentPage(pageId);
      setShowDeletePageConfirm(false);
      const nextIndex = Math.max(0, currentPageIndex - 1);
      setCurrentPageIndex(nextIndex);
      await loadDocument();
    } catch (err: any) {
      showToast('Failed to delete page', 'error');
    }
  };

  // Reorder page action
  const handleMovePage = async (direction: 'left' | 'right') => {
    if (!documentDetail || documentDetail.pages.length <= 1) return;

    const newPages = [...documentDetail.pages];
    const targetIdx = direction === 'left' ? currentPageIndex - 1 : currentPageIndex + 1;
    if (targetIdx < 0 || targetIdx >= newPages.length) return;

    const [moved] = newPages.splice(currentPageIndex, 1);
    newPages.splice(targetIdx, 0, moved);

    const orderedIds = newPages.map((p) => p.id);
    try {
      await reorderDocumentPages(documentDetail.metadata.id, orderedIds);
      setCurrentPageIndex(targetIdx);
      await loadDocument();
    } catch (err: any) {
      showToast('Failed to reorder pages', 'error');
    }
  };

  // Delete entire document action
  const handleDeleteDocument = async () => {
    if (!documentDetail) return;
    try {
      await deleteDocument(documentDetail.metadata.id);
      setShowDeleteDocConfirm(false);
      onClose();
    } catch (err: any) {
      showToast('Failed to delete document', 'error');
    }
  };

  // Save edited metadata
  const handleSaveMetadata = async () => {
    if (!documentDetail || !editTitle.trim()) {
      showToast('Document title is required', 'error');
      return;
    }

    try {
      await saveDocument({
        id: documentDetail.metadata.id,
        title: editTitle.trim(),
        doc_type: editCategory,
        description: editDescription.trim(),
        tags: editTags,
        document_date: editDocDate || undefined,
        expiry_date: editExpiryDate || undefined,
        favorite: documentDetail.metadata.favorite,
        pages: [], // Backend updates metadata without replacing existing pages when pages is empty
      });
      setIsEditingMetadata(false);
      await loadDocument();
      showToast('Document details updated', 'success');
    } catch (err: any) {
      showToast('Failed to update document metadata', 'error');
    }
  };

  // Export current page decrypted image to local filesystem
  const handleExportPage = async () => {
    if (!activeImageData || !documentDetail) return;

    const filename = `${documentDetail.metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_p${
      currentPageIndex + 1
    }.jpg`;

    try {
      let selectedPath = await save({
        defaultPath: filename,
        filters: [{ name: 'JPEG Image (*.jpg)', extensions: ['jpg', 'jpeg'] }],
      });

      if (!selectedPath) return;

      const base64Data = activeImageData.includes(',')
        ? activeImageData.split(',')[1]
        : activeImageData;

      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      await writeFile(selectedPath, bytes);
      showToast('Page exported successfully', 'success');
    } catch (err: any) {
      showToast(err?.toString() || 'Failed to export image', 'error');
    }
  };

  if (!documentId) return null;

  const categoryConfig = documentDetail ? getCategoryConfig(documentDetail.metadata.doc_type) : null;
  const CategoryIcon = categoryConfig?.icon || FileText;

  // Check if document has expired
  const isExpired = documentDetail?.metadata.expiry_date
    ? new Date(documentDetail.metadata.expiry_date).getTime() < Date.now()
    : false;

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-screen h-[100dvh] max-h-[100dvh] bg-black/90 backdrop-blur-md select-none overflow-hidden animate-scale-up">
      {/* TOP NAVIGATION & CONTROLS BAR */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 bg-zinc-950/85 border-b border-zinc-800/80 backdrop-blur-lg shrink-0 z-20 pt-safe pl-safe pr-safe">
        {/* Left: Back / Title / Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Close Viewer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-xs sm:text-base font-semibold text-white truncate max-w-[140px] min-[380px]:max-w-[180px] sm:max-w-md">
                {documentDetail?.metadata.title || 'Loading document...'}
              </h2>
              {categoryConfig && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium border bg-purple-500/15 text-purple-300 border-purple-500/30 shrink-0"
                >
                  <CategoryIcon className="w-3 h-3 stroke-[1.75]" />
                  <span className="hidden min-[420px]:inline">{categoryConfig.label}</span>
                </span>
              )}
              {isExpired && (
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  Expired
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-xs text-zinc-400 truncate">
              {documentDetail
                ? `Page ${currentPageIndex + 1} of ${documentDetail.pages.length}`
                : 'Decrypting...'}
            </p>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Zoom Controls (Responsive: visible on both mobile & desktop) */}
          <div className="flex items-center bg-zinc-900/80 border border-zinc-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 sm:px-2 py-1 text-[10px] sm:text-[11px] font-mono font-medium text-zinc-300 hover:text-white cursor-pointer"
              title="Reset Zoom"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 sm:p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotate */}
          <button
            type="button"
            onClick={() => setViewRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Favorite */}
          <button
            type="button"
            onClick={handleToggleFavorite}
            className={`p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 transition-colors cursor-pointer ${
              documentDetail?.metadata.favorite
                ? 'text-amber-400'
                : 'text-zinc-400 hover:text-white'
            }`}
            title="Favorite"
          >
            <Star className={`w-4 h-4 ${documentDetail?.metadata.favorite ? 'fill-amber-400' : ''}`} />
          </button>

          {/* Export Page */}
          <button
            type="button"
            onClick={handleExportPage}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Export Decrypted Page"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Toggle Info Panel */}
          <button
            type="button"
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              showInfoPanel
                ? 'bg-purple-600 text-white'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title="Document Info"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-0.5"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CENTER VIEWPORT: HIGH-RES DOCUMENT CANVAS/IMAGE */}
      <div
        className="flex-1 min-h-0 w-full relative overflow-hidden flex items-center justify-center p-2 sm:p-4 bg-zinc-950 select-none touch-none cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Decrypting document image...</span>
          </div>
        ) : activeImageData ? (
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale}) rotate(${viewRotation}deg)`,
              transition: isPanning ? 'none' : 'transform 0.15s ease-out',
            }}
            className="max-h-full max-w-full flex items-center justify-center select-none shadow-2xl rounded-lg overflow-hidden border border-zinc-800/60"
          >
            <img
              src={activeImageData}
              alt={`Document Page ${currentPageIndex + 1}`}
              className="max-h-[calc(100vh-170px)] sm:max-h-[calc(100vh-160px)] max-w-[95vw] sm:max-w-[90vw] object-contain pointer-events-none select-none"
              draggable={false}
            />
          </div>
        ) : (
          <div className="text-zinc-500 text-xs">No image data available for this page</div>
        )}

        {/* Left / Right Chevron Nav Overlay */}
        {documentDetail && documentDetail.pages.length > 1 && (
          <>
            {currentPageIndex > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  switchPage(currentPageIndex - 1);
                }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white backdrop-blur-md border border-zinc-700/60 shadow-xl transition-all cursor-pointer z-10"
                title="Previous Page"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}

            {currentPageIndex < documentDetail.pages.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  switchPage(currentPageIndex + 1);
                }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 sm:p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white backdrop-blur-md border border-zinc-700/60 shadow-xl transition-all cursor-pointer z-10"
                title="Next Page"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </>
        )}

        {/* SIDE / BOTTOM SHEET INFO & EDIT DRAWER */}
        {showInfoPanel && documentDetail && (
          <div className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-96 max-h-[85dvh] sm:max-h-full bg-zinc-900/98 sm:bg-zinc-900/95 border-t sm:border-t-0 sm:border-l border-zinc-800 rounded-t-2xl sm:rounded-none backdrop-blur-2xl p-4 sm:p-5 overflow-y-auto space-y-4 shadow-2xl z-30 animate-scale-up pt-safe pb-safe pl-safe pr-safe">
            {/* Mobile drag handle */}
            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto -mt-1 mb-2 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Document Information</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                  title="Edit Metadata"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowInfoPanel(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isEditingMetadata ? (
              <div className="space-y-3.5 text-xs text-zinc-300">
                <div>
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                    Title
                  </span>
                  <span className="font-semibold text-white text-sm">
                    {documentDetail.metadata.title}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                    Category
                  </span>
                  <span className="capitalize">{documentDetail.metadata.doc_type}</span>
                </div>

                {documentDetail.metadata.document_date && (
                  <div>
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                      Document Date
                    </span>
                    <span>{documentDetail.metadata.document_date}</span>
                  </div>
                )}

                {documentDetail.metadata.expiry_date && (
                  <div>
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                      Expiry Date
                    </span>
                    <span className={isExpired ? 'text-rose-400 font-bold' : ''}>
                      {documentDetail.metadata.expiry_date} {isExpired && '(Expired)'}
                    </span>
                  </div>
                )}

                {documentDetail.metadata.tags && documentDetail.metadata.tags.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                      Tags
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {documentDetail.metadata.tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 text-[11px]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {documentDetail.metadata.description && (
                  <div>
                    <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                      Description / Notes
                    </span>
                    <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                      {documentDetail.metadata.description}
                    </p>
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500 space-y-1">
                  <div>Pages: {documentDetail.pages.length}</div>
                  {documentDetail.pages[currentPageIndex] && (
                    <div>
                      Current Page Dimensions:{' '}
                      {documentDetail.pages[currentPageIndex].width} &times;{' '}
                      {documentDetail.pages[currentPageIndex].height} px (
                      {formatBytes(documentDetail.pages[currentPageIndex].file_size)})
                    </div>
                  )}
                  <div>Encrypted with AES-256-GCM</div>
                </div>

                {/* Danger Zone: Delete Entire Document */}
                <div className="pt-4 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowDeleteDocConfirm(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Entire Document</span>
                  </button>
                </div>
              </div>
            ) : (
              /* EDIT METADATA FORM */
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as DocumentCategoryType)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500"
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Document Date
                    </label>
                    <input
                      type="date"
                      value={editDocDate}
                      onChange={(e) => setEditDocDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="date"
                      value={editExpiryDate}
                      onChange={(e) => setEditExpiryDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5 text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {editTags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] flex items-center gap-1"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => setEditTags(editTags.filter((tag) => tag !== t))}
                          className="hover:text-rose-400"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={editTagInput}
                      onChange={(e) => setEditTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = editTagInput.trim().toLowerCase();
                          if (val && !editTags.includes(val)) {
                            setEditTags([...editTags, val]);
                            setEditTagInput('');
                          }
                        }
                      }}
                      placeholder="Add tag and hit Enter..."
                      className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Description / Notes
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white text-xs resize-none"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingMetadata(false)}
                    className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* BOTTOM TOOLBAR: MULTI-PAGE THUMBNAIL CAROUSEL & PAGE ACTIONS */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-zinc-950/85 border-t border-zinc-800/80 backdrop-blur-lg shrink-0 z-20 flex flex-col sm:flex-row items-center justify-between gap-2 pb-safe pl-safe pr-safe">
        {/* Thumbnails strip */}
        <div ref={thumbnailsScrollRef} className="flex items-center gap-2 overflow-x-auto max-w-full sm:max-w-xl py-1 scrollbar-none select-none">
          {documentDetail?.pages.map((page, idx) => (
            <button
              key={page.id}
              type="button"
              onClick={() => switchPage(idx)}
              className={`relative shrink-0 w-11 sm:w-12 h-14 sm:h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer bg-black ${
                currentPageIndex === idx
                  ? 'border-purple-500 scale-105 shadow-md shadow-purple-500/20'
                  : 'border-zinc-800 opacity-60 hover:opacity-100'
              }`}
              title={`Jump to Page ${idx + 1}`}
            >
              {page.thumbnail_data ? (
                <img
                  src={page.thumbnail_data}
                  alt={`Thumb ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">
                  p.{idx + 1}
                </div>
              )}
              <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-bold text-center text-white py-0.5">
                {idx + 1}
              </span>
            </button>
          ))}

          {/* Add Page Button */}
          {documentDetail && (
            <button
              type="button"
              onClick={() => onAddPage(documentDetail.metadata.id)}
              className="shrink-0 w-11 sm:w-12 h-14 sm:h-16 rounded-lg border-2 border-dashed border-zinc-700 hover:border-purple-500/80 bg-zinc-900/60 hover:bg-zinc-800 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-purple-400 transition-colors cursor-pointer"
              title="Add Page to this Document"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[9px] font-semibold">+ Page</span>
            </button>
          )}
        </div>

        {/* Page management tools */}
        {documentDetail && (
          <div className="flex items-center gap-2 text-xs shrink-0">
            {/* Move Page Left / Right */}
            {documentDetail.pages.length > 1 && (
              <div className="flex items-center bg-zinc-900/80 border border-zinc-800 rounded-xl p-0.5">
                <button
                  type="button"
                  disabled={currentPageIndex === 0}
                  onClick={() => handleMovePage('left')}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Move Page Earlier"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[10px] text-zinc-400 font-mono">Reorder</span>
                <button
                  type="button"
                  disabled={currentPageIndex === documentDetail.pages.length - 1}
                  onClick={() => handleMovePage('right')}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                  title="Move Page Later"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Delete Current Page */}
            {documentDetail.pages.length > 1 && (
              <button
                type="button"
                onClick={() => setShowDeletePageConfirm(true)}
                className="py-1.5 px-2.5 rounded-xl bg-zinc-900/80 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Delete This Page"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Page</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* CONFIRM DELETE ENTIRE DOCUMENT MODAL */}
      {showDeleteDocConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-5 border border-zinc-800 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Document?</h3>
                <p className="text-xs text-zinc-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              All pages and encrypted files associated with{' '}
              <strong className="text-white">"{documentDetail?.metadata.title}"</strong> will be
              permanently removed from your vault database.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteDocConfirm(false)}
                className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SINGLE PAGE MODAL */}
      {showDeletePageConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-5 border border-zinc-800 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Page {currentPageIndex + 1}?</h3>
                <p className="text-xs text-zinc-400">Remove page from this document</p>
              </div>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to delete Page {currentPageIndex + 1}? The remaining pages will
              be automatically reordered.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeletePageConfirm(false)}
                className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePage}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
              >
                Delete Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
