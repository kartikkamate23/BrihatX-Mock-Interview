"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MediaStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unavailable"
  | "error";

export interface InterviewMedia {
  /** Attach to a <video autoPlay playsInline muted /> to show the candidate. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: MediaStatus;
  /** User-facing explanation when status is not "ready". */
  message: string | null;
  /** Which device caused the failure, so the UI can say which one to allow. */
  blocked: "camera" | "microphone" | "both" | null;
  cameraEnabled: boolean;
  micEnabled: boolean;
  /** Whether each device currently has a live, enabled track. */
  cameraLive: boolean;
  micLive: boolean;
  /** The live stream, once granted. Null before that and after stop(). */
  stream: MediaStream | null;
  /** Asks for camera + microphone in a single prompt. Safe to call again. */
  request: () => Promise<boolean>;
  /** Replaces only a lost camera track while preserving the live microphone. */
  retryCamera: () => Promise<boolean>;
  toggleCamera: () => void;
  toggleMic: () => void;
  /** Releases the webcam and microphone. Idempotent. */
  stop: () => void;
}

type BlockedDevice = "camera" | "microphone" | "both" | null;

interface DeviceDiagnosis {
  blocked: BlockedDevice;
  hasCamera: boolean;
  hasMicrophone: boolean;
}

function buildDeniedMessage(blocked: BlockedDevice): string {
  switch (blocked) {
    case "camera":
      return "Camera access was blocked. Allow it from the padlock icon in the address bar, then try again.";
    case "microphone":
      return "Microphone access was blocked. Allow it from the padlock icon in the address bar, then try again.";
    case "both":
    default:
      return "Camera and microphone access was blocked. An interview needs both. Click the padlock icon in the address bar, allow them, then try again.";
  }
}

function buildUnavailableMessage(diagnosis: DeviceDiagnosis): string {
  const { hasCamera, hasMicrophone } = diagnosis;
  if (!hasCamera && !hasMicrophone) {
    return "No camera or microphone was found. Connect both and try again.";
  }
  if (!hasCamera) {
    return "No camera was found. Connect one and try again.";
  }
  if (!hasMicrophone) {
    return "No microphone was found. Connect one and try again.";
  }
  return "The camera or microphone is unavailable right now. Check your devices and try again.";
}

async function diagnoseDevices(): Promise<DeviceDiagnosis> {
  let hasCamera = true;
  let hasMicrophone = true;
  let cameraPermission: PermissionState | null = null;
  let microphonePermission: PermissionState | null = null;

  if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      hasCamera = devices.some((device) => device.kind === "videoinput");
      hasMicrophone = devices.some((device) => device.kind === "audioinput");
    } catch {
      // Permission-denied browsers can refuse enumeration; presence remains unknown.
    }
  }

  if (typeof navigator !== "undefined" && "permissions" in navigator) {
    const permissions = navigator.permissions;
    try {
      cameraPermission = (
        await permissions.query({ name: "camera" as PermissionName })
      ).state;
    } catch {
      /* not supported in this browser */
    }
    try {
      microphonePermission = (
        await permissions.query({ name: "microphone" as PermissionName })
      ).state;
    } catch {
      /* not supported in this browser */
    }
  }

  const cameraDenied = cameraPermission === "denied";
  const microphoneDenied = microphonePermission === "denied";
  const blocked: BlockedDevice =
    cameraDenied && microphoneDenied
      ? "both"
      : cameraDenied
        ? "camera"
        : microphoneDenied
          ? "microphone"
          : !hasCamera && !hasMicrophone
            ? "both"
            : !hasCamera
              ? "camera"
              : !hasMicrophone
                ? "microphone"
                : "both";

  return { blocked, hasCamera, hasMicrophone };
}

/**
 * Owns the candidate's camera and microphone for the interview.
 *
 * One combined `getUserMedia({ video, audio })` prompt rather than two, because
 * two consecutive permission dialogs read as something going wrong.
 *
 * Note for anyone reading this against the project's history: an earlier version
 * deliberately stopped and discarded the audio track here, because the previous
 * voice SDK opened and owned its own microphone stream and two capture sessions
 * on one device shows up on Windows as "the microphone is in use by another
 * application". That is no longer true. The application now captures the
 * microphone itself and streams it to the model, so the audio track must be kept
 * -- it is the interview's input.
 */
export function useInterviewMedia(): InterviewMedia {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestPromiseRef = useRef<Promise<boolean> | null>(null);
  const requestGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<MediaStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<"camera" | "microphone" | "both" | null>(
    null
  );
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraLive, setCameraLive] = useState(false);
  const [micLive, setMicLive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const stop = useCallback(() => {
    // Invalidates a permission request that resolves after teardown.
    requestGenerationRef.current += 1;
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach((track) => {
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) {
      setStream(null);
      setCameraLive(false);
      setMicLive(false);
      setStatus("idle");
    }
  }, []);

  const performRequest = useCallback(async (): Promise<boolean> => {
    const generation = ++requestGenerationRef.current;
    // Already holding live tracks: nothing to ask for.
    const existing = streamRef.current;
    if (
      existing?.getVideoTracks().some((t) => t.readyState === "live") &&
      existing.getAudioTracks().some((t) => t.readyState === "live")
    ) {
      setStatus("ready");
      setCameraLive(existing.getVideoTracks().some((t) => t.enabled));
      setMicLive(existing.getAudioTracks().some((t) => t.enabled));
      return true;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      setBlocked("both");
      setMessage(
        "This browser cannot access a camera or microphone. Use a recent Chrome, Edge, or Safari over https or localhost."
      );
      return false;
    }

    setStatus("requesting");
    setMessage(null);
    setBlocked(null);

    try {
      const granted = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: {
          // The candidate is on a laptop microphone in a room with speakers.
          // Without these the model hears its own voice and interrupts itself.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Permission prompts can outlive the component. A late grant must be
      // stopped immediately or the webcam light remains on after navigation.
      if (!mountedRef.current || generation !== requestGenerationRef.current) {
        granted.getTracks().forEach((track) => track.stop());
        return false;
      }

      if (granted.getVideoTracks().length === 0 || granted.getAudioTracks().length === 0) {
        granted.getTracks().forEach((track) => track.stop());
        setStatus("unavailable");
        setBlocked(granted.getVideoTracks().length === 0 ? "camera" : "microphone");
        setMessage(
          granted.getVideoTracks().length === 0
            ? "No camera track was available. Check that your camera is connected, then try again."
            : "No microphone track was available. Check that your microphone is connected, then try again."
        );
        return false;
      }

      streamRef.current = granted;
      const videoTracks = granted.getVideoTracks();
      const audioTracks = granted.getAudioTracks();
      videoTracks.forEach((track) => {
        track.enabled = cameraEnabled;
        track.onended = () => {
          if (!mountedRef.current) return;
          setCameraLive(false);
          setMessage("Your camera disconnected. Reconnect it to restore your preview.");
        };
        track.onmute = () => {
          if (!mountedRef.current) return;
          setCameraLive(false);
          setMessage("Your camera paused. Check its connection or try restoring it.");
        };
        track.onunmute = () => {
          if (!mountedRef.current) return;
          setCameraLive(track.enabled);
          setMessage((current) =>
            current?.startsWith("Your camera paused") ? null : current
          );
        };
      });
      audioTracks.forEach((track) => {
        track.enabled = micEnabled;
        track.onended = () => {
          if (!mountedRef.current) return;
          setMicLive(false);
          setMessage("Your microphone disconnected. Your interviewer cannot hear you.");
        };
        track.onmute = () => {
          if (!mountedRef.current) return;
          setMicLive(false);
          setMessage("Your microphone paused. Check its connection so the interviewer can hear you.");
        };
        track.onunmute = () => {
          if (!mountedRef.current) return;
          setMicLive(track.enabled);
          setMessage((current) =>
            current?.startsWith("Your microphone paused") ? null : current
          );
        };
      });
      setStream(granted);
      setCameraLive(videoTracks.some((t) => t.readyState === "live" && t.enabled));
      setMicLive(audioTracks.some((t) => t.readyState === "live" && t.enabled));
      setStatus("ready");
      setBlocked(null);
      console.debug("[MEDIA] camera and microphone ready");
      return true;
    } catch (error: unknown) {
      if (!mountedRef.current || generation !== requestGenerationRef.current) {
        return false;
      }
      const name = (error as { name?: string })?.name;
      console.error("[MEDIA] getUserMedia failed:", name);

      if (name === "NotAllowedError" || name === "SecurityError") {
        const diagnosis = await diagnoseDevices();
        setStatus("denied");
        setBlocked(diagnosis.blocked);
        setMessage(buildDeniedMessage(diagnosis.blocked));
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        const diagnosis = await diagnoseDevices();
        setStatus("unavailable");
        setBlocked(diagnosis.blocked);
        setMessage(buildUnavailableMessage(diagnosis));
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setStatus("error");
        setBlocked("both");
        setMessage(
          "Your camera or microphone is in use by another application. Close the other app, then try again."
        );
      } else {
        setStatus("error");
        setBlocked("both");
        setMessage(
          "Could not start the camera and microphone. Check the browser's site permissions and try again."
        );
      }
      return false;
    }
  }, [cameraEnabled, micEnabled]);

  const request = useCallback((): Promise<boolean> => {
    // Share one permission prompt between every caller. The session hook already
    // guards its Start button, but keeping this invariant here prevents another
    // consumer (or a replayed event) from opening two device requests at once.
    const active = requestPromiseRef.current;
    if (active) return active;

    const pending = performRequest();
    requestPromiseRef.current = pending;
    const clear = () => {
      if (requestPromiseRef.current === pending) requestPromiseRef.current = null;
    };
    void pending.then(clear, clear);
    return pending;
  }, [performRequest]);

  const retryCamera = useCallback(async (): Promise<boolean> => {
    const existing = streamRef.current;
    const liveAudio = existing
      ?.getAudioTracks()
      .find((track) => track.readyState === "live");

    // Before an interview starts, use the normal combined permission flow.
    if (!liveAudio) return request();
    if (!navigator.mediaDevices?.getUserMedia) return false;

    const generation = ++requestGenerationRef.current;
    setMessage(null);
    setBlocked(null);

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const cameraTrack = cameraStream.getVideoTracks()[0];
      if (!mountedRef.current || generation !== requestGenerationRef.current) {
        cameraStream.getTracks().forEach((track) => track.stop());
        return false;
      }
      if (!cameraTrack) {
        setBlocked("camera");
        setMessage("No camera track was available. Reconnect your camera and try again.");
        return false;
      }

      existing?.getVideoTracks().forEach((track) => {
        track.onended = null;
        track.onmute = null;
        track.onunmute = null;
        track.stop();
      });

      cameraTrack.enabled = cameraEnabled;
      cameraTrack.onended = () => {
        if (!mountedRef.current) return;
        setCameraLive(false);
        setMessage("Your camera disconnected. Reconnect it, then choose Restore camera.");
      };
      cameraTrack.onmute = () => mountedRef.current && setCameraLive(false);
      cameraTrack.onunmute = () =>
        mountedRef.current && setCameraLive(cameraTrack.enabled);

      const replacement = new MediaStream([
        cameraTrack,
        ...existing!.getAudioTracks(),
      ]);
      streamRef.current = replacement;
      setStream(replacement);
      setCameraLive(cameraTrack.enabled && cameraTrack.readyState === "live");
      setStatus("ready");
      setBlocked(null);
      setMessage(null);
      return true;
    } catch (error: unknown) {
      if (!mountedRef.current || generation !== requestGenerationRef.current) return false;
      const name = (error as { name?: string })?.name;
      setBlocked("camera");
      setMessage(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera access is blocked. Allow it in this site's browser permissions, then try again."
          : name === "NotReadableError" || name === "TrackStartError"
            ? "The camera is busy in another application. Close that application, then try again."
            : "The camera could not be restored. Check its connection and browser permission, then try again."
      );
      return false;
    }
  }, [cameraEnabled, request]);

  const toggleCamera = useCallback(() => {
    setCameraEnabled((on) => {
      const next = !on;
      // Disabled rather than stopped: stopping ends the track for good, and
      // turning the camera back on would need a fresh permission round-trip.
      streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
      setCameraLive(
        next &&
          !!streamRef.current?.getVideoTracks().some((t) => t.readyState === "live")
      );
      return next;
    });
  }, []);

  const toggleMic = useCallback(() => {
    setMicEnabled((on) => {
      const next = !on;
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
      setMicLive(
        next &&
          !!streamRef.current?.getAudioTracks().some((t) => t.readyState === "live")
      );
      return next;
    });
  }, []);

  // srcObject is a DOM property, not an attribute, so it cannot be set in JSX.
  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (element.srcObject !== stream) element.srcObject = stream;
    if (stream) {
      // Autoplay can still be refused; a muted local preview is allowed
      // everywhere, which is one of the reasons the element must stay muted.
      element
        .play()
        .catch((e) => console.debug("[MEDIA] preview play deferred:", e?.name));
    }
  }, [stream]);

  // Never leave the webcam light on because the component went away.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, [stop]);

  return {
    videoRef,
    status,
    message,
    blocked,
    cameraEnabled,
    micEnabled,
    cameraLive,
    micLive,
    stream,
    request,
    retryCamera,
    toggleCamera,
    toggleMic,
    stop,
  };
}
