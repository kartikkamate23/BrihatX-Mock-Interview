"use client";

/**
 * Browser audio in and out for the live interview.
 *
 * Capture and playback are deliberately separate AudioContexts. They run at
 * different rates (the microphone at whatever the hardware gives us, playback
 * pinned to the model's 24 kHz), and sharing one context would force the browser
 * to resample the model's speech on the fly -- audibly, and with no way to
 * schedule frames back-to-back without gaps.
 */

import {
  encodeMicrophoneFrame,
  OUTPUT_SAMPLE_RATE,
} from "@/lib/voice/audio";

/**
 * The capture worklet, injected as a blob rather than shipped as a file in
 * /public.
 *
 * A worklet runs on the audio thread, so unlike the deprecated
 * ScriptProcessorNode it cannot be starved by React rendering, MediaPipe
 * inference, or anything else competing for the main thread. During an interview
 * all three are running at once, and dropped microphone frames are the
 * difference between the interviewer hearing a sentence and hearing half of one.
 */
const CAPTURE_WORKLET = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // A render quantum is only 128 samples (~375 main-thread messages/second
    // at 48 kHz). Batch to ~43ms frames so long answers do not spend their
    // main-thread budget on hundreds of resample/base64/WebSocket calls.
    this.pending = new Float32Array(2048);
    this.offset = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const samples = input[0];
      let read = 0;
      while (read < samples.length) {
        const count = Math.min(samples.length - read, this.pending.length - this.offset);
        this.pending.set(samples.subarray(read, read + count), this.offset);
        this.offset += count;
        read += count;
        if (this.offset === this.pending.length) {
          const complete = this.pending;
          this.pending = new Float32Array(2048);
          this.offset = 0;
          this.port.postMessage(complete, [complete.buffer]);
        }
      }
    }
    return true;
  }
}
registerProcessor('interview-capture', CaptureProcessor);
`;

export interface MicrophoneCaptureOptions {
  onFrame: (base64Pcm: string) => void;
  /**
   * Rough input level 0..1, for the mic indicator.
   *
   * Emitted at LEVEL_INTERVAL_MS, not per audio frame. See the note on that
   * constant: the difference is roughly 375 calls per second versus twelve, and
   * the callback on the other side of it updates React state.
   */
  onLevel?: (level: number) => void;
}

/**
 * How often the input level is reported.
 *
 * An AudioWorkletProcessor's `process()` runs once per 128-sample render
 * quantum, which at 48 kHz is about 375 times a second. Reporting a level on
 * every one of those drove roughly 45 React renders per second of the entire
 * interview room -- measured, not estimated -- with MediaPipe inference and the
 * countdown competing for the same main thread. That is enough render pressure
 * to trip React's "Maximum update depth exceeded" on a slower machine, and it is
 * wasted work regardless: this value drives a dot that pulses.
 *
 * 80ms is about 12 updates a second, which still looks responsive and is thirty
 * times less work. Throttling here rather than in the React layer means the
 * guarantee holds no matter who subscribes.
 */
const LEVEL_INTERVAL_MS = 80;

/**
 * Streams the candidate's microphone to the provider as base64 16 kHz PCM.
 *
 * Owns nothing it did not create: the MediaStream is passed in and is stopped by
 * whoever opened it, because the same stream also drives the camera preview and
 * the attention monitor.
 */
export class MicrophoneCapture {
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | ScriptProcessorNode | null = null;
  private running = false;
  private muted = false;
  /** Wall-clock of the last level report, for throttling. */
  private lastLevelAt = 0;
  /** Peak seen since the last report, so throttling does not miss transients. */
  private peakSinceReport = 0;

  constructor(private readonly options: MicrophoneCaptureOptions) {}

  async start(stream: MediaStream): Promise<void> {
    if (this.running) return;
    this.running = true;

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error("This browser does not support AudioContext.");
    }

    const context = new AudioContextCtor();
    this.context = context;
    // Autoplay policy can hand back a suspended context even after a click.
    if (context.state === "suspended") await context.resume();

    this.source = context.createMediaStreamSource(stream);

    const handleSamples = (samples: Float32Array) => {
      if (!this.running || this.muted) return;

      // Audio itself is never throttled: every frame has to reach the model or
      // the interviewer hears a stuttered sentence.
      this.options.onFrame(encodeMicrophoneFrame(samples, context.sampleRate));

      if (!this.options.onLevel) return;

      // The level is tracked on every frame but reported on a timer, so a brief
      // loud moment between reports still shows up rather than being sampled
      // away.
      const peak = peakLevel(samples);
      if (peak > this.peakSinceReport) this.peakSinceReport = peak;

      const now = Date.now();
      if (now - this.lastLevelAt < LEVEL_INTERVAL_MS) return;
      this.lastLevelAt = now;
      const reported = this.peakSinceReport;
      this.peakSinceReport = 0;
      this.options.onLevel(reported);
    };

    try {
      const blob = new Blob([CAPTURE_WORKLET], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      try {
        await context.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }

      const worklet = new AudioWorkletNode(context, "interview-capture");
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) =>
        handleSamples(event.data);
      this.source.connect(worklet);
      // A worklet with no destination is not pulled by the graph in some
      // browsers. A zero-gain sink keeps it running without any audible output
      // (connecting the microphone to the speakers would echo).
      const sink = context.createGain();
      sink.gain.value = 0;
      worklet.connect(sink);
      sink.connect(context.destination);
      this.node = worklet;
    } catch (error) {
      // Worklets need a secure context and are unavailable in a few
      // environments. The deprecated processor still works everywhere and a
      // degraded interview beats no interview.
      console.debug("[AUDIO] worklet unavailable, using ScriptProcessor", error);
      const processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) =>
        handleSamples(new Float32Array(event.inputBuffer.getChannelData(0)));
      this.source.connect(processor);
      processor.connect(context.destination);
      this.node = processor;
    }
  }

  /** Stops sending audio without tearing the graph down. */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.node) {
      try {
        this.node.disconnect();
        if ("port" in this.node) this.node.port.onmessage = null;
        else this.node.onaudioprocess = null;
      } catch {
        // Already detached.
      }
      this.node = null;
    }

    try {
      this.source?.disconnect();
    } catch {
      // Already detached.
    }
    this.source = null;

    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // Closing twice is not an error worth surfacing.
      }
    }
  }
}

function peakLevel(samples: Float32Array): number {
  let peak = 0;
  // Every 8th sample: this drives a level meter, not a measurement.
  for (let i = 0; i < samples.length; i += 8) {
    const value = Math.abs(samples[i]);
    if (value > peak) peak = value;
  }
  return Math.min(1, peak);
}

/**
 * Plays the interviewer's speech.
 *
 * Frames arrive faster than real time and must be played back-to-back with no
 * gaps, so each one is scheduled against a running cursor rather than played on
 * arrival. Playing on arrival produces the stuttering, overlapping speech that
 * makes a realtime voice agent sound broken.
 */
export class SpeechPlayer {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private cursor = 0;
  private readonly active = new Set<AudioBufferSourceNode>();
  private onEnded: (() => void) | null = null;

  constructor(options: { onPlaybackEnded?: () => void } = {}) {
    this.onEnded = options.onPlaybackEnded ?? null;
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error("This browser does not support AudioContext.");
    }

    // Pinned to the model's rate so no resampling happens on the audio thread.
    const context = new AudioContextCtor({ sampleRate: OUTPUT_SAMPLE_RATE });
    this.context = context;
    this.gain = context.createGain();
    this.gain.connect(context.destination);
    return context;
  }

  async resume(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === "suspended") await context.resume();
  }

  play(samples: Float32Array): void {
    if (samples.length === 0) return;
    const context = this.ensureContext();
    if (!this.gain) return;

    const buffer = context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);

    // A small lead so the first frame is not scheduled in the past, which the
    // browser would render as a click.
    const startAt = Math.max(this.cursor, context.currentTime + 0.02);
    source.start(startAt);
    this.cursor = startAt + buffer.duration;

    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      try {
        source.disconnect();
      } catch {
        // The source may already have been detached by flush().
      }
      if (this.active.size === 0) this.onEnded?.();
    };
  }

  /**
   * Drops everything queued.
   *
   * Called when the candidate interrupts: the buffered speech is a reply to
   * something that is no longer happening, and letting it finish means the
   * interviewer talks over the candidate for as long as the buffer is deep.
   */
  flush(): void {
    for (const source of [...this.active]) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        // Already finished.
      }
    }
    this.active.clear();
    this.cursor = this.context ? this.context.currentTime : 0;
  }

  /** True while there is speech scheduled or playing. */
  get isPlaying(): boolean {
    return this.active.size > 0;
  }

  async close(): Promise<void> {
    this.flush();
    const context = this.context;
    this.context = null;
    this.gain = null;
    this.onEnded = null;
    if (context && context.state !== "closed") {
      try {
        await context.close();
      } catch {
        // Nothing useful to do while tearing down.
      }
    }
  }
}
