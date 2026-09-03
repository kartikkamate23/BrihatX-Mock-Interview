/**
 * The contract between the interview UI and whatever is actually carrying the
 * voice.
 *
 * The point of this file is that nothing above it knows which provider is in
 * use. The previous architecture spread one vendor's event names, error shapes
 * and quirks through a 900-line React component, so replacing the vendor meant
 * rewriting the interview. Everything vendor-specific now lives behind this
 * interface, and the UI talks only to these methods and callbacks.
 */

import type { VoiceErrorReport } from "@/lib/voice/errors";

export type VoiceConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export type TranscriptSpeaker = "ai" | "user";

export interface TranscriptEntry {
  speaker: TranscriptSpeaker;
  text: string;
  /** Epoch milliseconds, so a saved transcript can be replayed in order. */
  timestamp: number;
}

export type Unsubscribe = () => void;

export interface VoiceSessionConfig {
  /** The complete standing instruction for the interviewer. */
  systemInstruction: string;
  /** A Live API prebuilt voice name. */
  voiceName: string;
  /** Model id, injected rather than hard-coded so it stays configurable. */
  model: string;
}

/**
 * A realtime, bidirectional voice session.
 *
 * Implementations must be safe to `disconnect()` more than once and safe to
 * `disconnect()` without ever having connected, because teardown is reached from
 * several directions at once (the End button, the expiry timer, an unmount, and
 * a transport error can all land within the same tick).
 */
export interface VoiceInterviewProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /** One frame of microphone audio, already base64 16 kHz PCM. */
  sendAudio(base64Pcm: string): void;

  /** Injects a system turn, e.g. the time-is-nearly-up nudge. */
  sendSystemNote(text: string): void;

  /** Stops the model talking, e.g. because the candidate started speaking. */
  interrupt(): void;

  /**
   * Optional development-only hook: the reply's audio reached the speakers.
   * Implementations without latency instrumentation simply omit it.
   */
  notePlaybackStarted?(): void;

  /** Optional development-only hook: the candidate stopped speaking. */
  noteSpeechEnded?(): void;

  /** Final transcript lines from the candidate. */
  onTranscript(callback: (entry: TranscriptEntry) => void): Unsubscribe;

  /** Final transcript lines from the interviewer. */
  onAssistantTranscript(callback: (entry: TranscriptEntry) => void): Unsubscribe;

  /** One frame of generated speech, as Float32 samples at the model's rate. */
  onAudio(callback: (samples: Float32Array) => void): Unsubscribe;

  /** True while the model is producing speech. */
  onSpeakingChange(callback: (speaking: boolean) => void): Unsubscribe;

  /**
   * The model's turn was cut off, normally because the candidate started
   * speaking over it. Anything already buffered for playback is now stale and
   * must be dropped, or the interviewer keeps talking for seconds after it was
   * interrupted.
   */
  onInterrupted(callback: () => void): Unsubscribe;

  onError(callback: (report: VoiceErrorReport) => void): Unsubscribe;

  onConnectionStateChange(
    callback: (state: VoiceConnectionState) => void
  ): Unsubscribe;
}

/**
 * A tiny typed event bus, so each implementation does not hand-roll listener
 * bookkeeping. Listeners are copied before dispatch: a callback that
 * unsubscribes itself mid-emit would otherwise mutate the array being iterated
 * and silently skip the next listener.
 */
export function createEmitter<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    on(callback: (value: T) => void): Unsubscribe {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    emit(value: T) {
      for (const listener of [...listeners]) {
        try {
          listener(value);
        } catch (error) {
          // A subscriber that throws must not take down the transport, or one
          // bad render would kill a live interview.
          console.debug("[VOICE] listener threw", error);
        }
      }
    },
    clear() {
      listeners.clear();
    },
    get size() {
      return listeners.size;
    },
  };
}
