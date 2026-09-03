/**
 * Turns face-landmark output into a single "is this person looking at the
 * screen" reading. Pure maths, so the thresholds can be tested without a camera.
 *
 * Only attention is derived here. No identity, no emotion, no traits.
 */

import type { AttentionSample } from "./attention";

/** The blendshape scores we care about, all 0..1. Missing keys count as 0. */
export type BlendshapeScores = Record<string, number>;

export interface GazeThresholds {
  /** Head rotation left/right, in degrees, still counted as facing the screen. */
  maxYawDeg: number;
  /** Head rotation up/down, in degrees. */
  maxPitchDeg: number;
  /** Combined eye-look-away blendshape magnitude tolerated. */
  maxGaze: number;
}

export const DEFAULT_GAZE_THRESHOLDS: GazeThresholds = {
  // Generous on purpose. People shift constantly in interviews, and the cost of
  // a false warning is far higher than the cost of missing a brief glance.
  maxYawDeg: 30,
  maxPitchDeg: 24,
  maxGaze: 0.62,
};

/**
 * Yaw and pitch, in degrees, from MediaPipe's 4x4 facial transformation matrix
 * (column-major, as the task API returns it).
 */
export function headAnglesFromMatrix(m: number[] | Float32Array): {
  yawDeg: number;
  pitchDeg: number;
} | null {
  if (!m || m.length < 16) return null;
  // Rotation part, column-major: r[col*4 + row].
  const r20 = m[2];
  const r21 = m[6];
  const r22 = m[10];
  const r00 = m[0];
  const r10 = m[1];

  const yaw = Math.atan2(-r20, Math.sqrt(r00 * r00 + r10 * r10));
  const pitch = Math.atan2(r21, r22);

  const deg = (rad: number) => (rad * 180) / Math.PI;
  return { yawDeg: deg(yaw), pitchDeg: deg(pitch) };
}

/**
 * How far the eyes are looking away from centre, 0..1.
 *
 * Left/right are averaged across both eyes rather than summed: looking to one
 * side lights up "out" on one eye and "in" on the other, and summing them would
 * double-count a single glance.
 */
export function gazeOffset(scores: BlendshapeScores): number {
  const s = (k: string) => scores[k] ?? 0;

  // Each direction is the average of the two eyes' contribution, so a full
  // glance scores 1.0 and the thresholds above are actually reachable. Taking
  // the max across directions (rather than summing) keeps one glance worth one
  // glance: looking right lights "out" on one eye and "in" on the other.
  const right = (s("eyeLookOutLeft") + s("eyeLookInRight")) / 2;
  const left = (s("eyeLookOutRight") + s("eyeLookInLeft")) / 2;
  const up = (s("eyeLookUpLeft") + s("eyeLookUpRight")) / 2;
  const down = (s("eyeLookDownLeft") + s("eyeLookDownRight")) / 2;

  return Math.max(right, left, up, down);
}

export interface GazeInput {
  faceDetected: boolean;
  blendshapes?: BlendshapeScores;
  matrix?: number[] | Float32Array;
}

/**
 * One detector reading, in the shape the attention tracker consumes.
 *
 * No face returns confidence 0 rather than "looking away": the tracker treats
 * that as an absent reading and applies its grace period, so someone leaning out
 * of frame for a moment is not instantly a warning.
 */
export function evaluateGaze(
  input: GazeInput,
  thresholds: GazeThresholds = DEFAULT_GAZE_THRESHOLDS
): AttentionSample {
  if (!input.faceDetected) return { attentive: false, confidence: 0 };

  const angles = input.matrix ? headAnglesFromMatrix(input.matrix) : null;
  const offset = input.blendshapes ? gazeOffset(input.blendshapes) : 0;

  const headOk =
    angles === null ||
    (Math.abs(angles.yawDeg) <= thresholds.maxYawDeg &&
      Math.abs(angles.pitchDeg) <= thresholds.maxPitchDeg);
  const eyesOk = offset <= thresholds.maxGaze;

  return { attentive: headOk && eyesOk, confidence: 0.9 };
}
