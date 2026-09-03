import type {
  Classification,
  FrameObservation,
  MonitorState,
} from "./types";
import { faceMetrics } from "./geometry";
import {
  DEFAULT_MONITOR_THRESHOLDS,
  type MonitorThresholds,
} from "./thresholds";

/**
 * Maps one camera observation to a raw condition.
 *
 * Priority is deliberate: a missing camera is more important than a second
 * face, which is more important than pose. The warning engine still applies
 * enter/exit delays on top of this, so a single noisy frame does not win.
 */
export function classifyObservation(
  observation: FrameObservation,
  previous: MonitorState = "FACE_OK",
  thresholds: MonitorThresholds = DEFAULT_MONITOR_THRESHOLDS
): Classification {
  if (observation.camera === "unavailable") {
    return { state: "CAMERA_UNAVAILABLE" };
  }
  if (observation.camera === "disabled") {
    return { state: "CAMERA_UNAVAILABLE", detail: "disabled" };
  }
  if (observation.camera === "interrupted") {
    return { state: "CAMERA_INTERRUPTED" };
  }
  if (observation.camera === "no_frame") {
    return { state: "CAMERA_INTERRUPTED", detail: "no_frame" };
  }

  if (observation.faceCount >= 2) {
    return { state: "MULTIPLE_FACES" };
  }

  const dark =
    typeof observation.luminance === "number" &&
    observation.luminance < thresholds.minLuminance;
  const veryDark =
    typeof observation.luminance === "number" &&
    observation.luminance < thresholds.darkLuminance;

  if (observation.faceCount === 0) {
    if (dark) return { state: "POOR_VISIBILITY" };
    return { state: "NO_FACE" };
  }

  if (veryDark) return { state: "POOR_VISIBILITY" };

  if (observation.faceBox) {
    const metrics = faceMetrics(observation.faceBox, thresholds.edgeMargin);
    const minWidth =
      previous === "FACE_TOO_FAR"
        ? thresholds.minFaceWidth + thresholds.faceWidthHysteresis
        : thresholds.minFaceWidth;
    const maxWidth =
      previous === "FACE_TOO_CLOSE"
        ? thresholds.maxFaceWidth - thresholds.faceWidthHysteresis
        : thresholds.maxFaceWidth;

    if (metrics.width < minWidth) return { state: "FACE_TOO_FAR" };
    if (metrics.width > maxWidth) return { state: "FACE_TOO_CLOSE" };
    if (metrics.clipped) {
      return { state: "FACE_OFF_CENTER", detail: "partial" };
    }
    if (
      Math.abs(metrics.centerX - 0.5) > thresholds.maxOffsetX ||
      Math.abs(metrics.centerY - 0.45) > thresholds.maxOffsetY
    ) {
      return { state: "FACE_OFF_CENTER", detail: "off_center" };
    }
  }

  const yaw = observation.yawDeg;
  const pitch = observation.pitchDeg;
  const roll = observation.rollDeg;
  const headTurned =
    (typeof yaw === "number" && Math.abs(yaw) > thresholds.maxYawDeg) ||
    (typeof pitch === "number" && Math.abs(pitch) > thresholds.maxPitchDeg) ||
    (typeof roll === "number" && Math.abs(roll) > thresholds.maxRollDeg);

  const gazeAway =
    observation.attentive === false &&
    (observation.confidence ?? 0) >= 0.4;

  if (headTurned || gazeAway) {
    const detail =
      typeof yaw === "number" && Math.abs(yaw) > thresholds.maxYawDeg
        ? yaw < 0
          ? "left"
          : "right"
        : undefined;
    return { state: "HEAD_TURNED", detail };
  }

  return { state: "FACE_OK" };
}
