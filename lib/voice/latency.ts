/**
 * Turn-latency instrumentation for the live interview.
 *
 * The question this answers is the only one that matters to a candidate: how
 * long after they stop speaking does the interviewer start speaking back. It is
 * measured rather than reasoned about, because the pipeline crosses a
 * voice-activity detector, a model and an audio scheduler that this application
 * does not own, and guessing which of them is slow has a poor track record.
 *
 * Development only. `record()` is a no-op in production so nothing is measured,
 * logged, or retained on a real candidate's session.
 */

export interface TurnMarks {
  /**
   * The last moment the candidate was heard saying anything.
   *
   * Taken from the trailing edge of input transcription rather than from a
   * voice-activity event: the service does not emit `voiceActivity` messages on
   * this model, and in any case this is the more honest mark. It is the
   * candidate's last word, so the interval it opens is exactly what a candidate
   * experiences as waiting -- the detector's silence window included.
   */
  speechEnd?: number;
  /** The candidate's words came back as a final transcription. */
  transcriptFinal?: number;
  /** The first byte of the interviewer's spoken reply arrived. */
  firstAudio?: number;
  /** That audio was actually scheduled to play. */
  firstPlayback?: number;
  /** The interviewer finished its turn. */
  turnComplete?: number;
}

export interface TurnLatency {
  turn: number;
  /** Speech end to the first audio of the reply. The number that matters. */
  speechEndToFirstAudio: number | null;
  speechEndToTranscript: number | null;
  transcriptToFirstAudio: number | null;
  firstAudioToPlayback: number | null;
  replyDuration: number | null;
}

const isEnabled = process.env.NODE_ENV !== "production";

/**
 * Accumulates marks for the turn in progress and reports when it completes.
 *
 * A turn is bounded by the candidate's speech ending and the interviewer's reply
 * beginning; anything arriving outside that window is ignored rather than
 * folded into the previous turn's numbers.
 */
export class TurnLatencyRecorder {
  private marks: TurnMarks = {};
  private turn = 0;
  private readonly history: TurnLatency[] = [];

  constructor(private readonly onReport?: (latency: TurnLatency) => void) {}

  /**
   * The candidate's microphone went quiet after they had been speaking.
   *
   * Derived from the outgoing audio level rather than from anything the service
   * sends back. Two earlier attempts were worse: this model does not emit
   * `voiceActivity` messages at all, and the trailing edge of input
   * transcription arrives lagged and sometimes after the reply has already
   * started, which produced a nonsensical 1ms reading.
   *
   * Measuring the microphone is both accurate and the right thing to measure:
   * it is the instant the candidate stopped talking, so the interval it opens is
   * precisely the silence they sit through.
   */
  noteSpeechEnded(): void {
    if (!isEnabled) return;
    this.turn += 1;
    this.marks = { speechEnd: performance.now() };
  }

  record(mark: Exclude<keyof TurnMarks, "speechEnd">): void {
    if (!isEnabled) return;
    // First occurrence wins: "first audio" means the first, and a later frame
    // in the same turn must not overwrite it.
    if (this.marks[mark] !== undefined) return;
    this.marks[mark] = performance.now();

    // Only a turn that began with the candidate speaking is worth reporting.
    // The interviewer's opening question has nothing to be measured against.
    if (mark === "firstAudio" && this.marks.speechEnd !== undefined) this.report();
  }

  private delta(from?: number, to?: number): number | null {
    return from !== undefined && to !== undefined ? Math.round(to - from) : null;
  }

  private report(): void {
    const latency: TurnLatency = {
      turn: this.turn,
      speechEndToFirstAudio: this.delta(this.marks.speechEnd, this.marks.firstAudio),
      speechEndToTranscript: this.delta(this.marks.speechEnd, this.marks.transcriptFinal),
      transcriptToFirstAudio: this.delta(
        this.marks.transcriptFinal,
        this.marks.firstAudio
      ),
      firstAudioToPlayback: this.delta(this.marks.firstAudio, this.marks.firstPlayback),
      replyDuration: this.delta(this.marks.firstAudio, this.marks.turnComplete),
    };

    this.history.push(latency);
    this.onReport?.(latency);

    console.info(
      `[VOICE PERF] turn ${latency.turn} — speech end to first audio: ${
        latency.speechEndToFirstAudio ?? "?"
      }ms (transcript ${latency.speechEndToTranscript ?? "?"}ms, model ${
        latency.transcriptToFirstAudio ?? "?"
      }ms)`
    );
  }

  /** Every completed turn, for a test to assert on. */
  snapshot(): TurnLatency[] {
    return this.history.map((entry) => ({ ...entry }));
  }
}

/**
 * Exposes the latest measurements to a browser test.
 *
 * Attached to `window` only outside production, and read by the Playwright
 * latency spec. There is no other way for a test to see timings taken inside a
 * WebSocket callback.
 */
export function publishLatency(history: TurnLatency[]): void {
  if (!isEnabled || typeof window === "undefined") return;
  (window as unknown as { __voiceLatency?: TurnLatency[] }).__voiceLatency = history;
}
