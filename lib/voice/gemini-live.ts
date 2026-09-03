"use client";

/**
 * The Gemini Live implementation of VoiceInterviewProvider.
 *
 * This is the only file in the application that knows Gemini Live exists.
 * Everything vendor-shaped -- the message envelope, the transcription
 * fragmenting, the audio encoding, the reconnect semantics -- is contained here
 * so the interview UI above it stays provider-agnostic.
 *
 * Authentication is by ephemeral token only. The permanent API key never
 * reaches the browser: the token is minted server-side by /api/live-token after
 * the request has been authenticated and plan-checked, is single-use, and
 * expires in minutes.
 */

import {
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
  type LiveServerMessage,
  type Session,
} from "@google/genai";

import { decodeSpeechFrame, INPUT_SAMPLE_RATE } from "@/lib/voice/audio";
import {
  TurnLatencyRecorder,
  publishLatency,
  type TurnLatency,
} from "@/lib/voice/latency";
import { normalizeVoiceError, type VoiceErrorReport } from "@/lib/voice/errors";
import {
  createEmitter,
  type TranscriptEntry,
  type Unsubscribe,
  type VoiceConnectionState,
  type VoiceInterviewProvider,
  type VoiceSessionConfig,
} from "@/lib/voice/provider";

export interface GeminiLiveOptions extends VoiceSessionConfig {
  /** Ephemeral token from /api/live-token. Used in place of an API key. */
  token: string;
  /** Bounded on purpose: an unbounded retry loop hammers a service that is down. */
  maxReconnects?: number;
  /** Development-only turn timings. See lib/voice/latency.ts. */
  onLatency?: (latency: TurnLatency) => void;
}

/**
 * How long the candidate has to be silent before the service treats their answer
 * as finished.
 *
 * This is the single biggest contributor to the pause a candidate feels between
 * answering and being asked the next question, and it was previously left at the
 * service default. Two opposing costs decide it: too long and every answer is
 * followed by dead air; too short and the interviewer talks over someone who was
 * only pausing to think.
 *
 * Chosen by measurement, and a genuine trade rather than a free win. Measured
 * against a recorded 58-second answer, the delay between the candidate's last
 * word and the interviewer's first audio tracks this value almost linearly --
 * the rest is roughly 700-800ms of model and network time this application does
 * not control:
 *
 *     900ms  -> ~1.1-1.5s, but the interviewer talked over a 1.2s thinking
 *               pause, splitting one answer into two
 *    1100ms  -> ~1.4s, and still split that pause
 *   default  -> ~1.9s
 *    1400ms  -> ~2.4s, and never interrupted
 *
 * The uncomfortable finding is that latency and interruption are the same dial:
 * no value is both faster than the default and tolerant of an ordinary pause.
 * Given that, this sits just above a 1.2s hesitation. Being cut off mid-thought
 * is the worse failure -- a candidate who is interrupted loses the answer, one
 * who waits a moment simply waits a moment -- so the speed was bought back from
 * the model instead. See lib/voice/models.ts.
 *
 * Both specs guard it from either side -- latency.spec.ts fails if the wait
 * regresses, latency-pause.spec.ts fails if a pause starts being mistaken for the
 * end of an answer. Neither should be relaxed to accommodate a change here.
 */
const SPEECH_END_SILENCE_MS = 1200;

/**
 * Audio kept from just before speech was detected.
 *
 * Voice activity detection is inherently late -- it can only recognise speech
 * once some has arrived -- so without a little lead-in the first syllable of an
 * answer is clipped, and a clipped first word is worse than a slightly longer
 * turn.
 */
const SPEECH_PREFIX_PADDING_MS = 300;

const DEFAULT_MAX_RECONNECTS = 2;
const RECONNECT_BACKOFF_MS = [1000, 3000];

export class GeminiLiveVoiceProvider implements VoiceInterviewProvider {
  private readonly options: GeminiLiveOptions;
  private session: Session | null = null;

  private readonly transcript = createEmitter<TranscriptEntry>();
  private readonly assistantTranscript = createEmitter<TranscriptEntry>();
  private readonly audio = createEmitter<Float32Array>();
  private readonly speaking = createEmitter<boolean>();
  private readonly interrupted = createEmitter<void>();
  private readonly errors = createEmitter<VoiceErrorReport>();
  private readonly connectionState = createEmitter<VoiceConnectionState>();

  /**
   * Transcription arrives as fragments, several per second, and a turn is only
   * a sentence once it is finished. Buffering here means the saved transcript is
   * whole utterances rather than a few hundred word-pieces.
   */
  private userBuffer = "";
  private assistantBuffer = "";

  private isSpeaking = false;
  private reconnectAttempts = 0;
  /** Prevents onerror, onclose and goAway from launching parallel retries. */
  private reconnecting = false;
  /** Late callbacks from a replaced socket must not affect the current one. */
  private connectionGeneration = 0;
  /** Set the moment teardown is intended, so a close is never mistaken for a fault. */
  private closing = false;
  private state: VoiceConnectionState = "idle";
  /**
   * Lets a dropped connection resume the same conversation instead of starting a
   * new interview that has forgotten everything said so far.
   */
  private resumptionHandle: string | undefined;
  private readonly latency: TurnLatencyRecorder;

  constructor(options: GeminiLiveOptions) {
    this.options = options;
    this.latency = new TurnLatencyRecorder((entry) => {
      this.options.onLatency?.(entry);
      publishLatency(this.latency.snapshot());
    });
  }

  /** Marks that the interviewer's audio actually reached the speakers. */
  notePlaybackStarted(): void {
    this.latency.record("firstPlayback");
  }

  /**
   * Marks the instant the candidate stopped speaking.
   *
   * Driven from the microphone level in the session hook, because the service
   * provides no usable speech-end signal on this model. See lib/voice/latency.ts.
   */
  noteSpeechEnded(): void {
    this.latency.noteSpeechEnded();
  }

  // -- lifecycle ------------------------------------------------------------

  async connect(): Promise<void> {
    this.closing = false;
    await this.open();
  }

  private setState(next: VoiceConnectionState) {
    if (this.state === next) return;
    this.state = next;
    this.connectionState.emit(next);
  }

  private async open(): Promise<void> {
    const generation = ++this.connectionGeneration;
    this.setState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    // A token is a credential: constructed per session and never logged.
    //
    // `v1alpha` is required, not cosmetic. Ephemeral-token auth is only served
    // on that API version: on the default version the socket still opens and
    // still reports `setupComplete`, and then the model never answers -- no
    // error, no close, just silence. The SDK warns about this at construction
    // time, which is the only visible sign anything is wrong.
    const ai = new GoogleGenAI({
      apiKey: this.options.token,
      httpOptions: { apiVersion: "v1alpha" },
    });

    try {
      const session = await ai.live.connect({
        model: this.options.model,
        callbacks: {
          onopen: () => {
            if (generation !== this.connectionGeneration || this.closing) return;
            this.reconnectAttempts = 0;
            this.setState("connected");
          },
          onmessage: (message) => {
            if (generation === this.connectionGeneration)
              this.handleMessage(message);
          },
          onerror: (event) => {
            if (generation === this.connectionGeneration)
              this.handleTransportFailure(event);
          },
          onclose: (event) => {
            if (generation === this.connectionGeneration) this.handleClose(event);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: this.options.systemInstruction,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: this.options.voiceName },
            },
          },
          // Both directions are transcribed by the service. Doing it here rather
          // than running our own recogniser keeps one source of truth for what
          // was said, and it is what the saved transcript and the feedback are
          // scored from.
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // End-of-speech detection, which had been left at the service default.
          // See SPEECH_END_SILENCE_MS above for why these values and not others.
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: false,
              silenceDurationMs: SPEECH_END_SILENCE_MS,
              prefixPaddingMs: SPEECH_PREFIX_PADDING_MS,
              // Ends a turn readily once the silence threshold is met, rather
              // than holding on for further confirmation. The threshold above is
              // what protects a thinking pause; asking the detector to also
              // hesitate would delay every turn twice over.
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
              // Picks up quiet speakers, which matters more than the occasional
              // false start: a false start costs an interruption the candidate
              // can talk through, a missed start costs a whole answer.
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            },
          },
          sessionResumption: this.resumptionHandle
            ? { handle: this.resumptionHandle }
            : {},
        },
      });

      // disconnect() may run while the SDK is still negotiating. Never publish
      // or retain a socket that belongs to an invalidated connection attempt.
      if (generation !== this.connectionGeneration || this.closing) {
        try {
          session.close();
        } catch {
          // It may already have closed while connect() was resolving.
        }
        return;
      }
      this.session = session;
    } catch (error) {
      this.session = null;
      // connect() rejects to its caller, which owns setup failure reporting.
      // Emitting the same error here as well made one failed start run both the
      // provider error path and the start() catch (duplicate toast + teardown).
      // Reconnect failures stay inside reconnect() until its bounded loop ends.
      // During recovery the public state must stay reconnecting; publishing a
      // transient "closed" makes the session hook finalize after the first
      // failed attempt instead of allowing the bounded loop to continue.
      if (this.reconnectAttempts === 0) this.setState("closed");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Idempotent, and safe before connect() ever ran: teardown is reached from
    // the End button, the expiry timer, an unmount and an error, and more than
    // one of those routinely lands in the same tick.
    this.closing = true;
    this.connectionGeneration += 1;
    this.flushBuffers();

    const session = this.session;
    this.session = null;

    if (session) {
      try {
        session.close();
      } catch (error) {
        // The socket is going away regardless; this is not worth alarming about.
        console.debug("[LIVE] close during teardown:", normalizeVoiceError(error).detail);
      }
    }

    this.setSpeaking(false);
    this.setState("closed");
  }

  // -- outbound -------------------------------------------------------------

  sendAudio(base64Pcm: string): void {
    if (!this.session || this.closing) return;
    try {
      this.session.sendRealtimeInput({
        audio: {
          data: base64Pcm,
          mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
        },
      });
    } catch (error) {
      // One dropped frame is not worth a user-facing error; a broken socket will
      // surface through onclose/onerror within moments anyway.
      console.debug("[LIVE] dropped an audio frame:", normalizeVoiceError(error).kind);
    }
  }

  sendSystemNote(text: string): void {
    if (!this.session || this.closing) return;
    try {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      });
    } catch (error) {
      console.debug("[LIVE] could not deliver system note:", normalizeVoiceError(error).kind);
    }
  }

  interrupt(): void {
    // Interruption is handled by the service's voice-activity detection: sending
    // audio while the model is talking cuts its turn automatically. What this
    // has to do is drop the speech we have already buffered locally, because
    // that audio is now stale and would otherwise keep playing over the
    // candidate for several seconds.
    this.assistantBuffer = "";
    this.setSpeaking(false);
    this.interrupted.emit();
  }

  // -- inbound --------------------------------------------------------------

  private handleMessage(message: LiveServerMessage): void {
    if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
      this.resumptionHandle = message.sessionResumptionUpdate.newHandle;
    }

    // The service warns before it closes a long-lived socket. Reconnecting on
    // this signal is what turns a mid-interview disconnect into a seam the
    // candidate never sees.
    if (message.goAway) {
      console.debug("[LIVE] server asked us to reconnect", message.goAway.timeLeft);
      void this.reconnect();
      return;
    }

    const content = message.serverContent;
    if (!content) return;

    if (content.interrupted) {
      this.interrupt();
      return;
    }

    if (content.inputTranscription?.text) {
      this.userBuffer += content.inputTranscription.text;
    }

    if (content.outputTranscription?.text) {
      this.assistantBuffer += content.outputTranscription.text;
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (!data) continue;
      // The first audio of a reply is the moment the candidate stops waiting,
      // so it is the mark the whole measurement is built around.
      this.latency.record("firstAudio");
      // Any inline audio means the model is mid-utterance.
      this.setSpeaking(true);
      this.audio.emit(decodeSpeechFrame(data));
    }

    // A completed turn is the only point at which either side's words are a
    // finished sentence rather than a fragment.
    if (content.turnComplete || content.generationComplete) {
      this.latency.record("turnComplete");
      this.flushBuffers();
      this.setSpeaking(false);
    }
  }

  private flushBuffers(): void {
    const now = Date.now();

    const user = this.userBuffer.trim();
    if (user) {
      this.latency.record("transcriptFinal");
      this.transcript.emit({ speaker: "user", text: user, timestamp: now });
    }
    this.userBuffer = "";

    const assistant = this.assistantBuffer.trim();
    if (assistant) {
      this.assistantTranscript.emit({
        speaker: "ai",
        text: assistant,
        timestamp: now,
      });
    }
    this.assistantBuffer = "";
  }

  private setSpeaking(next: boolean): void {
    if (this.isSpeaking === next) return;
    this.isSpeaking = next;
    this.speaking.emit(next);
  }

  private handleTransportFailure(event: unknown): void {
    if (this.closing) return;
    const report = normalizeVoiceError(event);
    if (report.retryable) {
      void this.reconnect();
      return;
    }
    this.errors.emit(report);
  }

  private handleClose(event: unknown): void {
    this.setSpeaking(false);

    // Teardown we asked for. Reporting this would turn every completed
    // interview into an error, which is precisely the bug the previous
    // architecture shipped.
    if (this.closing) {
      this.flushBuffers();
      this.setState("closed");
      return;
    }

    const report = normalizeVoiceError(event);

    if (report.kind === "closed") {
      // The service hung up cleanly on a session we still wanted. Keep whatever
      // was said and let the UI finalize; this is not a failure.
      this.flushBuffers();
      this.setState("closed");
      return;
    }

    if (report.retryable) {
      void this.reconnect();
      return;
    }

    this.flushBuffers();
    this.setState("closed");
    this.errors.emit(report);
  }

  /**
   * Bounded reconnect.
   *
   * Two attempts with a short backoff, resuming the same conversation where the
   * service gives us a handle. If they fail, the session is reported as lost
   * rather than retried forever -- the interview still has its transcript, and
   * finalising with what was said beats hammering a service that is down.
   */
  private async reconnect(): Promise<void> {
    if (this.closing || this.reconnecting) return;
    this.reconnecting = true;

    try {
      const max = this.options.maxReconnects ?? DEFAULT_MAX_RECONNECTS;

      while (!this.closing && this.reconnectAttempts < max) {
        const attempt = this.reconnectAttempts++;
        this.setState("reconnecting");

        // Invalidate the old socket before close(), whose callback can be
        // delivered synchronously by some transports.
        this.connectionGeneration += 1;
        const previous = this.session;
        this.session = null;
        try {
          previous?.close();
        } catch {
          // Already gone; that is the situation we are recovering from.
        }

        const delay =
          RECONNECT_BACKOFF_MS[
            Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1)
          ];
        await new Promise((resolve) => setTimeout(resolve, delay));
        if (this.closing) return;

        try {
          await this.open();
          return;
        } catch {
          // Keep trying inside this one bounded loop.
        }
      }

      if (!this.closing) {
        this.setState("closed");
        this.errors.emit({
          kind: "network",
          message:
            "The connection to your interviewer was lost and could not be restored. Your interview so far has been saved.",
          detail: { attempts: this.reconnectAttempts },
          fatal: true,
          retryable: false,
        });
      }
    } finally {
      this.reconnecting = false;
    }
  }

  // -- subscriptions --------------------------------------------------------

  onTranscript(callback: (entry: TranscriptEntry) => void): Unsubscribe {
    return this.transcript.on(callback);
  }

  onAssistantTranscript(callback: (entry: TranscriptEntry) => void): Unsubscribe {
    return this.assistantTranscript.on(callback);
  }

  onAudio(callback: (samples: Float32Array) => void): Unsubscribe {
    return this.audio.on(callback);
  }

  onSpeakingChange(callback: (speaking: boolean) => void): Unsubscribe {
    return this.speaking.on(callback);
  }

  onInterrupted(callback: () => void): Unsubscribe {
    return this.interrupted.on(callback);
  }

  onError(callback: (report: VoiceErrorReport) => void): Unsubscribe {
    return this.errors.on(callback);
  }

  onConnectionStateChange(
    callback: (state: VoiceConnectionState) => void
  ): Unsubscribe {
    return this.connectionState.on(callback);
  }
}
