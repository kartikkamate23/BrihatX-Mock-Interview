"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAttentionMonitor } from "@/hooks/useAttentionMonitor";
import { useInterviewMedia } from "@/hooks/useInterviewMedia";
import { useInterviewTimer } from "@/hooks/useInterviewTimer";
import {
  finalizeInterviewSession,
  startInterviewSession,
} from "@/lib/actions/session.action";
import { MicrophoneCapture, SpeechPlayer } from "@/lib/voice/audio-io";
import { normalizeVoiceError, type VoiceErrorReport } from "@/lib/voice/errors";
import { GeminiLiveVoiceProvider } from "@/lib/voice/gemini-live";
import { resolveInterviewType } from "@/lib/interview-types";
import { buildOpeningTurn, buildWrapUpNote } from "@/lib/voice/prompt";
import type { TranscriptEntry, VoiceInterviewProvider } from "@/lib/voice/provider";
import {
  canEndManually,
  transition,
  type EndReason,
  type SessionState,
} from "@/lib/voice/session-state";

export interface UseInterviewSessionOptions {
  interviewId: string;
  userName: string;
  /** The role, or the visa category label -- whatever the opening turn names. */
  role: string;
  /** Only honoured outside production, and only ever to shorten a session. */
  devDurationSeconds?: number;
  /** The length the UI selected. The server's grant overrides it. */
  requestedDurationSeconds: number;
  onCompleted: (feedbackId: string | undefined) => void;
  onFailed: (message: string) => void;
}

export interface InterviewSessionApi {
  state: SessionState;
  transcript: TranscriptEntry[];
  /** The most recent line, for the single-line transcript strip. */
  lastLine: TranscriptEntry | null;
  speaking: boolean;
  /** Rough microphone level 0..1, for the input indicator. */
  micLevel: number;
  media: ReturnType<typeof useInterviewMedia>;
  timer: ReturnType<typeof useInterviewTimer>;
  attention: ReturnType<typeof useAttentionMonitor>;
  error: string | null;
  canEnd: boolean;
  start: () => Promise<void>;
  end: (reason: EndReason) => Promise<void>;
}

/**
 * Runs one interview, start to finish.
 *
 * All of the ordering that has to be right lives here rather than in the view:
 * permissions before the plan gate, the plan gate before a token is minted, the
 * clock starting only once audio is actually flowing, and exactly one
 * finalisation no matter which of the four ways an interview can end fires
 * first.
 */
export function useInterviewSession(
  options: UseInterviewSessionOptions
): InterviewSessionApi {
  const [state, setState] = useState<SessionState>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [speaking, setSpeaking] = useState(false);
  /**
   * The mic level is quantised into buckets before it reaches React.
   *
   * The audio layer already throttles this to about twelve reports a second;
   * bucketing on top means a steady voice produces a render only when the
   * indicator would visibly change, which in practice is a few times a second
   * rather than twelve. High-frequency audio values live in a ref, and only the
   * value the UI actually shows becomes state.
   */
  const [micLevel, setMicLevel] = useState(0);
  const micLevelRef = useRef(0);
  /**
   * Client-side speech-end detection, used only to time the turn.
   *
   * This does NOT drive the interview -- the service's own voice-activity
   * detector decides when an answer has finished. It exists so the measurement
   * has an accurate mark for "the candidate stopped talking", which is the
   * instant their wait begins.
   */
  const speakingRef = useRef(false);
  const quietSinceRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const media = useInterviewMedia();
  const attention = useAttentionMonitor();

  // `media`, `timer` and `attention` are new objects on every render (the clock
  // ticks twice a second). Anything long-lived reaches them through a ref:
  // putting them in a dependency array re-runs that effect constantly, and an
  // effect whose cleanup tears down the call would end the interview on its
  // first tick.
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const attentionRef = useRef(attention);
  attentionRef.current = attention;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stateRef = useRef<SessionState>("idle");
  const providerRef = useRef<VoiceInterviewProvider | null>(null);
  const captureRef = useRef<MicrophoneCapture | null>(null);
  const playerRef = useRef<SpeechPlayer | null>(null);
  const tokenRequestRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const mountedRef = useRef(true);
  /** Invalidates async start work when teardown wins the race. */
  const lifecycleGenerationRef = useRef(0);

  /** Single-flight for start(); a disabled button cannot stop a double click. */
  const startingRef = useRef(false);
  /**
   * The single finalisation guard.
   *
   * An interview can end from five directions -- the countdown expiring, the End
   * button, the provider closing the socket, a fatal error, and the component
   * unmounting -- and more than one of those routinely fires within the same
   * tick. This latches on the first caller so that the transcript is saved once,
   * the session document is written once, and feedback is generated once. Every
   * later caller returns immediately.
   *
   * It is deliberately a ref rather than state: a state update would not be
   * visible to a second caller in the same tick, which is exactly the race being
   * guarded against.
   */
  const endingRef = useRef(false);
  const unsubscribesRef = useRef<Array<() => void>>([]);
  const endRef = useRef<((reason: EndReason) => Promise<void>) | null>(null);

  const dispatch = useCallback((event: Parameters<typeof transition>[1]) => {
    const next = transition(stateRef.current, event);
    if (next === stateRef.current) return stateRef.current;
    stateRef.current = next;
    if (mountedRef.current) setState(next);
    return next;
  }, []);

  const appendLine = useCallback((entry: TranscriptEntry) => {
    // Kept in a ref as well as state: the close of a session frequently lands in
    // the same tick as its final transcript line, and reading component state
    // there would drop that line from the saved record and the scoring.
    transcriptRef.current = [...transcriptRef.current, entry];
    if (mountedRef.current) setTranscript(transcriptRef.current);
  }, []);

  // ---- time -------------------------------------------------------------

  const handleWarning = useCallback(() => {
    const remaining = timerRef.current?.remainingMs ?? 30_000;
    providerRef.current?.sendSystemNote(buildWrapUpNote(remaining / 1000));
  }, []);

  const handleExpire = useCallback(() => {
    console.debug("[INTERVIEW] duration reached; ending");
    dispatch({ type: "DURATION_EXPIRED" });
    void endRef.current?.("duration_expired");
  }, [dispatch]);

  const timer = useInterviewTimer(options.requestedDurationSeconds, {
    onExpire: handleExpire,
    onWarning: handleWarning,
  });
  const timerRef = useRef(timer);
  timerRef.current = timer;

  // ---- teardown ---------------------------------------------------------

  /** Releases every device and connection. Safe to call more than once. */
  const releaseResources = useCallback(async () => {
    lifecycleGenerationRef.current += 1;

    // Detach every owned resource before awaiting any one of them. A failed
    // call can be retried while an AudioContext is still closing; reading refs
    // after that await used to let the old teardown grab and disconnect the
    // replacement provider created by the new attempt.
    const tokenRequest = tokenRequestRef.current;
    tokenRequestRef.current = null;
    tokenRequest?.abort();

    for (const unsubscribe of unsubscribesRef.current) {
      try {
        unsubscribe();
      } catch {
        // Nothing useful to do while tearing down.
      }
    }
    unsubscribesRef.current = [];

    timerRef.current.stop();

    const capture = captureRef.current;
    captureRef.current = null;
    const provider = providerRef.current;
    providerRef.current = null;
    const player = playerRef.current;
    playerRef.current = null;

    // The interview is over: the webcam light goes out now, not whenever the
    // route happens to unmount.
    mediaRef.current.stop();

    // These own independent AudioContexts/transport resources, so closing them
    // concurrently makes teardown faster and prevents one slow close from
    // keeping the other resources live.
    await Promise.allSettled([
      capture?.stop(),
      provider?.disconnect(),
      player?.close(),
    ]);
  }, []);

  const end = useCallback(
    async (reason: EndReason) => {
      if (endingRef.current) {
        console.debug("[INTERVIEW] end already in progress, ignoring");
        return;
      }
      endingRef.current = true;

      dispatch({ type: "END_REQUESTED" });
      console.debug(
        `[INTERVIEW] ending (${reason}) with ${transcriptRef.current.length} lines`
      );

      const attentionEvents = attentionRef.current.stop();
      await releaseResources();

      const sessionId = sessionIdRef.current;
      const { interviewId, onCompleted, onFailed } = optionsRef.current;

      if (!sessionId) {
        // Never got as far as a server session: nothing was recorded and there
        // is nothing to score.
        dispatch({ type: "FAILED" });
        return;
      }

      let result: Awaited<ReturnType<typeof finalizeInterviewSession>>;
      try {
        result = await finalizeInterviewSession({
          sessionId,
          interviewId,
          transcript: transcriptRef.current.map((line) => ({
            speaker: line.speaker,
            text: line.text,
            timestamp: line.timestamp,
          })),
          monitoringEvents: attentionEvents,
          endReason: reason,
        });
      } catch (caught) {
        const report = normalizeVoiceError(caught);
        const message =
          report.kind === "network"
            ? "Your interview ended, but it could not be saved. Check your connection and try again."
            : "Your interview ended, but feedback could not be prepared.";
        dispatch({ type: "FAILED" });
        if (mountedRef.current) setError(message);
        if (mountedRef.current) onFailed(message);
        return;
      }

      if (result.success) {
        dispatch({ type: "FINALIZED" });
        if (mountedRef.current) onCompleted(result.feedbackId);
        return;
      }

      dispatch({ type: "FAILED" });
      if (mountedRef.current) setError(result.message ?? null);
      if (mountedRef.current) {
        onFailed(
          result.message ??
            "Your interview was saved but could not be scored. You can try again from the dashboard."
        );
      }
    },
    [dispatch, releaseResources]
  );

  endRef.current = end;

  // ---- provider errors --------------------------------------------------

  const handleProviderError = useCallback(
    (report: VoiceErrorReport) => {
      // A normal close is the session ending, not a fault. Reporting it is what
      // made a completed interview look like a failed one in the old
      // architecture, so it stops here.
      if (!report.fatal) {
        console.warn("[INTERVIEW] non-fatal voice issue:", report.message, report.detail);
        return;
      }

      console.error("[INTERVIEW] voice error:", report.kind, report.message, report.detail);

      // A failure after the candidate has spoken still leaves a usable
      // interview: score what was said rather than discarding it.
      if (transcriptRef.current.length > 0) {
        if (mountedRef.current) setError(report.message);
        void endRef.current?.(report.kind === "network" ? "connection_lost" : "error");
        return;
      }

      dispatch({ type: "FAILED" });
      if (mountedRef.current) setError(report.message);
      optionsRef.current.onFailed(report.message);
      // Fatal setup/transport failures before the first transcript still own a
      // camera, AudioContext and possibly a socket. Failed UI state must never
      // leave those resources live.
      void releaseResources();
    },
    [dispatch, releaseResources]
  );

  // ---- start ------------------------------------------------------------

  const start = useCallback(async () => {
    if (startingRef.current) return;
    if (stateRef.current !== "idle" && stateRef.current !== "failed") return;

    startingRef.current = true;
    const generation = ++lifecycleGenerationRef.current;
    const startIsCurrent = () =>
      mountedRef.current && generation === lifecycleGenerationRef.current;
    setError(null);

    try {
      // Restarting after a failed attempt: clear the previous run so its
      // transcript cannot leak into the next interview's feedback.
      endingRef.current = false;
      sessionIdRef.current = null;
      transcriptRef.current = [];
      setTranscript([]);
      setSpeaking(false);

      dispatch({ type: "START" });

      const granted = await mediaRef.current.request();
      if (!startIsCurrent()) {
        await releaseResources();
        return;
      }
      if (!granted) {
        dispatch({ type: "PERMISSIONS_DENIED" });
        const message =
          mediaRef.current.message ??
          "Camera and microphone access is required for an interview.";
        setError(message);
        optionsRef.current.onFailed(message);
        return;
      }

      dispatch({ type: "PERMISSIONS_GRANTED" });

      // The plan gate lives on the server: it returns the duration this account
      // may actually have and records the session against the monthly quota, so
      // neither can be changed from the browser.
      const authorization = await startInterviewSession({
        interviewId: optionsRef.current.interviewId,
        requestedDurationSeconds: optionsRef.current.requestedDurationSeconds,
        devDurationSeconds: optionsRef.current.devDurationSeconds,
      });

      if (!startIsCurrent()) {
        await releaseResources();
        return;
      }

      if (!authorization.allowed || !authorization.sessionId) {
        await releaseResources();
        dispatch({ type: "FAILED" });
        const message =
          authorization.reason ?? "Your plan does not allow another interview right now.";
        setError(message);
        optionsRef.current.onFailed(message);
        return;
      }

      sessionIdRef.current = authorization.sessionId;
      const grantedSeconds =
        authorization.durationSeconds ?? optionsRef.current.requestedDurationSeconds;

      // The permanent key stays on the server; what comes back is a single-use
      // token bound to this session's model and configuration.
      const tokenRequest = new AbortController();
      tokenRequestRef.current?.abort();
      tokenRequestRef.current = tokenRequest;
      const response = await fetch("/api/live-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: authorization.sessionId }),
        signal: tokenRequest.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (tokenRequestRef.current === tokenRequest) tokenRequestRef.current = null;

      if (!startIsCurrent()) {
        await releaseResources();
        return;
      }

      if (!response.ok || !payload?.success) {
        await releaseResources();
        dispatch({ type: "FAILED" });
        const message =
          payload?.error ?? "Voice interview configuration is unavailable.";
        setError(message);
        optionsRef.current.onFailed(message);
        return;
      }

      const player = new SpeechPlayer();
      playerRef.current = player;
      // Resumed inside the click that started the interview, which is what the
      // browser's autoplay policy requires; doing it later leaves the
      // interviewer inaudible with no error anywhere.
      await player.resume();
      if (!startIsCurrent()) {
        await releaseResources();
        return;
      }

      const provider = new GeminiLiveVoiceProvider({
        token: payload.token,
        model: payload.model,
        voiceName: payload.voiceName,
        systemInstruction: payload.systemInstruction,
      });
      providerRef.current = provider;

      unsubscribesRef.current.push(
        provider.onAssistantTranscript(appendLine),
        provider.onTranscript(appendLine),
        provider.onAudio((samples) => {
          player.play(samples);
          // Closes the measurement: audio scheduled is audio the candidate is
          // about to hear.
          provider.notePlaybackStarted?.();
        }),
        provider.onSpeakingChange((value) => {
          if (mountedRef.current) setSpeaking(value);
        }),
        provider.onInterrupted(() => player.flush()),
        provider.onError(handleProviderError),
        provider.onConnectionStateChange((connectionState) => {
          if (connectionState === "reconnecting") {
            dispatch({ type: "CONNECTION_LOST" });
          } else if (connectionState === "connected") {
            if (stateRef.current === "reconnecting") {
              dispatch({ type: "RECONNECTED" });
            }
          } else if (
            connectionState === "closed" &&
            (stateRef.current === "connected" ||
              stateRef.current === "interviewing" ||
              stateRef.current === "reconnecting")
          ) {
            // A remote clean close is still an end to a session we intended to
            // keep running. Save what was said instead of leaving the UI in a
            // permanently-listening state until the clock expires.
            void endRef.current?.("connection_lost");
          }
        })
      );

      await provider.connect();

      if (!startIsCurrent()) {
        await releaseResources();
        return;
      }

      dispatch({ type: "CONNECTED" });

      // The clock starts when the session is actually open, not when the button
      // was clicked: permission prompts and connection setup are not interview
      // time, and charging the candidate for them would be wrong.
      timerRef.current.start(grantedSeconds);

      const capture = new MicrophoneCapture({
        onFrame: (frame) => providerRef.current?.sendAudio(frame),
        onLevel: (level) => {
          micLevelRef.current = level;

          // Above this the candidate is audibly talking; below it, and held
          // there, they have stopped. The hold is what stops an inter-word gap
          // registering as the end of an answer.
          const SPEAKING_LEVEL = 0.06;
          const QUIET_HOLD_MS = 250;
          const now = Date.now();

          if (level >= SPEAKING_LEVEL) {
            speakingRef.current = true;
            quietSinceRef.current = null;
          } else if (speakingRef.current) {
            if (quietSinceRef.current === null) {
              quietSinceRef.current = now;
            } else if (now - quietSinceRef.current >= QUIET_HOLD_MS) {
              speakingRef.current = false;
              quietSinceRef.current = null;
              providerRef.current?.noteSpeechEnded?.();
            }
          }

          if (!mountedRef.current) return;
          // Twenty buckets: finer than the indicator can show, coarse enough
          // that ordinary speech does not re-render on every report.
          const bucket = Math.round(level * 20) / 20;
          setMicLevel((current) => (current === bucket ? current : bucket));
        },
      });
      captureRef.current = capture;
      const stream = mediaRef.current.stream;
      if (stream) await capture.start(stream);

      if (!startIsCurrent()) {
        await releaseResources();
        return;
      }

      // Advisory only, and deliberately not awaited: a slow or failed model load
      // must never delay or block the interview itself.
      const video = mediaRef.current.videoRef.current;
      if (video) void attentionRef.current.start(video);

      // The model waits to be spoken to. Without an explicit opening turn the
      // candidate sits in silence looking at a connection that appears dead.
      // The type comes back from the token endpoint rather than from the client,
      // so the opening matches the instruction the server actually locked in.
      provider.sendSystemNote(
        buildOpeningTurn(
          optionsRef.current.userName,
          optionsRef.current.role,
          resolveInterviewType(payload.interviewType)
        )
      );
      dispatch({ type: "FIRST_TURN" });
    } catch (caught) {
      if (!startIsCurrent()) {
        await releaseResources();
        return;
      }
      const report = normalizeVoiceError(caught);
      console.error("[INTERVIEW] could not start:", report.kind, report.detail);
      await releaseResources();
      dispatch({ type: "FAILED" });
      setError(report.message);
      optionsRef.current.onFailed(report.message);
    } finally {
      startingRef.current = false;
    }
  }, [appendLine, dispatch, handleProviderError, releaseResources]);

  // ---- unmount ----------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Navigating away mid-interview must not leave the camera, the
      // microphone, or a billable model session running on a page that is no
      // longer showing an interview.
      void releaseResources();
    };
  }, [releaseResources]);

  const lastLine = transcript.length > 0 ? transcript[transcript.length - 1] : null;

  return {
    state,
    transcript,
    lastLine,
    speaking,
    micLevel,
    media,
    timer,
    attention,
    error,
    canEnd: canEndManually(state),
    start,
    end,
  };
}
