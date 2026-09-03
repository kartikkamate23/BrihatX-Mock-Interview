import { describe, expect, it } from "vitest";

import {
  bytesToInt16,
  decodeBase64,
  decodeSpeechFrame,
  encodeBase64,
  encodeMicrophoneFrame,
  floatTo16BitPCM,
  INPUT_SAMPLE_RATE,
  int16ToBytes,
  int16ToFloat32,
  pcmDurationSeconds,
  resampleMono,
} from "@/lib/voice/audio";

describe("floatTo16BitPCM", () => {
  it("maps the full range without wrapping", () => {
    const pcm = floatTo16BitPCM(new Float32Array([0, 1, -1]));
    expect(pcm[0]).toBe(0);
    expect(pcm[1]).toBe(32767);
    expect(pcm[2]).toBe(-32768);
  });

  it("clamps out-of-range samples instead of wrapping them", () => {
    // Web Audio does not guarantee -1..1. Without the clamp, 1.5 wraps to a
    // large negative number, which is an audible click rather than clipping.
    const pcm = floatTo16BitPCM(new Float32Array([1.5, -1.5]));
    expect(pcm[0]).toBe(32767);
    expect(pcm[1]).toBe(-32768);
  });

  it("round-trips back to float within quantisation error", () => {
    const original = new Float32Array([0, 0.25, -0.5, 0.75]);
    const restored = int16ToFloat32(floatTo16BitPCM(original));
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs(restored[i] - original[i])).toBeLessThan(0.0001);
    }
  });
});

describe("resampleMono", () => {
  it("returns the input untouched when the rates match", () => {
    const input = new Float32Array([1, 2, 3]);
    expect(resampleMono(input, 16000, 16000)).toBe(input);
  });

  it("shortens the signal proportionally when downsampling", () => {
    const input = new Float32Array(480); // 10 ms at 48 kHz
    const output = resampleMono(input, 48000, 16000);
    expect(output.length).toBe(160); // 10 ms at 16 kHz
  });

  it("preserves a constant signal exactly", () => {
    const input = new Float32Array(300).fill(0.5);
    for (const sample of resampleMono(input, 48000, 16000)) {
      expect(sample).toBeCloseTo(0.5, 5);
    }
  });

  it("handles an empty buffer", () => {
    expect(resampleMono(new Float32Array(0), 48000, 16000).length).toBe(0);
  });

  it("rejects a nonsensical rate rather than producing silence", () => {
    expect(() => resampleMono(new Float32Array([1]), 0, 16000)).toThrow();
  });
});

describe("base64", () => {
  it("round-trips every byte value", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;
    expect([...decodeBase64(encodeBase64(bytes))]).toEqual([...bytes]);
  });

  it("matches a known encoding", () => {
    // "Hi" -> SGk=
    expect(encodeBase64(new Uint8Array([72, 105]))).toBe("SGk=");
  });

  it("pads correctly for each remainder", () => {
    expect(encodeBase64(new Uint8Array([1]))).toMatch(/==$/);
    expect(encodeBase64(new Uint8Array([1, 2]))).toMatch(/[^=]=$/);
    expect(encodeBase64(new Uint8Array([1, 2, 3]))).not.toMatch(/=/);
  });

  it("agrees with Node's own base64 implementation", () => {
    const bytes = new Uint8Array([0, 127, 128, 255, 42, 7]);
    expect(encodeBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});

describe("int16 byte order", () => {
  it("writes little-endian, which is what the wire format expects", () => {
    const bytes = int16ToBytes(new Int16Array([1]));
    expect([...bytes]).toEqual([1, 0]);
  });

  it("round-trips through bytes", () => {
    const samples = new Int16Array([0, 1, -1, 32767, -32768]);
    expect([...bytesToInt16(int16ToBytes(samples))]).toEqual([...samples]);
  });

  it("drops a trailing odd byte rather than reading past the buffer", () => {
    expect(bytesToInt16(new Uint8Array([1, 0, 5])).length).toBe(1);
  });
});

describe("frame helpers", () => {
  it("encodes a microphone frame to the size the target rate implies", () => {
    // 20 ms at 48 kHz -> 20 ms at 16 kHz -> 320 samples -> 640 bytes.
    const frame = encodeMicrophoneFrame(new Float32Array(960), 48000);
    expect(decodeBase64(frame).length).toBe(640);
  });

  it("round-trips a microphone frame back to audible samples", () => {
    const input = new Float32Array(1600).fill(0.5);
    const decoded = decodeSpeechFrame(encodeMicrophoneFrame(input, INPUT_SAMPLE_RATE));
    expect(decoded.length).toBe(1600);
    expect(decoded[0]).toBeCloseTo(0.5, 3);
  });

  it("computes playback duration from a byte count", () => {
    // One second of 24 kHz 16-bit mono is 48000 bytes.
    expect(pcmDurationSeconds(48000, 24000)).toBe(1);
  });
});
