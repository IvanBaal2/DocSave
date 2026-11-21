/** Page corner geometry for the camera review step (normalised 0..1 coordinates). */
import type { Quad } from '../../modules/docsave-security';

export const FULL_QUAD: Quad = [0, 0, 1, 0, 1, 1, 0, 1];

export function rectToQuad(r: { x: number; y: number; w: number; h: number }): Quad {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(1, r.x + r.w);
  const y1 = Math.min(1, r.y + r.h);
  return [x0, y0, x1, y0, x1, y1, x0, y1];
}

/** Corners after the image is turned 90° clockwise (keeps the TL, TR, BR, BL order). */
export function rotateQuad(q: Quad): Quad {
  // (x, y) -> (1 - y, x): the old bottom-left becomes the new top-left, and so on.
  const p = (i: number): [number, number] => [1 - q[i * 2 + 1], q[i * 2]];
  return [...p(3), ...p(0), ...p(1), ...p(2)] as Quad;
}

