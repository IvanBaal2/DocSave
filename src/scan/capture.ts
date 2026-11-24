/**
 * Auto-capture decisions for the guided camera.
 *
 * The camera takes small preview snapshots, crops them to the on-screen guide
 * frame and runs on-device OCR. A side is captured automatically when the
 * expected content is found (a valid machine-readable zone, an EU licence
 * field layout, a boarding-pass barcode) or when enough text is visible and
 * stable across two consecutive snapshots (the document is held still and in
 * focus).
 */
import { findMrz, parseBcbp, type ScanKind } from './extract';

export type Rect = { x: number; y: number; w: number; h: number };

/** Guide-frame aspect ratios (width / height). */
export const FRAME_ASPECT = {
  card: 85.6 / 54, // ID-1 card
  passport: 125 / 88, // ID-3 passport data page
  document: 210 / 297, // A4 portrait
  photo: 3 / 4, // no guide is drawn for photos; used only as a fallback
} as const;

/**
 * Maps an on-screen rectangle to normalised photo coordinates, given that the
 * camera preview fills the screen with "cover" scaling (the photo is cropped
 * on the long sides to fit). Adds a small margin around the frame.
 */
export function screenRectToPhoto(
  frame: Rect,
  screen: { width: number; height: number },
  photo: { width: number; height: number },
  margin = 0.04,
): Rect {
  const scale = Math.max(screen.width / photo.width, screen.height / photo.height);
  const offX = (photo.width * scale - screen.width) / 2;
  const offY = (photo.height * scale - screen.height) / 2;
  const mx = frame.w * margin;
  const my = frame.h * margin;
  const x = (frame.x - mx + offX) / scale / photo.width;
  const y = (frame.y - my + offY) / scale / photo.height;
  const w = (frame.w + 2 * mx) / scale / photo.width;
  const h = (frame.h + 2 * my) / scale / photo.height;
  const cx = Math.max(0, x);
  const cy = Math.max(0, y);
  return { x: cx, y: cy, w: Math.min(1 - cx, w - (cx - x)), h: Math.min(1 - cy, h - (cy - y)) };
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Jaccard similarity of two OCR line sets (ignores tiny fragments). */
export function similarity(a: string[], b: string[]): number {
  const A = new Set(a.map(norm).filter((x) => x.length >= 3));
  const B = new Set(b.map(norm).filter((x) => x.length >= 3));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((x) => {
    if (B.has(x)) inter++;
  });
  return inter / (A.size + B.size - inter);
}

/**
 * Whether a captured picture looks like a document: at least two lines of real
 * text (three or more letters or digits). Used to refuse ordinary photos.
 */
export function looksLikeDocument(lines: string[]): boolean {
  return lines.filter((l) => l.replace(/[^A-Za-z0-9À-ɏ؀-ۿ]/g, '').length >= 3).length >= 2;
}

export type Readiness = { ready: boolean; message: string; reason?: 'mrz' | 'fields' | 'barcode' | 'stable' };

const MIN_LINES: Record<ScanKind, number> = {
  passport: 4,
  'id-card': 4,
  licence: 4,
  'org-id': 4,
  loyalty: 3,
  giftcard: 3,
  coupon: 3,
  boarding: 5,
  ticket: 6,
  certificate: 5,
  receipt: 5,
  'generic-card': 3,
  photo: Number.POSITIVE_INFINITY, // photos are taken with the shutter only
  generic: 5,
};

export function assessSnapshot(params: {
  kind: ScanKind;
  sideIndex: number;
  lines: string[];
  previousLines: string[] | null;
  barcode?: string;
}): Readiness {
  const { kind, sideIndex, lines, previousLines, barcode } = params;
  const meaningful = lines.filter((l) => norm(l).length >= 3);

  if (kind === 'boarding' && barcode && parseBcbp(barcode)) {
    return { ready: true, message: 'Boarding pass barcode read', reason: 'barcode' };
  }
  if ((kind === 'loyalty' || kind === 'giftcard' || kind === 'coupon') && barcode) {
    return { ready: true, message: 'Barcode read', reason: 'barcode' };
  }
  if (kind === 'passport' || kind === 'id-card' || (kind === 'licence' && sideIndex > 0)) {
    if (findMrz(lines)) return { ready: true, message: 'Machine-readable zone verified', reason: 'mrz' };
  }
  if (kind === 'licence' && sideIndex === 0) {
    const numbered = lines.filter((l) => /^\s*(1|2|3|4a|4b|5)\s*[.,:)]\s*\S/i.test(l)).length;
    if (numbered >= 3) return { ready: true, message: 'Licence fields found', reason: 'fields' };
  }

  if (meaningful.length === 0) {
    return { ready: false, message: 'Place the document inside the frame' };
  }
  if (meaningful.length < MIN_LINES[kind]) {
    return { ready: false, message: 'Move closer so the text fills the frame' };
  }
  if (kind === 'passport') {
    return { ready: false, message: 'Make sure the two lines at the bottom (<<<) are visible' };
  }
  if (previousLines && similarity(lines, previousLines) >= 0.45) {
    return { ready: true, message: 'Document detected', reason: 'stable' };
  }
  return { ready: false, message: 'Hold still…' };
}
