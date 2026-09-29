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
  Pencil,
  ArrowLeft,
  ArrowRight,
  MoreVertical,
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import { DocumentDetail } from '../../types';
import { getCategoryConfig, getDocumentExpiryDisplay } from './documentUtils';
import { formatDisplayDate, getDualDateInfo } from '../../utils/nepaliCalendar';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useHorizontalScroll } from '../../utils/useHorizontalScroll';
import { DocumentEditModal } from './DocumentEditModal';

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
    showToast,
    calendarPreference,
    numeralPreference,
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
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);

  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Mouse wheel horizontal scrolling for thumbnails
  const { scrollRef: thumbnailsScrollRef } = useHorizontalScroll<HTMLDivElement>();

  // Close mobile dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setShowMobileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Load document details
  const loadDocument = useCallback(async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const detail = await getDocumentDetail(documentId);
      setDocumentDetail(detail);

      if (detail.pages.length > 0) {
        const safeIndex = Math.min(currentPageIndex, detail.pages.length - 1);
        const pageId = detail.pages[safeIndex].id;
        const dataUrl = await getDocumentPageData(pageId);
        setActiveImageData(dataUrl);
      }
    } catch {
      showToast("Couldn't open this document.", 'error');
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [documentId, getDocumentDetail, getDocumentPageData, currentPageIndex, showToast, onClose]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

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
    } catch {
      showToast("Couldn't load page image.", 'error');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteDocConfirm) setShowDeleteDocConfirm(false);
        else if (showDeletePageConfirm) setShowDeletePageConfirm(false);
        else if (showInfoPanel) setShowInfoPanel(false);
        else onClose();
      } else if (e.key === 'ArrowRight' && !isEditing) {
        if (documentDetail && currentPageIndex < documentDetail.pages.length - 1) {
          switchPage(currentPageIndex + 1);
        }
      } else if (e.key === 'ArrowLeft' && !isEditing) {
        if (currentPageIndex > 0) {
          switchPage(currentPageIndex - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [documentDetail, currentPageIndex, isEditing, showDeleteDocConfirm, showDeletePageConfirm, showInfoPanel, onClose]);

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

  // Touch controls: 2-finger pinch-to-zoom & 1-finger pan & double-tap
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      lastTouchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 300) {
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

  // Delete single page action
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
    } catch {
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
    } catch {
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
    } catch {
      showToast("Couldn't delete the document.", 'error');
    }
  };

  // Download currently displayed decrypted page image to local filesystem
  const handleDownloadPage = async () => {
    if (!activeImageData || !documentDetail) return;

    const isMultiPage = documentDetail.pages.length > 1;
    const pageNum = currentPageIndex + 1;
    const cleanTitle = documentDetail.metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = isMultiPage ? `${cleanTitle}_p${pageNum}.jpg` : `${cleanTitle}.jpg`;

    try {
      const selectedPath = await save({
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
      showToast(isMultiPage ? `Page ${pageNum} downloaded` : 'Document downloaded', 'success');
    } catch (err: any) {
      showToast(err?.toString() || 'Failed to download image', 'error');
    }
  };

  if (!documentId) return null;

  const categoryConfig = documentDetail ? getCategoryConfig(documentDetail.metadata.doc_type) : null;
  const expiryInfo = documentDetail ? getDocumentExpiryDisplay(documentDetail.metadata.expiry_date) : null;
  const isMultiPage = (documentDetail?.pages.length ?? 1) > 1;
  const downloadLabel = isMultiPage ? 'Download Page' : 'Download';

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-screen h-[100dvh] max-h-[100dvh] bg-black/95 backdrop-blur-md select-none overflow-hidden animate-scale-up">
      {/* TOP HEADER: < Back | Title | [Edit] [Delete] */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-lg shrink-0 z-20 pt-safe pl-safe pr-safe">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Back to Documents"
            aria-label="Back to Documents"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 truncate">
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[150px] min-[380px]:max-w-[200px] sm:max-w-md">
                {documentDetail?.metadata.title || 'Loading...'}
              </h2>
              {categoryConfig && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 hidden min-[440px]:inline">
                  {categoryConfig.label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              {documentDetail
                ? `Page ${currentPageIndex + 1} of ${documentDetail.pages.length}`
                : 'Decrypting...'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 text-[11px] font-mono text-zinc-300 hover:text-white cursor-pointer"
              title="Reset Zoom"
            >
              {Math.round(zoomScale * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Rotate */}
          <button
            type="button"
            onClick={() => setViewRotation((r) => (r + 90) % 360)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Rotate 90°"
            aria-label="Rotate 90 degrees"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Desktop primary actions: [Edit] [Download] [Favorite] [Delete] [Info] */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="py-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs min-h-[36px]"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPage}
              className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors min-h-[36px]"
              title={isMultiPage ? `Download Page ${currentPageIndex + 1}` : 'Download Document'}
              aria-label={downloadLabel}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadLabel}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-zinc-800 ${
                documentDetail?.metadata.favorite ? 'text-amber-400' : 'text-zinc-400 hover:text-white'
              }`}
              title={documentDetail?.metadata.favorite ? 'Favorited' : 'Favorite'}
              aria-label="Favorite"
            >
              <Star className={`w-4 h-4 ${documentDetail?.metadata.favorite ? 'fill-amber-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteDocConfirm(true)}
              className="py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors min-h-[36px]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              type="button"
              onClick={() => setShowInfoPanel(!showInfoPanel)}
              className={`p-2 rounded-xl transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-zinc-800 ${
                showInfoPanel ? 'bg-purple-600 text-white' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white'
              }`}
              title="Document Info"
              aria-label="Document Info"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile 3-dot dropdown menu */}
          <div className="relative sm:hidden" ref={mobileMenuRef}>
            <button
              type="button"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="More options"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMobileMenu && (
              <div className="absolute right-0 mt-1.5 w-44 rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-1 z-30 animate-scale-up text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowInfoPanel(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-zinc-800 cursor-pointer text-left"
                >
                  <Info className="w-3.5 h-3.5 text-purple-400" />
                  <span>View Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setIsEditing(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-zinc-800 cursor-pointer text-left"
                >
                  <Pencil className="w-3.5 h-3.5 text-purple-400" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleDownloadPage();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-zinc-800 cursor-pointer text-left"
                >
                  <Download className="w-3.5 h-3.5 text-zinc-300" />
                  <span>{downloadLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    handleToggleFavorite();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-200 hover:bg-zinc-800 cursor-pointer text-left"
                >
                  <Star className={`w-3.5 h-3.5 ${documentDetail?.metadata.favorite ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'}`} />
                  <span>{documentDetail?.metadata.favorite ? 'Unfavorite' : 'Favorite'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowDeleteDocConfirm(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 cursor-pointer text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CENTER VIEWPORT: HERO DOCUMENT IMAGE */}
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
            <span className="text-xs">Loading page...</span>
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
              alt={`Page ${currentPageIndex + 1}`}
              className="max-h-[calc(100vh-170px)] sm:max-h-[calc(100vh-160px)] max-w-[95vw] sm:max-w-[90vw] object-contain pointer-events-none select-none"
              draggable={false}
            />
          </div>
        ) : (
          <div className="text-zinc-500 text-xs">No image available</div>
        )}

        {/* Previous / Next Page Overlay Arrows */}
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
                aria-label="Previous Page"
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
                aria-label="Next Page"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
          </>
        )}

        {/* METADATA INFO DRAWER */}
        {showInfoPanel && documentDetail && (
          <div className="fixed inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-96 max-h-[80dvh] sm:max-h-full bg-zinc-900/98 sm:bg-zinc-900/95 border-t sm:border-t-0 sm:border-l border-zinc-800 rounded-t-2xl sm:rounded-none backdrop-blur-2xl p-4 sm:p-5 overflow-y-auto space-y-4 shadow-2xl z-30 animate-scale-up pt-safe pb-safe pl-safe pr-safe">
            <div className="w-10 h-1 rounded-full bg-zinc-700 mx-auto -mt-1 mb-2 sm:hidden" />

            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white">Document Details</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-purple-400 hover:text-purple-300 cursor-pointer"
                  title="Edit Document"
                  aria-label="Edit Document"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowInfoPanel(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                  aria-label="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3.5 text-xs text-zinc-300">
              {/* Title & Type */}
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                  Title
                </span>
                <span className="font-bold text-white text-sm block">
                  {documentDetail.metadata.title}
                </span>
                <span className="text-zinc-400 capitalize block mt-0.5">
                  {categoryConfig?.label || documentDetail.metadata.doc_type}
                </span>
              </div>

              {/* Expiry Status Banner */}
              {expiryInfo && (
                <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                    Expiry Status
                  </span>
                  <span className={`text-xs block ${expiryInfo.badgeClass}`}>
                    {expiryInfo.label}
                  </span>
                  {documentDetail.metadata.expiry_date && (
                    <span className="text-zinc-400 block text-[11px]">
                      {formatDisplayDate(documentDetail.metadata.expiry_date, calendarPreference, numeralPreference)}
                    </span>
                  )}
                </div>
              )}

              {/* Issue Date */}
              {documentDetail.metadata.document_date && (
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                    Issue Date
                  </span>
                  <span className="text-zinc-200">
                    {formatDisplayDate(documentDetail.metadata.document_date, calendarPreference, numeralPreference)}
                  </span>
                  {calendarPreference === 'dual' && (() => {
                    const info = getDualDateInfo(documentDetail.metadata.document_date, numeralPreference === 'ne');
                    if (!info) return null;
                    return (
                      <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                        BS: {info.formattedBs}
                      </span>
                    );
                  })()}
                </div>
              )}

              {/* Tags */}
              {documentDetail.metadata.tags && documentDetail.metadata.tags.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
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

              {/* Description / Notes (only displayed when present) */}
              {documentDetail.metadata.description && (
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                    Notes
                  </span>
                  <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                    {documentDetail.metadata.description}
                  </p>
                </div>
              )}

              {/* Action Buttons in Drawer */}
              <div className="pt-3 border-t border-zinc-800 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteDocConfirm(true)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-rose-500/20 text-rose-400 border border-zinc-700 hover:border-rose-500/30 font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM TOOLBAR: MULTI-PAGE THUMBNAILS & PAGE REORDER / DELETE */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-zinc-950/90 border-t border-zinc-800/80 backdrop-blur-lg shrink-0 z-20 flex flex-col sm:flex-row items-center justify-between gap-2 pb-safe pl-safe pr-safe">
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
              title={`Page ${idx + 1}`}
              aria-label={`Jump to Page ${idx + 1}`}
            >
              {page.thumbnail_data ? (
                <img
                  src={page.thumbnail_data}
                  alt={`Page ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">
                  p.{idx + 1}
                </div>
              )}
              <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] font-bold text-center text-white py-0.5">
                {idx + 1}
              </span>
            </button>
          ))}

          {/* Add Page Button */}
          {documentDetail && (
            <button
              type="button"
              onClick={() => onAddPage(documentDetail.metadata.id)}
              className="shrink-0 w-11 sm:w-12 h-14 sm:h-16 rounded-lg border-2 border-dashed border-zinc-700 hover:border-purple-500 bg-zinc-900/60 hover:bg-zinc-800 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-purple-400 transition-colors cursor-pointer"
              title="Add Page"
              aria-label="Add Page"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[9px] font-semibold">+ Page</span>
            </button>
          )}
        </div>

        {/* Page management controls */}
        {documentDetail && documentDetail.pages.length > 1 && (
          <div className="flex items-center gap-2 text-xs shrink-0">
            {/* Reorder Left / Right */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
              <button
                type="button"
                disabled={currentPageIndex === 0}
                onClick={() => handleMovePage('left')}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Move Page Earlier"
                aria-label="Move Page Earlier"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 text-[10px] text-zinc-400 font-medium">Reorder</span>
              <button
                type="button"
                disabled={currentPageIndex === documentDetail.pages.length - 1}
                onClick={() => handleMovePage('right')}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Move Page Later"
                aria-label="Move Page Later"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Delete Current Page */}
            <button
              type="button"
              onClick={() => setShowDeletePageConfirm(true)}
              className="py-1.5 px-2.5 rounded-xl bg-zinc-900 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Delete Page"
              aria-label="Delete Page"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Page</span>
            </button>
          </div>
        )}
      </div>

      {/* Edit Document Modal */}
      {isEditing && (
        <DocumentEditModal
          documentId={documentDetail?.metadata.id || null}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onSaved={loadDocument}
        />
      )}

      {/* CONFIRM DELETE ENTIRE DOCUMENT MODAL */}
      {showDeleteDocConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-scale-up">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-5 border border-zinc-800 bg-zinc-900 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete document?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  "{documentDetail?.metadata.title}" will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteDocConfirm(false)}
                className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE SINGLE PAGE MODAL */}
      {showDeletePageConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-scale-up">
          <div className="w-full max-w-sm glass-panel rounded-2xl p-5 border border-zinc-800 bg-zinc-900 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete Page {currentPageIndex + 1}?</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Remove page from this document.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeletePageConfirm(false)}
                className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeletePage}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
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
