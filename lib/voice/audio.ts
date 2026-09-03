/**
 * PCM plumbing for the realtime voice path.
 *
 * The Live API speaks raw little-endian 16-bit PCM in both directions, but not
 * at the same rate: it expects 16 kHz mono in and returns 24 kHz mono out.
 * Browsers, meanwhile, hand you Float32 samples at whatever rate the AudioContext
 * chose (48 kHz on most hardware). Everything here is the arithmetic that
 * bridges those, kept pure and free of Web Audio so the conversions can be
 * tested for real rather than through a wall of mocks.
 */

/** What the Live API accepts as microphone input. */
export const INPUT_SAMPLE_RATE = 16000;
/** What the Live API returns as generated speech. */
export const OUTPUT_SAMPLE_RATE = 24000;

/**
 * Float32 (-1..1) to signed 16-bit PCM.
 *
 * Clamped before scaling: Web Audio does not guarantee the range, and a sample
 * fractionally above 1.0 wraps to a large negative number, which is audible as
 * a click rather than as clipping.
 */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    // Asymmetric on purpose: the negative range of int16 has one more step.
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}

/** Signed 16-bit PCM back to Float32 (-1..1), for Web Audio playback. */
export function int16ToFloat32(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i] / (input[i] < 0 ? 0x8000 : 0x7fff);
  }
  return out;
}

/**
 * Resamples mono audio by linear interpolation.
 *
 * Not a windowed-sinc resampler, and deliberately so: the destination is a
 * speech recogniser at 16 kHz, the source is 48 kHz microphone audio, and the
 * interpolation error sits far above the band that carries speech. A
 * higher-quality filter would cost main-thread time during a live call and buy
 * nothing measurable.
 */
export function resampleMono(
  input: Float32Array,
  inputRate: number,
  outputRate: number
): Float32Array {
  if (inputRate === outputRate) return input;
  if (input.length === 0) return new Float32Array(0);
  if (inputRate <= 0 || outputRate <= 0) {
    throw new Error("Sample rates must be positive.");
  }

  const ratio = inputRate / outputRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);

  for (let i = 0; i < outLength; i++) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, input.length - 1);
    const weight = position - left;
    out[i] = input[left] * (1 - weight) + input[right] * weight;
  }

  return out;
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Base64 without `btoa` or `Buffer`.
 *
 * `btoa` does not exist in Node and `Buffer` does not exist in the browser, and
 * this module is used from both (the browser encodes microphone frames; the
 * tests verify the encoding round-trips). Hand-rolling the 3-byte/4-char
 * grouping avoids branching on the environment inside the hot path.
 */
export function encodeBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      BASE64_ALPHABET[(chunk >> 18) & 63] +
      BASE64_ALPHABET[(chunk >> 12) & 63] +
      BASE64_ALPHABET[(chunk >> 6) & 63] +
      BASE64_ALPHABET[chunk & 63];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    out +=
      BASE64_ALPHABET[(chunk >> 18) & 63] +
      BASE64_ALPHABET[(chunk >> 12) & 63] +
      "==";
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      BASE64_ALPHABET[(chunk >> 18) & 63] +
      BASE64_ALPHABET[(chunk >> 12) & 63] +
      BASE64_ALPHABET[(chunk >> 6) & 63] +
      "=";
  }

  return out;
}

const BASE64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE64_ALPHABET.length; i++) {
  BASE64_LOOKUP[BASE64_ALPHABET[i]] = i;
}

export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, "");
  const byteLength = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(byteLength);

  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = BASE64_LOOKUP[clean[i]] ?? 0;
    const c1 = BASE64_LOOKUP[clean[i + 1]] ?? 0;
    const c2 = BASE64_LOOKUP[clean[i + 2]] ?? 0;
    const c3 = BASE64_LOOKUP[clean[i + 3]] ?? 0;

    const chunk = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;

    if (outIndex < byteLength) out[outIndex++] = (chunk >> 16) & 255;
    if (outIndex < byteLength) out[outIndex++] = (chunk >> 8) & 255;
    if (outIndex < byteLength) out[outIndex++] = chunk & 255;
  }

  return out;
}

/** Little-endian int16 samples as bytes, which is the wire format. */
export function int16ToBytes(samples: Int16Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(i * 2, samples[i], true);
  }
  return out;
}

/** The inverse, for decoding the model's speech. Odd trailing bytes are dropped. */
export function bytesToInt16(bytes: Uint8Array): Int16Array {
  const count = Math.floor(bytes.length / 2);
  const out = new Int16Array(count);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < count; i++) {
    out[i] = view.getInt16(i * 2, true);
  }
  return out;
}

/**
 * One microphone frame, ready to send: resampled, quantised, and base64'd.
 *
 * Composed here rather than in the provider so the whole capture-side transform
 * has a single testable entry point.
 */
export function encodeMicrophoneFrame(
  samples: Float32Array,
  inputRate: number
): string {
  const resampled = resampleMono(samples, inputRate, INPUT_SAMPLE_RATE);
  return encodeBase64(int16ToBytes(floatTo16BitPCM(resampled)));
}

/** The playback-side inverse: base64 PCM to Float32 at the model's rate. */
export function decodeSpeechFrame(base64: string): Float32Array {
  return int16ToFloat32(bytesToInt16(decodeBase64(base64)));
}

/** Seconds of audio a PCM byte count represents, for buffer scheduling. */
export function pcmDurationSeconds(byteLength: number, sampleRate: number): number {
  return byteLength / 2 / sampleRate;
}
