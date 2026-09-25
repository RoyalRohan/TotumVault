import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  Upload,
  RotateCw,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Sliders,
  Calendar,
  Tag,
  FileText,
  AlertCircle,
  FlipHorizontal,
  Layers,
  Star,
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import {
  DOCUMENT_CATEGORIES,
  QuadCorners,
  detectDocumentCorners,
  cropQuadToImage,
  generateThumbnailDataUrl,
} from './documentUtils';
import { DocumentCategoryType, SavePageInput } from '../../types';

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'camera' | 'upload';
  targetDocumentId?: string; // If adding pages to an existing document
  initialCategory?: DocumentCategoryType;
}

interface StagedPage {
  id: string;
  dataUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  mimeType: string;
  fileSize: number;
}

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'upload',
  targetDocumentId,
  initialCategory = 'bill',
}) => {
  const { saveDocument, addDocumentPage, showToast } = useVault();

  // Mode: 'capture' (camera/file pick), 'crop' (perspective edit), 'metadata' (final form)
  const [step, setStep] = useState<'capture' | 'crop' | 'metadata'>('capture');
  const [sourceMode, setSourceMode] = useState<'camera' | 'upload'>(initialMode);

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Staged pages for this document
  const [stagedPages, setStagedPages] = useState<StagedPage[]>([]);

  // Crop & perspective adjustment state
  const [rawImageElem, setRawImageElem] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<QuadCorners>({
    tl: { x: 0.05, y: 0.05 },
    tr: { x: 0.95, y: 0.05 },
    br: { x: 0.95, y: 0.95 },
    bl: { x: 0.05, y: 0.95 },
  });
  const [rotation, setRotation] = useState<number>(0);
  const [enhanceContrast, setEnhanceContrast] = useState<boolean>(true);
  const [draggingCorner, setDraggingCorner] = useState<keyof QuadCorners | null>(null);
  const [canvasDim, setCanvasDim] = useState<{ width: number; height: number }>({ width: 800, height: 600 });

  // Refs for canvas and pointer tracking
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Metadata form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategoryType>(initialCategory);
  const [description, setDescription] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Stop camera media stream safely
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start live camera
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopCameraStream();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported on this browser or platform');
      }

      // Check permission state safely if navigator.permissions.query is available
      if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
        try {
          const perm = await navigator.permissions.query({ name: 'camera' as any });
          if (perm.state === 'denied') {
            setCameraError(
              'Camera permission was denied. You can grant access in device settings, use your device native camera app, or choose an image file.'
            );
            return;
          }
        } catch {
          // Some webviews throw on camera query; safely proceed to getUserMedia
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera access failed:', err);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied or not yet granted. Tap "Try Again / Grant", open your native Camera app, or upload an image.'
          : 'Could not access the live camera stream. You can open your native Camera app or upload an image.'
      );
    }
  }, [stopCameraStream]);

  // Effect to manage camera on open/mode switch
  useEffect(() => {
    if (isOpen && step === 'capture' && sourceMode === 'camera') {
      startCamera(facingMode);
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, step, sourceMode, facingMode, startCamera, stopCameraStream]);

  // Handle Capture Photo from video frame
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth;
    snapCanvas.height = video.videoHeight;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
    const dataUrl = snapCanvas.toDataURL('image/jpeg', 0.95);
    stopCameraStream();
    loadImageForCropping(dataUrl);
  };

  // Load raw image into memory and initiate corner detection
  const loadImageForCropping = (src: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setRawImageElem(img);
      const detected = detectDocumentCorners(img);
      setCorners(detected);
      setRotation(0);
      setStep('crop');
    };
    img.src = src;
  };

  // Handle file uploads (single or multiple)
  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const first = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) {
        loadImageForCropping(src);
      }
    };
    reader.readAsDataURL(first);
  };

  // Rotate 90 degrees clockwise while preserving quad mapping to the document
  const handleRotate90 = () => {
    setRotation((prev) => (prev + 90) % 360);
    // Rotate normalized quad coordinates clockwise: (x, y) -> (1 - y, x)
    setCorners((prev) => ({
      tl: { x: 1 - prev.bl.y, y: prev.bl.x },
      tr: { x: 1 - prev.tl.y, y: prev.tl.x },
      br: { x: 1 - prev.tr.y, y: prev.tr.x },
      bl: { x: 1 - prev.br.y, y: prev.br.x },
    }));
  };

  // Redraw canvas with crop overlay, grid, handles, and magnifying loupe
  useEffect(() => {
    if (step !== 'crop' || !rawImageElem || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = rawImageElem;
    const isRot90 = ((rotation % 180) + 180) % 180 === 90;
    const dispW = isRot90 ? img.naturalHeight || img.height : img.naturalWidth || img.width;
    const dispH = isRot90 ? img.naturalWidth || img.width : img.naturalHeight || img.height;

    // High resolution preview buffer (up to 1600px)
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(dispW, dispH));
    const cw = Math.round(dispW * scale);
    const ch = Math.round(dispH * scale);

    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      setCanvasDim({ width: cw, height: ch });
    }

    // 1. Draw rotated image
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const imgDrawW = (img.naturalWidth || img.width) * scale;
    const imgDrawH = (img.naturalHeight || img.height) * scale;
    ctx.drawImage(img, -imgDrawW / 2, -imgDrawH / 2, imgDrawW, imgDrawH);
    ctx.restore();

    // 2. Map quad relative corners to canvas coordinates
    const pTL = { x: corners.tl.x * cw, y: corners.tl.y * ch };
    const pTR = { x: corners.tr.x * cw, y: corners.tr.y * ch };
    const pBR = { x: corners.br.x * cw, y: corners.br.y * ch };
    const pBL = { x: corners.bl.x * cw, y: corners.bl.y * ch };

    // 3. Dark semi-transparent mask outside crop area
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.moveTo(pTL.x, pTL.y);
    ctx.lineTo(pBL.x, pBL.y);
    ctx.lineTo(pBR.x, pBR.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.closePath();
    ctx.fill('evenodd');

    // 4. Rule-of-thirds alignment grid inside quad
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 1; i <= 2; i++) {
      const t = i / 3;
      // Horizontal grid line
      const hx1 = pTL.x + (pBL.x - pTL.x) * t;
      const hy1 = pTL.y + (pBL.y - pTL.y) * t;
      const hx2 = pTR.x + (pBR.x - pTR.x) * t;
      const hy2 = pTR.y + (pBR.y - pTR.y) * t;
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(hx2, hy2);
      ctx.stroke();

      // Vertical grid line
      const vx1 = pTL.x + (pTR.x - pTL.x) * t;
      const vy1 = pTL.y + (pTR.y - pTL.y) * t;
      const vx2 = pBL.x + (pBR.x - pBL.x) * t;
      const vy2 = pBL.y + (pBR.y - pBL.y) * t;
      ctx.beginPath();
      ctx.moveTo(vx1, vy1);
      ctx.lineTo(vx2, vy2);
      ctx.stroke();
    }
    ctx.restore();

    // 5. Quad border stroke
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#9333ea'; // TotumVault brand purple
    ctx.beginPath();
    ctx.moveTo(pTL.x, pTL.y);
    ctx.lineTo(pTR.x, pTR.y);
    ctx.lineTo(pBR.x, pBR.y);
    ctx.lineTo(pBL.x, pBL.y);
    ctx.closePath();
    ctx.stroke();

    // 6. Draw 4 corner handles
    const handleRadius = Math.max(12, Math.round(cw * 0.022));
    const drawHandle = (p: { x: number; y: number }, active: boolean) => {
      if (active) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, handleRadius + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(147, 51, 234, 0.35)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#c084fc' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#9333ea';
      ctx.stroke();

      // Inner center dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, handleRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#7e22ce';
      ctx.fill();
    };

    drawHandle(pTL, draggingCorner === 'tl');
    drawHandle(pTR, draggingCorner === 'tr');
    drawHandle(pBR, draggingCorner === 'br');
    drawHandle(pBL, draggingCorner === 'bl');

    // 7. If actively dragging a corner, draw high-precision magnifying Loupe
    if (draggingCorner) {
      const activePoint =
        draggingCorner === 'tl'
          ? pTL
          : draggingCorner === 'tr'
          ? pTR
          : draggingCorner === 'br'
          ? pBR
          : pBL;

      const loupeR = Math.max(42, Math.round(cw * 0.075));
      let loupeY = activePoint.y - loupeR - 35;
      if (loupeY - loupeR < 15) {
        // Place below if too close to top edge
        loupeY = activePoint.y + loupeR + 35;
      }
      const loupeX = Math.max(loupeR + 15, Math.min(cw - loupeR - 15, activePoint.x));

      ctx.save();
      // Circular clip for loupe
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.fillStyle = '#000000';
      ctx.fillRect(loupeX - loupeR, loupeY - loupeR, loupeR * 2, loupeR * 2);

      // Draw magnified portion of image (2.2x zoom)
      const zoom = 2.2;
      ctx.save();
      ctx.translate(loupeX, loupeY);
      ctx.scale(zoom, zoom);
      ctx.translate(-activePoint.x, -activePoint.y);

      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -imgDrawW / 2, -imgDrawH / 2, imgDrawW, imgDrawH);
      ctx.restore();

      ctx.restore();

      // Crosshairs inside loupe
      ctx.beginPath();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.moveTo(loupeX - loupeR * 0.65, loupeY);
      ctx.lineTo(loupeX + loupeR * 0.65, loupeY);
      ctx.moveTo(loupeX, loupeY - loupeR * 0.65);
      ctx.lineTo(loupeX, loupeY + loupeR * 0.65);
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore(); // restore clipping

      // Outer rings of the loupe
      ctx.save();
      ctx.beginPath();
      ctx.arc(loupeX, loupeY, loupeR, 0, Math.PI * 2);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#9333ea';
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }, [step, rawImageElem, corners, rotation, draggingCorner]);

  // Unified Pointer Events for corner handle manipulation
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch cancel
    if (activePointersRef.current.size > 1) {
      setDraggingCorner(null);
      dragPointerIdRef.current = null;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    // Corner positions in CSS display pixels
    const pTL = { x: corners.tl.x * rect.width, y: corners.tl.y * rect.height };
    const pTR = { x: corners.tr.x * rect.width, y: corners.tr.y * rect.height };
    const pBR = { x: corners.br.x * rect.width, y: corners.br.y * rect.height };
    const pBL = { x: corners.bl.x * rect.width, y: corners.bl.y * rect.height };

    const distTL = Math.hypot(px - pTL.x, py - pTL.y);
    const distTR = Math.hypot(px - pTR.x, py - pTR.y);
    const distBR = Math.hypot(px - pBR.x, py - pBR.y);
    const distBL = Math.hypot(px - pBL.x, py - pBL.y);

    // Generous touch hit radius: 46px on touch, 28px on mouse
    const hitRadius = e.pointerType === 'touch' ? 46 : 28;
    const minDist = Math.min(distTL, distTR, distBR, distBL);

    if (minDist <= hitRadius) {
      let targetKey: keyof QuadCorners = 'tl';
      if (minDist === distTL) targetKey = 'tl';
      else if (minDist === distTR) targetKey = 'tr';
      else if (minDist === distBR) targetKey = 'br';
      else targetKey = 'bl';

      setDraggingCorner(targetKey);
      dragPointerIdRef.current = e.pointerId;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // ignore if not supported
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (draggingCorner && dragPointerIdRef.current === e.pointerId) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // Clamp normalized coordinates inside [0.01, 0.99]
      const normX = Math.max(0.01, Math.min(0.99, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0.01, Math.min(0.99, (e.clientY - rect.top) / rect.height));

      setCorners((prev) => ({
        ...prev,
        [draggingCorner]: { x: normX, y: normY },
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);

    if (dragPointerIdRef.current === e.pointerId) {
      try {
        if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
          canvasRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      setDraggingCorner(null);
      dragPointerIdRef.current = null;
    }
  };

  // Apply crop, generate thumbnail, and stage the page
  const handleConfirmCrop = () => {
    if (!rawImageElem) return;

    try {
      const cropped = cropQuadToImage(rawImageElem, corners, rotation, enhanceContrast);

      // Create an image element from cropped result to generate miniature thumbnail
      const cropImg = new Image();
      cropImg.onload = () => {
        const thumbUrl = generateThumbnailDataUrl(cropImg, 220);
        const newPage: StagedPage = {
          id: `page_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          dataUrl: cropped.dataUrl,
          thumbnailUrl: thumbUrl,
          width: cropped.width,
          height: cropped.height,
          mimeType: cropped.mimeType,
          fileSize: Math.round((cropped.dataUrl.length * 3) / 4),
        };

        setStagedPages((prev) => [...prev, newPage]);
        setRawImageElem(null);

        // If targetDocumentId is present, or if user already has pages, show review/metadata
        setStep('metadata');
      };
      cropImg.src = cropped.dataUrl;
    } catch (err: any) {
      showToast(err?.toString() || 'Failed to crop image', 'error');
    }
  };

  // Remove a staged page
  const handleRemoveStagedPage = (id: string) => {
    setStagedPages((prev) => prev.filter((p) => p.id !== id));
    if (stagedPages.length <= 1) {
      setStep('capture');
    }
  };

  // Add another page to the document
  const handleAddAnotherPage = () => {
    setRawImageElem(null);
    setStep('capture');
  };

  // Tag management
  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Save document or add page to existing document
  const handleSaveAll = async () => {
    if (stagedPages.length === 0) {
      showToast('Please capture or upload at least one page', 'error');
      return;
    }

    if (!targetDocumentId && !title.trim()) {
      showToast('Please provide a document title', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (targetDocumentId) {
        // Adding pages to existing document
        for (let i = 0; i < stagedPages.length; i++) {
          const p = stagedPages[i];
          const pageInput: SavePageInput = {
            page_number: i + 1,
            mime_type: p.mimeType,
            width: p.width,
            height: p.height,
            file_size: p.fileSize,
            image_data: p.dataUrl,
            thumbnail_data: p.thumbnailUrl,
          };
          await addDocumentPage(targetDocumentId, pageInput);
        }
        showToast('Document pages added securely', 'success');
      } else {
        // Saving new document
        const pagesInput: SavePageInput[] = stagedPages.map((p, idx) => ({
          page_number: idx + 1,
          mime_type: p.mimeType,
          width: p.width,
          height: p.height,
          file_size: p.fileSize,
          image_data: p.dataUrl,
          thumbnail_data: p.thumbnailUrl,
        }));

        await saveDocument({
          title: title.trim(),
          doc_type: category,
          description: description.trim(),
          tags,
          document_date: documentDate || undefined,
          expiry_date: expiryDate || undefined,
          favorite,
          pages: pagesInput,
        });
      }

      handleCloseModal();
    } catch (err: any) {
      showToast(err?.toString() || 'Failed to save document', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseModal = () => {
    stopCameraStream();
    setStep('capture');
    setStagedPages([]);
    setRawImageElem(null);
    setTitle('');
    setDescription('');
    setDocumentDate('');
    setExpiryDate('');
    setTags([]);
    setFavorite(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-screen h-[100dvh] max-h-[100dvh] bg-zinc-950 sm:bg-black/85 sm:backdrop-blur-md sm:flex sm:items-center sm:justify-center sm:p-4 select-none overflow-hidden animate-scale-up">
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl glass-panel sm:rounded-2xl shadow-2xl border-0 sm:border border-theme-border flex flex-col overflow-hidden bg-theme-bg/95">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-3 border-b border-theme-border shrink-0 bg-theme-surface/70 backdrop-blur-md pt-safe pl-safe pr-safe">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-theme-text tracking-tight truncate">
                {targetDocumentId
                  ? 'Add Pages to Document'
                  : step === 'crop'
                  ? 'Adjust Perspective & Crop'
                  : step === 'metadata'
                  ? 'Document Details & Review'
                  : 'Secure Document Scanner'}
              </h2>
              <p className="text-[11px] sm:text-xs text-theme-text-muted truncate">
                {step === 'crop'
                  ? 'Drag corners to align document boundaries'
                  : step === 'metadata'
                  ? `${stagedPages.length} page(s) ready to encrypt & save`
                  : 'On-device camera & edge detection. Encrypted in your vault.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-2 rounded-xl hover:bg-theme-surface text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: CAPTURE OR UPLOAD */}
        {step === 'capture' && (
          <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden p-3 sm:p-4 space-y-3 pb-safe pl-safe pr-safe">
            {/* Mode Switch Tabs: Live Camera vs File Upload */}
            <div className="flex bg-theme-surface p-1 rounded-xl border border-theme-border text-xs font-semibold shrink-0">
              <button
                type="button"
                onClick={() => setSourceMode('camera')}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  sourceMode === 'camera'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Live Camera Scan</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('upload')}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  sourceMode === 'upload'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Upload Image Files</span>
              </button>
            </div>

            {/* Camera View */}
            {sourceMode === 'camera' && (
              <div className="flex-1 min-h-0 flex flex-col justify-between relative overflow-hidden">
                {cameraError ? (
                  <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/25 text-amber-900 dark:text-amber-400 text-xs space-y-3 flex flex-col justify-center">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>Camera Access Notice</span>
                    </div>
                    <p className="text-theme-text-muted leading-relaxed">{cameraError}</p>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startCamera(facingMode)}
                        className="py-2.5 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors text-xs"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Try Again / Grant</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => nativeCameraInputRef.current?.click()}
                        className="py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors text-xs"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Open Native Camera App</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="py-2.5 px-3.5 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors text-xs"
                      >
                        <Upload className="w-4 h-4 text-purple-400" />
                        <span>Choose from Device</span>
                      </button>
                    </div>
                    <div className="pt-0.5 text-[11px] text-theme-text-muted/80">
                      Tip: If previously denied, allow Camera access in your device Settings &gt; Apps &gt; TotumVault &gt; Permissions.
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-theme-border shadow-inner">
                    <video
                      ref={videoRef}
                      playsInline
                      autoPlay
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Viewfinder Target Overlay */}
                    <div className="absolute inset-5 sm:inset-8 border-2 border-dashed border-white/40 rounded-xl pointer-events-none flex items-center justify-center">
                      <div className="text-[11px] text-white/80 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm shadow-md">
                        Align document within frame
                      </div>
                    </div>

                    {/* Camera Controls Overlay */}
                    <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3 sm:gap-5 px-4 pb-safe">
                      {/* Switch Front/Back Camera */}
                      <button
                        type="button"
                        onClick={() => {
                          const next = facingMode === 'environment' ? 'user' : 'environment';
                          setFacingMode(next);
                          startCamera(next);
                        }}
                        className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                        title="Switch Camera"
                      >
                        <FlipHorizontal className="w-5 h-5" />
                      </button>

                      {/* Shutter Button */}
                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        className="w-16 h-16 rounded-full bg-white hover:bg-zinc-200 border-4 border-purple-500 shadow-xl flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
                        title="Take Photo"
                      >
                        <div className="w-11 h-11 rounded-full bg-purple-600 flex items-center justify-center text-white">
                          <Camera className="w-6 h-6" />
                        </div>
                      </button>

                      {/* Device Native Camera Fallback */}
                      <button
                        type="button"
                        onClick={() => nativeCameraInputRef.current?.click()}
                        className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-emerald-400 backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                        title="Open Device Camera App"
                      >
                        <Camera className="w-5 h-5" />
                      </button>

                      {/* File Fallback Icon */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                        title="Choose File"
                      >
                        <Upload className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Upload View */}
            {sourceMode === 'upload' && (
              <div className="flex-1 min-h-0 flex flex-col justify-center gap-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFilesSelected(e.dataTransfer.files);
                  }}
                  className="flex-1 p-6 sm:p-10 rounded-2xl border-2 border-dashed border-theme-border hover:border-purple-500/60 bg-theme-surface/40 hover:bg-theme-surface transition-all flex flex-col items-center justify-center gap-3 cursor-pointer group text-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/20 text-purple-400 flex items-center justify-center transition-colors shadow-sm">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-theme-text block">
                      Tap or drag document photos here
                    </span>
                    <span className="text-xs text-theme-text-muted mt-1 block">
                      Supports JPEG, PNG, and WEBP images from device gallery or storage
                    </span>
                  </div>
                </div>

                <div className="flex justify-center shrink-0">
                  <button
                    type="button"
                    onClick={() => nativeCameraInputRef.current?.click()}
                    className="py-2.5 px-4 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4 text-emerald-500" />
                    <span>Take Photo with Device Camera</span>
                  </button>
                </div>
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <input
              ref={nativeCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
          </div>
        )}

        {/* STEP 2: CROP & PERSPECTIVE WARP (FULL VIEWPORT FIT) */}
        {step === 'crop' && (
          <div className="flex-1 min-h-0 flex flex-col w-full h-full overflow-hidden bg-black/95 select-none animate-scale-up">
            {/* Crop Toolbar Controls */}
            <div className="px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 shrink-0 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none pl-safe pr-safe">
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleRotate90}
                  className="py-1.5 px-2.5 sm:px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Rotate 90 degrees clockwise"
                >
                  <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                  <span className="whitespace-nowrap">Rotate 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (rawImageElem) {
                      setCorners(detectDocumentCorners(rawImageElem));
                    }
                  }}
                  className="py-1.5 px-2.5 sm:px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Auto-detect document edges"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="whitespace-nowrap">Auto-Detect</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCorners({
                      tl: { x: 0.02, y: 0.02 },
                      tr: { x: 0.98, y: 0.02 },
                      br: { x: 0.98, y: 0.98 },
                      bl: { x: 0.02, y: 0.98 },
                    })
                  }
                  className="py-1.5 px-2.5 sm:px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Select entire image frame"
                >
                  <Sliders className="w-3.5 h-3.5 text-zinc-300" />
                  <span className="whitespace-nowrap">Full Frame</span>
                </button>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300 select-none shrink-0 py-1 pl-1">
                <input
                  type="checkbox"
                  checked={enhanceContrast}
                  onChange={(e) => setEnhanceContrast(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 accent-purple-600"
                />
                <span className="text-xs whitespace-nowrap">Enhance Text</span>
              </label>
            </div>

            {/* Responsive Quad Display Canvas Area */}
            <div
              ref={containerRef}
              className="flex-1 min-h-0 w-full relative flex items-center justify-center overflow-hidden bg-black/95 p-2 sm:p-4 select-none touch-none"
            >
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  aspectRatio: `${canvasDim.width} / ${canvasDim.height}`,
                }}
                className="cursor-crosshair touch-none select-none shadow-2xl rounded-sm"
              />
            </div>

            {/* Bottom Actions Bar (Pinned with pb-safe) */}
            <div className="px-3.5 sm:px-5 py-3 bg-zinc-950 border-t border-zinc-800 shrink-0 grid grid-cols-2 gap-3 pb-safe pl-safe pr-safe">
              <button
                type="button"
                onClick={() => {
                  setStep('capture');
                  if (sourceMode === 'camera') startCamera(facingMode);
                }}
                className="py-2.5 sm:py-3 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer text-center"
              >
                Retake Photo
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                className="py-2.5 sm:py-3 px-3 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>Apply Crop</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: METADATA & MULTI-PAGE REVIEW */}
        {step === 'metadata' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-4 pb-safe pl-safe pr-safe animate-scale-up">
            {/* Multi-page Thumbnails Strip */}
            <div className="p-3.5 rounded-2xl bg-theme-surface border border-theme-border space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-theme-text">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>Document Pages ({stagedPages.length})</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddAnotherPage}
                  className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Another Page</span>
                </button>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto py-2 scrollbar-none">
                {stagedPages.map((page, idx) => (
                  <div
                    key={page.id}
                    className="relative shrink-0 w-22 sm:w-24 h-28 sm:h-32 rounded-xl overflow-hidden border-2 border-theme-border bg-black group shadow-sm"
                  >
                    <img
                      src={page.thumbnailUrl}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded backdrop-blur-sm">
                      p. {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStagedPage(page.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white transition-opacity cursor-pointer shadow-sm"
                      title="Delete page"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* Add Page Card */}
                <button
                  type="button"
                  onClick={handleAddAnotherPage}
                  className="shrink-0 w-22 sm:w-24 h-28 sm:h-32 rounded-xl border-2 border-dashed border-theme-border hover:border-purple-500/60 bg-theme-surface/50 hover:bg-theme-surface flex flex-col items-center justify-center gap-1.5 text-theme-text-muted hover:text-purple-400 transition-colors cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[11px] font-semibold">+ Add Page</span>
                </button>
              </div>
            </div>

            {/* Metadata Inputs (Only if creating new document) */}
            {!targetDocumentId ? (
              <div className="space-y-3.5">
                {/* Title & Favorite */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider">
                      Document Title *
                    </label>
                    <button
                      type="button"
                      onClick={() => setFavorite(!favorite)}
                      className={`flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors ${
                        favorite ? 'text-amber-500' : 'text-theme-text-muted hover:text-theme-text'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${favorite ? 'fill-amber-500' : ''}`} />
                      <span>{favorite ? 'Favorite' : 'Mark Favorite'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Electric Bill, Passport, Driver License..."
                      className="input-themed w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm"
                      autoFocus
                    />
                    <FileText className="w-4 h-4 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Category Type Chips */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
                    Document Type
                  </label>
                  <div className="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-4 gap-1.5 text-xs">
                    {DOCUMENT_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
                            isSelected
                              ? 'bg-purple-600 text-white font-semibold border-purple-600 shadow-sm'
                              : 'bg-theme-surface border-theme-border text-theme-text hover:bg-theme-bg'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 stroke-[1.75] shrink-0 ${isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`} />
                          <span className="truncate text-xs">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dates: Document Date & Expiry Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
                      Document Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={documentDate}
                        onChange={(e) => setDocumentDate(e.target.value)}
                        className="input-themed w-full rounded-xl pl-9 pr-3.5 py-2 text-xs"
                      />
                      <Calendar className="w-3.5 h-3.5 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
                      Expiry Date
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="input-themed w-full rounded-xl pl-9 pr-3.5 py-2 text-xs"
                      />
                      <Calendar className="w-3.5 h-3.5 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
                    Tags
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/20"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        placeholder="Add tag and press Enter..."
                        className="input-themed w-full rounded-xl pl-9 pr-3.5 py-2 text-xs"
                      />
                      <Tag className="w-3.5 h-3.5 text-theme-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="py-2 px-3 rounded-xl bg-theme-surface hover:bg-theme-bg border border-theme-border text-theme-text text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Add Tag
                    </button>
                  </div>
                </div>

                {/* Notes / Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-text-muted uppercase tracking-wider block">
                    Description / Notes
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Policy number, account details, guarantee terms, or remarks..."
                    rows={2}
                    className="input-themed w-full rounded-xl px-3.5 py-2 text-xs resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-600 dark:text-purple-300 text-xs flex items-center gap-2.5">
                <Check className="w-4 h-4 text-purple-400 shrink-0" />
                <span>
                  New page(s) will be encrypted and appended to your selected document.
                </span>
              </div>
            )}

            {/* Final Save Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving || (!targetDocumentId && !title.trim())}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSaving
                    ? 'Encrypting & Saving...'
                    : targetDocumentId
                    ? `Save & Append ${stagedPages.length} Page(s)`
                    : 'Encrypt & Save Document'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
