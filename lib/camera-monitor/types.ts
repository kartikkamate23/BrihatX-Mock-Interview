/**
 * Observable camera-monitor conditions.
 *
 * These are detections of what the camera feed looks like, not judgements
 * about cheating, identity, or intent. Nothing here identifies a person.
 */

export type MonitorState =
  | "FACE_OK"
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "FACE_TOO_FAR"
  | "FACE_TOO_CLOSE"
  | "FACE_OFF_CENTER"
  | "HEAD_TURNED"
  | "CAMERA_UNAVAILABLE"
  | "CAMERA_INTERRUPTED"
  | "POOR_VISIBILITY";

export type MonitorSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export type MonitorEventType =
  | "camera_started"
  | "camera_permission_denied"
  | "face_detected"
  | "face_lost"
  | "multiple_faces_detected"
  | "multiple_faces_resolved"
  | "head_turn_detected"
  | "head_turn_resolved"
  | "camera_interrupted"
  | "camera_restored"
  | "attention_warning";

export type CameraFeedStatus =
  | "ready"
  | "unavailable"
  | "interrupted"
  | "disabled"
  | "no_frame";

export interface FaceBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FrameObservation {
  atMs: number;
  camera: CameraFeedStatus;
  faceCount: number;
  faceBox?: FaceBox | null;
  yawDeg?: number | null;
  pitchDeg?: number | null;
  rollDeg?: number | null;
  /** Mean luminance of the inference frame, 0..255. */
  luminance?: number | null;
  /** Combined head-pose / gaze reading from evaluateGaze. */
  attentive?: boolean;
  confidence?: number;
  videoWidth?: number;
  videoHeight?: number;
}

export type PlacementDetail = "partial" | "off_center";

export interface Classification {
  state: MonitorState;
  detail?: PlacementDetail | "disabled" | "no_frame" | "left" | "right";
}

export interface MonitorHistoryEvent {
  type: MonitorEventType;
  timestamp: number;
  severity: MonitorSeverity;
  message?: string;
}

export interface MonitorView {
  state: MonitorState;
  severity: MonitorSeverity;
  title: string;
  message: string;
  /** True when the banner should stay on screen. */
  visible: boolean;
  faceStatus: "detected" | "not_detected" | "multiple" | "unknown";
  attentionStatus: "ok" | "turned_away" | "required";
  cameraStatus: "active" | "unavailable" | "interrupted" | "off";
  poorQuality: boolean;
}

export interface MonitorSnapshot {
  view: MonitorView;
  history: MonitorHistoryEvent[];
}

export const WARNING_EVENT_TYPES: ReadonlySet<MonitorEventType> = new Set([
  "attention_warning",
  "multiple_faces_detected",
  "face_lost",
  "head_turn_detected",
  "camera_interrupted",
  "camera_permission_denied",
]);
