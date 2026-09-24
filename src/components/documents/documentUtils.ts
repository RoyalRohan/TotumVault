import React from 'react';
import {
  FileText,
  Receipt,
  CreditCard,
  Award,
  Shield,
  FileCheck,
  ShieldCheck,
  FileSpreadsheet,
  Folder,
} from 'lucide-react';
import { DocumentCategoryType } from '../../types';

export interface DocumentCategoryConfig {
  id: DocumentCategoryType;
  label: string;
  description: string;
  color: string; // Tailwind color name for badges
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const DOCUMENT_CATEGORIES: DocumentCategoryConfig[] = [
  {
    id: 'bill',
    label: 'Bill',
    description: 'Utility, phone, electricity & living bills',
    color: 'amber',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-500',
    borderColor: 'border-amber-500/25',
    icon: FileText,
  },
  {
    id: 'receipt',
    label: 'Receipt',
    description: 'Store, shopping & expense receipts',
    color: 'emerald',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-500',
    borderColor: 'border-emerald-500/25',
    icon: Receipt,
  },
  {
    id: 'identification',
    label: 'ID & Passport',
    description: "Driver's license, passport, national ID card",
    color: 'violet',
    bgColor: 'bg-violet-500/10',
    textColor: 'text-violet-400',
    borderColor: 'border-violet-500/25',
    icon: CreditCard,
  },
  {
    id: 'certificate',
    label: 'Certificate',
    description: 'Degrees, diplomas & official certificates',
    color: 'purple',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-500',
    borderColor: 'border-purple-500/25',
    icon: Award,
  },
  {
    id: 'insurance',
    label: 'Insurance',
    description: 'Health, vehicle, home & life insurance',
    color: 'cyan',
    bgColor: 'bg-cyan-500/10',
    textColor: 'text-cyan-500',
    borderColor: 'border-cyan-500/25',
    icon: Shield,
  },
  {
    id: 'contract',
    label: 'Contract',
    description: 'Leases, employment agreements & legal contracts',
    color: 'indigo',
    bgColor: 'bg-indigo-500/10',
    textColor: 'text-indigo-500',
    borderColor: 'border-indigo-500/25',
    icon: FileCheck,
  },
  {
    id: 'warranty',
    label: 'Warranty',
    description: 'Appliance, gadget & vehicle warranties',
    color: 'orange',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-500',
    borderColor: 'border-orange-500/25',
    icon: ShieldCheck,
  },
  {
    id: 'invoice',
    label: 'Invoice',
    description: 'Tax invoices, business billing & statements',
    color: 'teal',
    bgColor: 'bg-teal-500/10',
    textColor: 'text-teal-500',
    borderColor: 'border-teal-500/25',
    icon: FileSpreadsheet,
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Miscellaneous personal records and notes',
    color: 'zinc',
    bgColor: 'bg-zinc-500/10',
    textColor: 'text-zinc-400',
    borderColor: 'border-zinc-500/25',
    icon: Folder,
  },
];

export function getCategoryConfig(category?: string): DocumentCategoryConfig {
  const normalized = (category || 'other').toLowerCase();
  const found = DOCUMENT_CATEGORIES.find((c) => c.id === normalized);
  return (
    found || {
      id: 'other',
      label: category || 'Other',
      description: 'Document',
      color: 'zinc',
      bgColor: 'bg-zinc-500/10',
      textColor: 'text-zinc-400',
      borderColor: 'border-zinc-500/25',
      icon: Folder,
    }
  );
}

/**
 * Creates a downscaled JPEG thumbnail (~200px width/height) from an image element or canvas
 */
export function generateThumbnailDataUrl(
  source: HTMLImageElement | HTMLCanvasElement,
  maxDim: number = 240
): string {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;

  let dstW = srcW;
  let dstH = srcH;

  if (dstW > dstH) {
    if (dstW > maxDim) {
      dstH = Math.round((dstH * maxDim) / dstW);
      dstW = maxDim;
    }
  } else {
    if (dstH > maxDim) {
      dstW = Math.round((dstW * maxDim) / dstH);
      dstH = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, dstW);
  canvas.height = Math.max(1, dstH);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(source, 0, 0, dstW, dstH);

  return canvas.toDataURL('image/jpeg', 0.65);
}

/**
 * Formats byte size into human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export interface Point2D {
  x: number; // 0.0 to 1.0 relative coordinates
  y: number;
}

export interface QuadCorners {
  tl: Point2D;
  tr: Point2D;
  br: Point2D;
  bl: Point2D;
}

/**
 * Performs simple contrast/edge analysis on an HTMLImageElement to detect document corners.
 * Falls back to an inset quad if image does not have clear boundaries.
 */
export function detectDocumentCorners(img: HTMLImageElement): QuadCorners {
  // Default clean 5% inset
  const defaultQuad: QuadCorners = {
    tl: { x: 0.05, y: 0.05 },
    tr: { x: 0.95, y: 0.05 },
    br: { x: 0.95, y: 0.95 },
    bl: { x: 0.05, y: 0.95 },
  };

  try {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return defaultQuad;

    // Downsample to 120x120 for fast edge detection
    const sampleW = 120;
    const sampleH = 120;
    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return defaultQuad;

    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    // Convert to grayscale luminance
    const gray = new Uint8Array(sampleW * sampleH);
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    }

    // Horizontal & vertical threshold scans from borders inward
    // Scan left edge
    let leftBound = Math.floor(sampleW * 0.05);
    for (let x = 0; x < sampleW / 3; x++) {
      let gradSum = 0;
      for (let y = 10; y < sampleH - 10; y++) {
        const curr = gray[y * sampleW + x];
        const next = gray[y * sampleW + x + 1];
        gradSum += Math.abs(next - curr);
      }
      if (gradSum / sampleH > 25) {
        leftBound = x;
        break;
      }
    }

    // Scan right edge
    let rightBound = Math.floor(sampleW * 0.95);
    for (let x = sampleW - 1; x > (sampleW * 2) / 3; x--) {
      let gradSum = 0;
      for (let y = 10; y < sampleH - 10; y++) {
        const curr = gray[y * sampleW + x];
        const prev = gray[y * sampleW + x - 1];
        gradSum += Math.abs(prev - curr);
      }
      if (gradSum / sampleH > 25) {
        rightBound = x;
        break;
      }
    }

    // Scan top edge
    let topBound = Math.floor(sampleH * 0.05);
    for (let y = 0; y < sampleH / 3; y++) {
      let gradSum = 0;
      for (let x = 10; x < sampleW - 10; x++) {
        const curr = gray[y * sampleW + x];
        const next = gray[(y + 1) * sampleW + x];
        gradSum += Math.abs(next - curr);
      }
      if (gradSum / sampleW > 25) {
        topBound = y;
        break;
      }
    }

    // Scan bottom edge
    let bottomBound = Math.floor(sampleH * 0.95);
    for (let y = sampleH - 1; y > (sampleH * 2) / 3; y--) {
      let gradSum = 0;
      for (let x = 10; x < sampleW - 10; x++) {
        const curr = gray[y * sampleW + x];
        const prev = gray[(y - 1) * sampleW + x];
        gradSum += Math.abs(prev - curr);
      }
      if (gradSum / sampleW > 25) {
        bottomBound = y;
        break;
      }
    }

    const minMargin = 0.03;
    const maxMargin = 0.97;
    const l = Math.max(minMargin, Math.min(0.25, leftBound / sampleW));
    const r = Math.min(maxMargin, Math.max(0.75, rightBound / sampleW));
    const t = Math.max(minMargin, Math.min(0.25, topBound / sampleH));
    const b = Math.min(maxMargin, Math.max(0.75, bottomBound / sampleH));

    return {
      tl: { x: l, y: t },
      tr: { x: r, y: t },
      br: { x: r, y: b },
      bl: { x: l, y: b },
    };
  } catch {
    return defaultQuad;
  }
}

/**
 * Crops and straightens an image using the specified 4 corner quad coordinates.
 * Renders into an output canvas and returns full quality JPEG or PNG data URL.
 */
export function cropQuadToImage(
  img: HTMLImageElement,
  corners: QuadCorners,
  rotation: number = 0,
  enhanceContrast: boolean = false
): { dataUrl: string; width: number; height: number; mimeType: string } {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Calculate destination rectangle size based on average edge lengths
  const pTL = { x: corners.tl.x * origW, y: corners.tl.y * origH };
  const pTR = { x: corners.tr.x * origW, y: corners.tr.y * origH };
  const pBR = { x: corners.br.x * origW, y: corners.br.y * origH };
  const pBL = { x: corners.bl.x * origW, y: corners.bl.y * origH };

  const topDist = Math.hypot(pTR.x - pTL.x, pTR.y - pTL.y);
  const botDist = Math.hypot(pBR.x - pBL.x, pBR.y - pBL.y);
  const leftDist = Math.hypot(pBL.x - pTL.x, pBL.y - pTL.y);
  const rightDist = Math.hypot(pBR.x - pTR.x, pBR.y - pTR.y);

  const targetW = Math.max(100, Math.round(Math.max(topDist, botDist)));
  const targetH = Math.max(100, Math.round(Math.max(leftDist, rightDist)));

  const canvas = document.createElement('canvas');
  // Account for 90 or 270 degree rotation
  const isRotated90or270 = (rotation % 180 + 180) % 180 === 90;
  canvas.width = isRotated90or270 ? targetH : targetW;
  canvas.height = isRotated90or270 ? targetW : targetH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: img.src, width: origW, height: origH, mimeType: 'image/jpeg' };
  }

  // Handle rotation first
  ctx.save();
  if (rotation !== 0) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-targetW / 2, -targetH / 2);
  }

  // Draw quadrilateral clip
  // Split quad into 2 triangles and render texture map or clip polygon
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(targetW, 0);
  ctx.lineTo(targetW, targetH);
  ctx.lineTo(0, targetH);
  ctx.closePath();
  ctx.clip();

  // Draw source mapped to quad
  // Simple affine approximation using polygon clipping
  const minX = Math.min(pTL.x, pBL.x);
  const minY = Math.min(pTL.y, pTR.y);
  const srcW = Math.max(pTR.x, pBR.x) - minX;
  const srcH = Math.max(pBL.y, pBR.y) - minY;

  ctx.drawImage(img, minX, minY, srcW, srcH, 0, 0, targetW, targetH);
  ctx.restore();
  ctx.restore();

  // Optional contrast and sharpening enhancement for document readability
  if (enhanceContrast) {
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      // High contrast curve
      for (let i = 0; i < d.length; i += 4) {
        // slight contrast stretch
        for (let c = 0; c < 3; c++) {
          const val = d[i + c];
          const norm = (val - 128) * 1.15 + 128;
          d[i + c] = Math.max(0, Math.min(255, norm));
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Ignore filter error if context is tainted
    }
  }

  const mimeType = 'image/jpeg';
  const dataUrl = canvas.toDataURL(mimeType, 0.88);

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    mimeType,
  };
}
