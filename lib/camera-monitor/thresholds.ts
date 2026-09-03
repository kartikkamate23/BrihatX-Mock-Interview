import type { MonitorState } from "./types";

/**
 * Tunable delays and geometry limits for the camera monitor.
 *
 * Enter delays are the main defence against detector noise: a single bad frame
 * must not raise a warning. Exit delays stop the UI from flickering when the
 * candidate is on the edge of a threshold.
 */
export interface MonitorThresholds {
  noFaceEnterMs: number;
  noFaceEscalateMs: [number, number];
  noFaceExitMs: number;

  multipleFacesEnterMs: number;
  multipleFacesCriticalMs: number;
  multipleFacesExitMs: number;

  placementEnterMs: number;
  placementExitMs: number;

  headTurnEnterMs: number;
  headTurnEscalateMs: [number, number];
  headTurnExitMs: number;

  poorVisibilityEnterMs: number;
  poorVisibilityExitMs: number;

  cameraInterruptedEnterMs: number;
  cameraNoFrameEnterMs: number;
  cameraInterruptedExitMs: number;

  recoverMs: number;
  recoveryBannerMs: number;
  eventCooldownMs: number;

  minFaceWidth: number;
  maxFaceWidth: number;
  faceWidthHysteresis: number;
  maxOffsetX: number;
  maxOffsetY: number;
  edgeMargin: number;

  maxYawDeg: number;
  maxPitchDeg: number;
  maxRollDeg: number;

  minLuminance: number;
  darkLuminance: number;
  minVideoWidth: number;
  minVideoHeight: number;
}

export const DEFAULT_MONITOR_THRESHOLDS: MonitorThresholds = {
  // 0–3s: "Face not detected"; 3–8s: "Please return"; 8s+: "Camera attention required".
  noFaceEnterMs: 400,
  noFaceEscalateMs: [3_000, 8_000],
  noFaceExitMs: 600,

  // Two faces for ~two samples at 400ms, not a single noisy frame.
  multipleFacesEnterMs: 800,
  multipleFacesCriticalMs: 4_000,
  multipleFacesExitMs: 1_000,

  // Position warnings wait longer so small movements are ignored.
  placementEnterMs: 1_500,
  placementExitMs: 800,

  headTurnEnterMs: 2_000,
  headTurnEscalateMs: [6_000, 12_000],
  headTurnExitMs: 800,

  poorVisibilityEnterMs: 1_500,
  poorVisibilityExitMs: 800,

  cameraInterruptedEnterMs: 500,
  cameraNoFrameEnterMs: 2_500,
  cameraInterruptedExitMs: 400,

  recoverMs: 600,
  recoveryBannerMs: 2_500,
  eventCooldownMs: 8_000,

  minFaceWidth: 0.14,
  maxFaceWidth: 0.62,
  faceWidthHysteresis: 0.03,
  maxOffsetX: 0.22,
  maxOffsetY: 0.20,
  edgeMargin: 0.03,

  // Matches lib/gaze.ts: generous, because a false warning is worse than a miss.
  maxYawDeg: 30,
  maxPitchDeg: 24,
  maxRollDeg: 28,

  minLuminance: 22,
  darkLuminance: 14,
  minVideoWidth: 320,
  minVideoHeight: 240,
};

export function enterDelayMs(
  state: MonitorState,
  thresholds: MonitorThresholds,
  detail?: string
): number {
  switch (state) {
    case "NO_FACE":
      return thresholds.noFaceEnterMs;
    case "MULTIPLE_FACES":
      return thresholds.multipleFacesEnterMs;
    case "FACE_TOO_FAR":
    case "FACE_TOO_CLOSE":
    case "FACE_OFF_CENTER":
      return thresholds.placementEnterMs;
    case "HEAD_TURNED":
      return thresholds.headTurnEnterMs;
    case "POOR_VISIBILITY":
      return thresholds.poorVisibilityEnterMs;
    case "CAMERA_INTERRUPTED":
      return detail === "no_frame"
        ? thresholds.cameraNoFrameEnterMs
        : thresholds.cameraInterruptedEnterMs;
    case "CAMERA_UNAVAILABLE":
      return 200;
    case "FACE_OK":
      return thresholds.recoverMs;
    default:
      return 800;
  }
}

export function exitDelayMs(
  state: MonitorState,
  thresholds: MonitorThresholds
): number {
  switch (state) {
    case "NO_FACE":
      return thresholds.noFaceExitMs;
    case "MULTIPLE_FACES":
      return thresholds.multipleFacesExitMs;
    case "FACE_TOO_FAR":
    case "FACE_TOO_CLOSE":
    case "FACE_OFF_CENTER":
      return thresholds.placementExitMs;
    case "HEAD_TURNED":
      return thresholds.headTurnExitMs;
    case "POOR_VISIBILITY":
      return thresholds.poorVisibilityExitMs;
    case "CAMERA_INTERRUPTED":
    case "CAMERA_UNAVAILABLE":
      return thresholds.cameraInterruptedExitMs;
    default:
      return thresholds.recoverMs;
  }
}
