import type { FaceBox } from "./types";
import {
  DEFAULT_MONITOR_THRESHOLDS,
  type MonitorThresholds,
} from "./thresholds";

export interface FaceMetrics {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  clipped: boolean;
}

export function faceBoxFromLandmarks(
  landmarks: ReadonlyArray<{ x: number; y: number }>
): FaceBox | null {
  if (!landmarks.length) return null;
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of landmarks) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

export function faceMetrics(
  box: FaceBox,
  edgeMargin = DEFAULT_MONITOR_THRESHOLDS.edgeMargin
): FaceMetrics {
  return {
    width: box.maxX - box.minX,
    height: box.maxY - box.minY,
    centerX: (box.minX + box.maxX) / 2,
    centerY: (box.minY + box.maxY) / 2,
    clipped:
      box.minX < edgeMargin ||
      box.maxX > 1 - edgeMargin ||
      box.minY < edgeMargin ||
      box.maxY > 1 - edgeMargin,
  };
}

/**
 * Rec. 709 luminance of a packed RGBA buffer, sampled rather than fully
 * reduced. A 256px inference frame does not need every pixel to decide
 * "is this obviously too dark to see a face".
 */
export function meanLuminance(
  data: Uint8ClampedArray | Uint8Array,
  stepBytes = 32
): number {
  const stride = Math.max(4, stepBytes - (stepBytes % 4));
  let sum = 0;
  let count = 0;
  for (let i = 0; i + 2 < data.length; i += stride) {
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    count += 1;
  }
  return count === 0 ? 0 : sum / count;
}

export function isPoorVideoSize(
  width: number | undefined,
  height: number | undefined,
  thresholds: MonitorThresholds = DEFAULT_MONITOR_THRESHOLDS
): boolean {
  if (!width || !height) return false;
  return width < thresholds.minVideoWidth || height < thresholds.minVideoHeight;
}
