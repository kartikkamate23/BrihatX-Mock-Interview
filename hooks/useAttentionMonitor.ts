"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  createAttentionTracker,
  type AttentionEvent,
  type AttentionSnapshot,
} from "@/lib/attention";
import { evaluateGaze, type BlendshapeScores } from "@/lib/gaze";

/**
 * Minimum gap between samples. ~3 Hz is ample for a rule measured in seconds,
 * and the loop below backs off further whenever inference is slow.
 */
const MIN_SAMPLE_INTERVAL_MS = 400;
/**
 * Inference runs on a downscaled copy of the frame. Face landmarks do not need
 * 640x480, and the cost scales with pixel count -- at full size on a machine
 * without a usable GPU this was slow enough to starve the interview timer.
 */
const INFERENCE_WIDTH = 256;
/**
 * Never spend more than this share of wall-clock time on inference. Face
 * detection must lose to the interview: at a fixed high rate on a slow machine
 * each frame takes longer than the gap between frames, the queue never drains,
 * and it starves the very timer that ends the interview.
 */
const MAX_DUTY_CYCLE = 0.25;

const VISION_BUNDLE_URL = "/mediapipe/vision_bundle.mjs";

/**
 * Imports the vision bundle without the bundler seeing the specifier.
 * `new Function` is the escape hatch: a literal `import()` would be rewritten
 * at build time and pull the package back into the graph.
 */
function loadVision(): Promise<typeof import("@mediapipe/tasks-vision")> {
  return (
    new Function("url", "return import(url)") as (
      url: string
    ) => Promise<typeof import("@mediapipe/tasks-vision")>
  )(VISION_BUNDLE_URL);
}

/**
 * Text the MediaPipe/TensorFlow wasm runtime writes to `console.error` even
 * though nothing has gone wrong.
 *
 * "INFO: Created TensorFlow Lite XNNPACK delegate for CPU." is the inference
 * backend announcing which delegate it selected -- it is a success message, and
 * it is prefixed "INFO" by the runtime itself. It reaches console.error only
 * because Emscripten routes the wasm module's stderr there wholesale.
 *
 * That matters in development: Next.js treats a console.error during render as
 * an application error and raises its error overlay over the interview, so a
 * working attention monitor looked like a crash. The filter below is
 * deliberately an exact-substring allowlist rather than a blanket silencer, is
 * installed only for the moment the model is being created, and is removed in a
 * `finally` -- so a genuine error from the same runtime, before or after, still
 * reaches the console untouched.
 */
const BENIGN_RUNTIME_MESSAGES = [
  "Created TensorFlow Lite XNNPACK delegate for CPU",
  "XNNPACK delegate for CPU",
];

function isBenignRuntimeNotice(args: unknown[]): boolean {
  const first = args[0];
  if (typeof first !== "string") return false;
  return BENIGN_RUNTIME_MESSAGES.some((notice) => first.includes(notice));
}

/**
 * Runs `work` with the wasm runtime's informational stderr demoted to
 * `console.debug`. Everything else is passed straight through.
 */
async function withRuntimeNoticesDemoted<T>(work: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (isBenignRuntimeNotice(args)) {
      console.debug("[ATTENTION] runtime notice:", ...args);
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

export interface AttentionMonitor {
  warningActive: boolean;
  warningCount: number;
  /** Null until the detector has loaded. */
  ready: boolean;
  events: AttentionEvent[];
  start: (video: HTMLVideoElement) => Promise<void>;
  stop: () => AttentionEvent[];
}

/**
 * Watches whether the candidate appears to be looking at the screen.
 *
 * Everything runs in the browser against a locally served model: no frame, and
 * no derived landmark, is ever sent anywhere. The monitor is also strictly
 * advisory -- it reports, and can fail, without touching the interview. If the
 * model will not load the interview simply proceeds unmonitored.
 */
export function useAttentionMonitor(): AttentionMonitor {
  const trackerRef = useRef(createAttentionTracker());
  const landmarkerRef = useRef<{
    detectForVideo: (
      v: HTMLVideoElement | HTMLCanvasElement,
      t: number
    ) => {
      faceLandmarks?: unknown[];
      faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
      facialTransformationMatrixes?: { data: number[] }[];
    };
    close?: () => void;
  } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  /** Invalidates model loads and sampling loops from an older run. */
  const generationRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<AttentionSnapshot>(() =>
    trackerRef.current.snapshot()
  );

  const publishSnapshot = useCallback((next: AttentionSnapshot) => {
    setSnapshot((current) => {
      if (
        current.state === next.state &&
        current.warningActive === next.warningActive &&
        current.warningCount === next.warningCount &&
        current.events.length === next.events.length
      ) {
        return current;
      }
      return next;
    });
  }, []);

  const stop = useCallback((): AttentionEvent[] => {
    runningRef.current = false;
    generationRef.current += 1;
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const now = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    const final = trackerRef.current.finalize(now);
    publishSnapshot(final);
    try {
      landmarkerRef.current?.close?.();
    } catch {
      /* the task is being torn down anyway */
    }
    landmarkerRef.current = null;
    setReady(false);
    return final.events;
  }, [publishSnapshot]);

  const start = useCallback(async (video: HTMLVideoElement) => {
    if (runningRef.current) return;
    const generation = ++generationRef.current;
    // Retries without a remount are a new monitoring run. Do not carry warning
    // events from an abandoned attempt into this interview.
    trackerRef.current = createAttentionTracker();
    publishSnapshot(trackerRef.current.snapshot());
    runningRef.current = true;
    startedAtRef.current = Date.now();

    try {
      // Loaded at runtime from /public, deliberately outside the bundler's
      // module graph. The package resolves its own wasm loader through a
      // computed dynamic import, which Turbopack cannot statically analyse and
      // fails the whole build on ("Can't resolve <dynamic>"). MediaPipe ships
      // this file to be consumed exactly this way, and keeping it out of the
      // bundle also means the ~30MB of assets never load for users who do not
      // start an interview.
      const vision: typeof import("@mediapipe/tasks-vision") = await loadVision();
      if (!runningRef.current || generation !== generationRef.current) return;
      const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe");
      if (!runningRef.current || generation !== generationRef.current) return;
      const landmarker = await withRuntimeNoticesDemoted(() =>
        vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/models/face_landmarker.task",
            // CPU rather than GPU: the GPU path needs a readback per frame, and
            // where the GPU is a software rasteriser that stall dominates the
            // frame and blocks the main thread.
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        })
      );

      if (!runningRef.current || generation !== generationRef.current) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker as unknown as typeof landmarkerRef.current;
      setReady(true);

      // Self-scheduling rather than setInterval: the next sample is only
      // queued once the current one has finished, so slow inference can never
      // build a backlog that blocks the event loop.
      // Reused across frames; allocating a canvas per sample would churn memory.
      const scratch = document.createElement("canvas");
      const ctx = scratch.getContext("2d", { willReadFrequently: true });

      const sampleOnce = () => {
        const lm = landmarkerRef.current;
        if (
          !lm ||
          !runningRef.current ||
          generation !== generationRef.current
        )
          return;

        const elapsed = Date.now() - (startedAtRef.current ?? Date.now());
        const began = performance.now();

        // Every precondition detectForVideo needs, checked before it is called.
        //
        // The task throws on an element that has no decoded frame, and it also
        // throws on one whose dimensions are still zero -- which happens for a
        // moment after the stream is attached, and again permanently if the
        // candidate turns the camera off mid-interview or the track ends. A
        // paused or ended element is not an error either; it just has nothing
        // new to look at, so the tracker is fed an absent reading and its grace
        // period applies rather than the candidate being blamed for it.
        const track = (video.srcObject as MediaStream | null)
          ?.getVideoTracks()
          .find(() => true);
        const frameAvailable =
          video.readyState >= 2 &&
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          !video.ended &&
          track?.readyState === "live" &&
          track.enabled;

        if (!frameAvailable) {
          publishSnapshot(trackerRef.current.update(null, elapsed));
        } else {
          try {
            // Downscale first, preserving aspect ratio.
            const scale = INFERENCE_WIDTH / video.videoWidth;
            const w = INFERENCE_WIDTH;
            const h = Math.max(1, Math.round(video.videoHeight * scale));
            if (scratch.width !== w || scratch.height !== h) {
              scratch.width = w;
              scratch.height = h;
            }
            ctx?.drawImage(video, 0, 0, w, h);

            const result = lm.detectForVideo(ctx ? scratch : video, began);
            const faceDetected = (result.faceLandmarks?.length ?? 0) > 0;

            let blendshapes: BlendshapeScores | undefined;
            const cats = result.faceBlendshapes?.[0]?.categories;
            if (cats) {
              blendshapes = {};
              for (const c of cats) blendshapes[c.categoryName] = c.score;
            }

            publishSnapshot(
              trackerRef.current.update(
                evaluateGaze({
                  faceDetected,
                  blendshapes,
                  matrix: result.facialTransformationMatrixes?.[0]?.data,
                }),
                elapsed
              )
            );
          } catch (error) {
            // A failed frame is not evidence of anything. Feed null so the
            // tracker's grace period applies instead of blaming the candidate.
            console.debug("[ATTENTION] detection frame skipped", error);
            publishSnapshot(trackerRef.current.update(null, elapsed));
          }
        }

        if (!runningRef.current || generation !== generationRef.current) return;
        const cost = performance.now() - began;
        // Wait proportionally longer after an expensive frame.
        const wait = Math.max(
          MIN_SAMPLE_INTERVAL_MS,
          Math.round(cost * (1 / MAX_DUTY_CYCLE - 1))
        );
        timeoutRef.current = setTimeout(sampleOnce, wait);
      };

      timeoutRef.current = setTimeout(sampleOnce, MIN_SAMPLE_INTERVAL_MS);
    } catch (error) {
      // Monitoring is advisory: losing it must never cost the interview.
      console.warn(
        "[ATTENTION] monitor unavailable; the interview continues without it",
        error
      );
      // A superseded load must not stop a newer monitoring run.
      if (generation === generationRef.current) {
        runningRef.current = false;
        setReady(false);
      }
    }
  }, [publishSnapshot]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      try {
        landmarkerRef.current?.close?.();
      } catch {
        /* ignore */
      }
      landmarkerRef.current = null;
      runningRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  return {
    warningActive: snapshot.warningActive,
    warningCount: snapshot.warningCount,
    events: snapshot.events,
    ready,
    start,
    stop,
  };
}
