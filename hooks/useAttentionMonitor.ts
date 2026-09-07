"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AttentionEvent } from "@/lib/attention";
import { classifyObservation } from "@/lib/camera-monitor/classify";
import { faceBoxFromLandmarks, meanLuminance } from "@/lib/camera-monitor/geometry";
import {
  DEFAULT_MONITOR_THRESHOLDS,
  enterDelayMs,
  exitDelayMs,
  type MonitorThresholds,
} from "@/lib/camera-monitor/thresholds";
import type {
  Classification,
  FrameObservation,
  MonitorSeverity,
  MonitorView,
} from "@/lib/camera-monitor/types";
import {
  evaluateGaze,
  headAnglesFromMatrix,
  type BlendshapeScores,
} from "@/lib/gaze";

const SAMPLE_INTERVAL_MS = 320;
const INFERENCE_WIDTH = 320;
const MAX_DUTY_CYCLE = 0.32;
const VISION_BUNDLE_URL = "/mediapipe/vision_bundle.mjs";

/** Deliberately strict, while retaining short debounce windows for detector noise. */
const STRICT_THRESHOLDS: MonitorThresholds = {
  ...DEFAULT_MONITOR_THRESHOLDS,
  noFaceEnterMs: 300,
  noFaceEscalateMs: [2_000, 5_000],
  noFaceExitMs: 500,
  multipleFacesEnterMs: 500,
  multipleFacesCriticalMs: 2_500,
  multipleFacesExitMs: 700,
  placementEnterMs: 900,
  placementExitMs: 650,
  headTurnEnterMs: 1_200,
  headTurnEscalateMs: [3_500, 7_000],
  headTurnExitMs: 650,
  poorVisibilityEnterMs: 900,
  poorVisibilityExitMs: 700,
  minFaceWidth: 0.16,
  maxFaceWidth: 0.58,
  maxOffsetX: 0.16,
  maxOffsetY: 0.15,
  maxYawDeg: 20,
  maxPitchDeg: 16,
  maxRollDeg: 20,
  minLuminance: 30,
  darkLuminance: 18,
};

function loadVision(): Promise<typeof import("@mediapipe/tasks-vision")> {
  return (
    new Function("url", "return import(url)") as (
      url: string
    ) => Promise<typeof import("@mediapipe/tasks-vision")>
  )(VISION_BUNDLE_URL);
}

const BENIGN_RUNTIME_MESSAGES = [
  "Created TensorFlow Lite XNNPACK delegate for CPU",
  "XNNPACK delegate for CPU",
];

async function withRuntimeNoticesDemoted<T>(work: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      BENIGN_RUNTIME_MESSAGES.some((notice) => first.includes(notice))
    ) {
      console.debug("[CAMERA MONITOR] runtime notice:", ...args);
      return;
    }
    original.apply(console, args as Parameters<typeof console.error>);
  };
  try {
    return await work();
  } finally {
    console.error = original;
  }
}

const SAFE_VIEW: MonitorView = {
  state: "FACE_OK",
  severity: "INFO",
  title: "Interview conditions verified",
  message: "One face is visible and attention is directed at the camera.",
  visible: false,
  faceStatus: "detected",
  attentionStatus: "ok",
  cameraStatus: "active",
  poorQuality: false,
};

function warningView(
  classification: Classification,
  activeForMs: number
): MonitorView {
  const { state, detail } = classification;
  let severity: MonitorSeverity = "WARNING";
  let title = "Camera attention required";
  let message = "Please face the camera and remain centered.";

  switch (state) {
    case "NO_FACE":
      severity = activeForMs >= 5_000 ? "CRITICAL" : activeForMs >= 2_000 ? "HIGH" : "WARNING";
      title = "Face not detected";
      message = "Return to the frame immediately. Your full face must remain visible throughout the interview.";
      break;
    case "MULTIPLE_FACES":
      severity = activeForMs >= STRICT_THRESHOLDS.multipleFacesCriticalMs ? "CRITICAL" : "HIGH";
      title = "Multiple faces detected";
      message = "Only the candidate may be visible. Ask every other person to leave the camera frame.";
      break;
    case "HEAD_TURNED":
      severity = activeForMs >= 7_000 ? "CRITICAL" : activeForMs >= 3_500 ? "HIGH" : "WARNING";
      title = "Look directly at the camera";
      message = detail === "left" || detail === "right"
        ? `Your attention is directed ${detail}. Keep your eyes and face toward the camera.`
        : "Your eyes or head are turned away. Maintain direct camera attention.";
      break;
    case "FACE_TOO_FAR":
      title = "Move closer to the camera";
      message = "Your face is too small for reliable monitoring. Sit closer and keep your shoulders visible.";
      break;
    case "FACE_TOO_CLOSE":
      title = "Move back from the camera";
      message = "Your face is too close. Keep your entire face and shoulders inside the frame.";
      break;
    case "FACE_OFF_CENTER":
      title = "Center your face";
      message = "Your face is partly outside the interview frame. Sit upright in the center.";
      break;
    case "POOR_VISIBILITY":
      severity = "HIGH";
      title = "Face visibility is too low";
      message = "Increase the light in front of you. Your face must be clearly visible, without backlighting.";
      break;
    case "CAMERA_INTERRUPTED":
      severity = "CRITICAL";
      title = "Camera feed interrupted";
      message = "Restore the camera immediately. The interview requires a continuous live camera feed.";
      break;
    case "CAMERA_UNAVAILABLE":
      severity = "CRITICAL";
      title = "Camera is required";
      message = "Turn on and allow your camera to continue under interview conditions.";
      break;
  }

  return {
    state,
    severity,
    title,
    message,
    visible: state !== "FACE_OK",
    faceStatus:
      state === "MULTIPLE_FACES"
        ? "multiple"
        : state === "NO_FACE" || state === "POOR_VISIBILITY"
          ? "not_detected"
          : state === "CAMERA_UNAVAILABLE" || state === "CAMERA_INTERRUPTED"
            ? "unknown"
            : "detected",
    attentionStatus:
      state === "HEAD_TURNED"
        ? "turned_away"
        : state === "FACE_OK"
          ? "ok"
          : "required",
    cameraStatus:
      state === "CAMERA_UNAVAILABLE"
        ? "off"
        : state === "CAMERA_INTERRUPTED"
          ? "interrupted"
          : "active",
    poorQuality: state === "POOR_VISIBILITY",
  };
}

interface ActiveWarning {
  classification: Classification;
  startedAt: number;
  eventIndex: number;
}

export interface AttentionMonitor {
  warningActive: boolean;
  warningCount: number;
  ready: boolean;
  events: AttentionEvent[];
  view: MonitorView;
  start: (video: HTMLVideoElement) => Promise<void>;
  stop: () => AttentionEvent[];
}

/**
 * Local-only interview proctoring. Frames and landmarks never leave the browser;
 * only warning timestamps and condition names are kept for the feedback summary.
 */
export function useAttentionMonitor(): AttentionMonitor {
  const landmarkerRef = useRef<{
    detectForVideo: (
      source: HTMLVideoElement | HTMLCanvasElement,
      timestamp: number
    ) => {
      faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
      faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
      facialTransformationMatrixes?: { data: number[] }[];
    };
    close?: () => void;
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const candidateRef = useRef<{ classification: Classification; since: number } | null>(null);
  const activeRef = useRef<ActiveWarning | null>(null);
  const healthySinceRef = useRef<number | null>(null);
  const eventsRef = useRef<AttentionEvent[]>([]);

  const [ready, setReady] = useState(false);
  const [view, setView] = useState<MonitorView>(SAFE_VIEW);
  const [warningCount, setWarningCount] = useState(0);
  const [events, setEvents] = useState<AttentionEvent[]>([]);

  const publishEvents = useCallback(() => {
    setEvents(eventsRef.current.map((event) => ({ ...event })));
  }, []);

  const closeActive = useCallback((elapsed: number) => {
    const active = activeRef.current;
    if (!active) return;
    const event = eventsRef.current[active.eventIndex];
    if (event) {
      event.resolvedAt = elapsed;
      event.duration = Math.max(0, elapsed - event.startedAt);
    }
    activeRef.current = null;
    publishEvents();
  }, [publishEvents]);

  const applyObservation = useCallback((observation: FrameObservation) => {
    const elapsed = observation.atMs;
    const active = activeRef.current;
    const classification = classifyObservation(
      observation,
      active?.classification.state ?? "FACE_OK",
      STRICT_THRESHOLDS
    );

    if (classification.state === "FACE_OK") {
      candidateRef.current = null;
      if (!active) {
        healthySinceRef.current = null;
        setView((current) => current.state === "FACE_OK" ? current : SAFE_VIEW);
        return;
      }
      if (healthySinceRef.current === null) healthySinceRef.current = elapsed;
      if (
        elapsed - healthySinceRef.current >=
        exitDelayMs(active.classification.state, STRICT_THRESHOLDS)
      ) {
        closeActive(elapsed);
        setView(SAFE_VIEW);
        healthySinceRef.current = null;
      }
      return;
    }

    healthySinceRef.current = null;
    if (active?.classification.state === classification.state) {
      setView(warningView(classification, elapsed - active.startedAt));
      return;
    }

    const candidate = candidateRef.current;
    if (
      !candidate ||
      candidate.classification.state !== classification.state ||
      candidate.classification.detail !== classification.detail
    ) {
      candidateRef.current = { classification, since: elapsed };
      return;
    }

    if (
      elapsed - candidate.since <
      enterDelayMs(classification.state, STRICT_THRESHOLDS, classification.detail)
    ) return;

    if (active) closeActive(elapsed);
    const eventIndex = eventsRef.current.length;
    eventsRef.current.push({
      type: "attention_warning",
      reason: classification.state,
      startedAt: candidate.since,
      duration: null,
      resolvedAt: null,
    });
    activeRef.current = {
      classification,
      startedAt: candidate.since,
      eventIndex,
    };
    candidateRef.current = null;
    setWarningCount((count) => count + 1);
    setView(warningView(classification, elapsed - candidate.since));
    publishEvents();
  }, [closeActive, publishEvents]);

  const stop = useCallback((): AttentionEvent[] => {
    runningRef.current = false;
    generationRef.current += 1;
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const elapsed = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    closeActive(elapsed);
    try { landmarkerRef.current?.close?.(); } catch { /* already ending */ }
    landmarkerRef.current = null;
    setReady(false);
    setView(SAFE_VIEW);
    return eventsRef.current.map((event) => ({ ...event }));
  }, [closeActive]);

  const start = useCallback(async (video: HTMLVideoElement) => {
    if (runningRef.current) return;
    const generation = ++generationRef.current;
    eventsRef.current = [];
    activeRef.current = null;
    candidateRef.current = null;
    healthySinceRef.current = null;
    setEvents([]);
    setWarningCount(0);
    setView(SAFE_VIEW);
    runningRef.current = true;
    startedAtRef.current = Date.now();

    try {
      const vision = await loadVision();
      if (!runningRef.current || generation !== generationRef.current) return;
      const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe");
      if (!runningRef.current || generation !== generationRef.current) return;
      const landmarker = await withRuntimeNoticesDemoted(() =>
        vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 3,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        })
      );
      if (!runningRef.current || generation !== generationRef.current) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker as unknown as typeof landmarkerRef.current;
      setReady(true);
      const scratch = document.createElement("canvas");
      const ctx = scratch.getContext("2d", { willReadFrequently: true });

      const sampleOnce = () => {
        const lm = landmarkerRef.current;
        if (!lm || !runningRef.current || generation !== generationRef.current) return;
        const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
        const began = performance.now();
        const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
        const frameAvailable = Boolean(
          video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 &&
          !video.ended && track?.readyState === "live" && track.enabled
        );

        if (!frameAvailable) {
          const camera = !track
            ? "unavailable"
            : !track.enabled
              ? "disabled"
              : track.readyState !== "live"
                ? "interrupted"
                : "no_frame";
          applyObservation({ atMs: elapsed, camera, faceCount: 0 });
        } else {
          try {
            const scale = INFERENCE_WIDTH / video.videoWidth;
            const width = INFERENCE_WIDTH;
            const height = Math.max(1, Math.round(video.videoHeight * scale));
            if (scratch.width !== width || scratch.height !== height) {
              scratch.width = width;
              scratch.height = height;
            }
            ctx?.drawImage(video, 0, 0, width, height);
            const result = lm.detectForVideo(ctx ? scratch : video, began);
            const landmarks = result.faceLandmarks ?? [];
            const faceCount = landmarks.length;
            const matrix = result.facialTransformationMatrixes?.[0]?.data;
            const angles = matrix ? headAnglesFromMatrix(matrix) : null;
            const categories = result.faceBlendshapes?.[0]?.categories;
            let blendshapes: BlendshapeScores | undefined;
            if (categories) {
              blendshapes = {};
              for (const category of categories) {
                blendshapes[category.categoryName] = category.score;
              }
            }
            const gaze = evaluateGaze(
              { faceDetected: faceCount > 0, blendshapes, matrix },
              { maxYawDeg: 20, maxPitchDeg: 16, maxGaze: 0.45 }
            );
            const luminance = ctx
              ? meanLuminance(ctx.getImageData(0, 0, width, height).data)
              : null;

            applyObservation({
              atMs: elapsed,
              camera: "ready",
              faceCount,
              faceBox: faceBoxFromLandmarks(landmarks[0] ?? []),
              yawDeg: angles?.yawDeg,
              pitchDeg: angles?.pitchDeg,
              luminance,
              attentive: gaze.attentive,
              confidence: gaze.confidence,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
            });
          } catch (error) {
            console.debug("[CAMERA MONITOR] detection frame skipped", error);
          }
        }

        if (!runningRef.current || generation !== generationRef.current) return;
        const cost = performance.now() - began;
        timeoutRef.current = setTimeout(
          sampleOnce,
          Math.max(SAMPLE_INTERVAL_MS, Math.round(cost * (1 / MAX_DUTY_CYCLE - 1)))
        );
      };

      timeoutRef.current = setTimeout(sampleOnce, SAMPLE_INTERVAL_MS);
    } catch (error) {
      console.warn("[CAMERA MONITOR] unavailable", error);
      if (generation === generationRef.current) {
        runningRef.current = false;
        setReady(false);
      }
    }
  }, [applyObservation]);

  useEffect(() => () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    try { landmarkerRef.current?.close?.(); } catch { /* unmount cleanup */ }
    landmarkerRef.current = null;
    runningRef.current = false;
    generationRef.current += 1;
  }, []);

  return {
    warningActive: view.visible,
    warningCount,
    ready,
    events,
    view,
    start,
    stop,
  };
}
