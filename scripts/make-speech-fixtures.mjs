/**
 * make-speech-fixtures.mjs
 *
 * Generates real spoken-audio WAV fixtures for Playwright/Chrome fake-microphone tests.
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * Chrome can be told to use a file as the microphone input:
 *     --use-file-for-fake-audio-capture=<path.wav>
 * Chrome requires 16-bit PCM (mono or stereo) and loops the file forever. To make a
 * voice-activity detector (Gemini Live's, in our case) genuinely fire, the audio has to
 * be actual speech - a pure tone or white noise will not reliably trip a real VAD.
 *
 * WHY WE HAND-WRITE THE WAV HEADER
 * --------------------------------
 * Gemini's TTS endpoint returns audio as base64 in `inlineData.data` with a mimeType of
 * `audio/L16;codec=pcm;rate=24000`. "L16" is RAW, HEADERLESS, little-endian signed
 * 16-bit PCM: there is no RIFF container, no `fmt ` chunk, nothing that tells a consumer
 * the sample rate or the channel count. Chrome will not open a headerless blob - it
 * silently falls back to its built-in beep tone, which would quietly invalidate every
 * measurement taken with the fixture. So we prepend the canonical 44-byte RIFF/WAVE
 * header ourselves, taking the sample rate from the mimeType (never assuming 24000) and
 * declaring PCM format 1, 1 channel, 16 bits per sample.
 *
 * WHY THE TRAILING SILENCE MATTERS
 * --------------------------------
 * Chrome loops the fixture seamlessly. Without trailing silence the last word of the
 * answer butts directly against the first word of the next loop iteration, so the VAD
 * never observes an end-of-speech boundary and the "candidate stopped talking" branch of
 * the app is never exercised. Appending 3.0s of digital silence gives every loop a clean,
 * unambiguous end-of-utterance. `paused-answer.wav` additionally embeds 1.2s of silence
 * MID-answer - a natural thinking pause - to prove the VAD does not cut a candidate off
 * mid-thought.
 *
 * Usage:  node scripts/make-speech-fixtures.mjs [--force]
 */

import { config } from 'dotenv';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'e2e', 'fixtures', 'audio');

config({ path: path.join(ROOT, '.env.local'), quiet: true });

const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const FORCE = process.argv.includes('--force');

const TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'];
const VOICE = 'Puck';
const TRAILING_SILENCE_SEC = 3.0;
const MID_PAUSE_SEC = 1.2;
const FALLBACK_RATE = 24000;

/** Model that actually worked, discovered at runtime. */
let workingModel = null;
let usedSyntheticFallback = false;
let usedBorrowedSpeech = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// WAV plumbing
// ---------------------------------------------------------------------------

/**
 * Build the canonical 44-byte RIFF/WAVE header for raw 16-bit little-endian PCM.
 * Layout (all little-endian except the four ASCII tags):
 *   0  "RIFF" | 4 chunkSize=36+dataLen | 8  "WAVE"
 *   12 "fmt " | 16 subchunk1Size=16    | 20 audioFormat=1 (PCM)
 *   22 numChannels | 24 sampleRate | 28 byteRate | 32 blockAlign | 34 bitsPerSample
 *   36 "data"  | 40 dataLen
 */
function wavHeader(dataLength, sampleRate, channels = 1, bitsPerSample = 16) {
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(36 + dataLength, 4);
  h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii');
  h.writeUInt32LE(16, 16); // PCM fmt chunk size
  h.writeUInt16LE(1, 20); // audioFormat = 1 => PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bitsPerSample, 34);
  h.write('data', 36, 'ascii');
  h.writeUInt32LE(dataLength, 40);
  return h;
}

function silencePcm(seconds, sampleRate, channels = 1) {
  const frames = Math.round(seconds * sampleRate);
  return Buffer.alloc(frames * channels * 2); // zeroed = digital silence
}

/** Read back a written WAV and assert every size field is internally consistent. */
async function verifyWav(file) {
  const buf = await readFile(file);
  const problems = [];
  const need = (cond, msg) => {
    if (!cond) problems.push(msg);
  };

  need(buf.length >= 44, `file is only ${buf.length} bytes, too small for a WAV header`);
  if (buf.length >= 44) {
    const riff = buf.toString('ascii', 0, 4);
    const wave = buf.toString('ascii', 8, 12);
    const fmt = buf.toString('ascii', 12, 16);
    const dataTag = buf.toString('ascii', 36, 40);
    const riffSize = buf.readUInt32LE(4);
    const fmtSize = buf.readUInt32LE(16);
    const audioFormat = buf.readUInt16LE(20);
    const channels = buf.readUInt16LE(22);
    const sampleRate = buf.readUInt32LE(24);
    const byteRate = buf.readUInt32LE(28);
    const blockAlign = buf.readUInt16LE(32);
    const bits = buf.readUInt16LE(34);
    const dataSize = buf.readUInt32LE(40);

    need(riff === 'RIFF', `bad RIFF tag: ${JSON.stringify(riff)}`);
    need(wave === 'WAVE', `bad WAVE tag: ${JSON.stringify(wave)}`);
    need(fmt === 'fmt ', `bad fmt tag: ${JSON.stringify(fmt)}`);
    need(dataTag === 'data', `bad data tag: ${JSON.stringify(dataTag)}`);
    need(fmtSize === 16, `fmt chunk size ${fmtSize} != 16`);
    need(audioFormat === 1, `audioFormat ${audioFormat} != 1 (PCM) - Chrome needs PCM`);
    need(bits === 16, `bitsPerSample ${bits} != 16 - Chrome needs 16-bit`);
    need(channels === 1 || channels === 2, `channels ${channels} must be 1 or 2`);
    need(blockAlign === (channels * bits) / 8, `blockAlign ${blockAlign} inconsistent`);
    need(byteRate === sampleRate * blockAlign, `byteRate ${byteRate} != sampleRate*blockAlign`);
    need(dataSize === buf.length - 44, `data size ${dataSize} != actual payload ${buf.length - 44}`);
    need(riffSize === buf.length - 8, `RIFF size ${riffSize} != fileSize-8 (${buf.length - 8})`);
    need(dataSize % blockAlign === 0, `data size ${dataSize} is not a whole number of frames`);

    if (problems.length === 0) {
      return {
        ok: true,
        bytes: buf.length,
        sampleRate,
        channels,
        bits,
        durationSec: dataSize / byteRate,
      };
    }
  }
  return { ok: false, problems, bytes: buf.length };
}

// ---------------------------------------------------------------------------
// Gemini TTS
// ---------------------------------------------------------------------------

function parseRate(mimeType) {
  const m = /rate=(\d+)/i.exec(mimeType || '');
  return m ? Number(m[1]) : FALLBACK_RATE;
}

/** One TTS call against a specific model. Throws on any non-2xx. */
async function ttsOnce(model, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
      },
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    const err = new Error(
      `HTTP ${res.status} ${res.statusText} from ${model}: ${raw.replace(/\s+/g, ' ').slice(0, 300)}`
    );
    err.status = res.status;
    // Google returns a RetryInfo hint like "retryDelay": "31s" on quota errors; honour it.
    const hint = /"retryDelay"\s*:\s*"(\d+)s"/.exec(raw);
    if (hint) err.retryAfterMs = Number(hint[1]) * 1000 + 1000;
    throw err;
  }

  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData?.data);
  if (!part) {
    const finish = json?.candidates?.[0]?.finishReason ?? 'unknown';
    throw new Error(`no inline audio in response from ${model} (finishReason=${finish})`);
  }
  return {
    pcm: Buffer.from(part.inlineData.data, 'base64'), // raw headerless L16 PCM
    sampleRate: parseRate(part.inlineData.mimeType),
  };
}

/**
 * TTS with retry: 2 retries (3 attempts total) with short backoff for transient
 * failures (429 / 5xx / network). A 404/400/403 means the model is not usable on this
 * key at all, so it is surfaced immediately and the caller tries the next model.
 */
async function ttsWithRetry(model, text, label) {
  // Free-tier TTS quota is per-minute, so the backoff has to be long enough to
  // actually clear a 429 rather than burning both retries in five seconds.
  const delays = [15000, 45000];
  let lastErr;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await ttsOnce(model, text);
    } catch (err) {
      lastErr = err;
      if (err.status === 404 || err.status === 400 || err.status === 403) throw err;
      if (attempt < delays.length) {
        const wait = Math.max(delays[attempt], err.retryAfterMs ?? 0);
        console.warn(
          `  ! TTS attempt ${attempt + 1} failed for ${label} ` +
            `(${err.message.slice(0, 160)}) - retrying in ${wait}ms`
        );
        await sleep(wait);
      }
    }
  }
  throw lastErr;
}

/** Resolve which TTS model this key can use, caching the answer. */
async function synthesize(text, label) {
  if (workingModel) return ttsWithRetry(workingModel, text, label);

  let lastErr;
  for (const model of TTS_MODELS) {
    try {
      const out = await ttsWithRetry(model, text, label);
      workingModel = model;
      console.log(`  TTS model in use: ${model}`);
      return out;
    } catch (err) {
      lastErr = err;
      console.warn(`  ! model ${model} unavailable: ${err.message.slice(0, 200)}`);
    }
  }
  throw lastErr ?? new Error('no TTS model available');
}

// ---------------------------------------------------------------------------
// Synthetic fallback (only if TTS is entirely unavailable)
// ---------------------------------------------------------------------------

/**
 * Middle fallback tier: recycle REAL speech from a fixture we already generated.
 *
 * Gemini's free tier caps TTS at 10 requests per day per model, so a re-run late in the
 * day can find TTS temporarily unavailable even though the key is fine. Synthetic tones
 * are a poor substitute for `paused-answer.wav` in particular, whose entire job is to
 * prove a real VAD does not cut a candidate off mid-thought. Real speech recycled from a
 * sibling fixture is far closer to the real thing than a formant buffer, so we try that
 * first and keep the synthetic buffer as the last resort.
 */
async function borrowRealSpeech(excludeName) {
  let best = null;
  for (const fx of FIXTURES) {
    if (fx.name === excludeName) continue;
    const p = path.join(OUT_DIR, fx.name);
    if (!(await exists(p))) continue;
    const v = await verifyWav(p);
    if (!v.ok || v.channels !== 1) continue;
    if (!best || v.durationSec > best.durationSec) best = { ...v, path: p };
  }
  if (!best) return null;

  const buf = await readFile(best.path);
  let pcm = buf.subarray(44);

  // Trim trailing digital silence so we splice speech, not padding.
  const THRESHOLD = 500; // ~1.5% of full scale
  let end = Math.floor(pcm.length / 2);
  while (end > 0 && Math.abs(pcm.readInt16LE((end - 1) * 2)) < THRESHOLD) end--;
  pcm = pcm.subarray(0, end * 2);

  return { pcm, sampleRate: best.sampleRate, source: path.basename(best.path) };
}

/** Extract `seconds` of audio starting at fraction `from` of the buffer, with edge fades. */
function sliceWithFades(pcm, sampleRate, fromFraction, seconds) {
  const totalFrames = Math.floor(pcm.length / 2);
  const want = Math.min(Math.round(seconds * sampleRate), totalFrames);
  let start = Math.floor(totalFrames * fromFraction);
  if (start + want > totalFrames) start = Math.max(0, totalFrames - want);

  const out = Buffer.from(pcm.subarray(start * 2, (start + want) * 2));
  // 10ms fades stop the splice from producing an audible click that a VAD may
  // misread as a transient.
  const fade = Math.min(Math.round(0.01 * sampleRate), Math.floor(want / 2));
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out.writeInt16LE(Math.round(out.readInt16LE(i * 2) * g), i * 2);
    const j = want - 1 - i;
    out.writeInt16LE(Math.round(out.readInt16LE(j * 2) * g), j * 2);
  }
  return out;
}

/**
 * Formant-like buffer: a few sine components inside the 100-3000 Hz speech band,
 * amplitude-modulated at ~4.5 Hz to mimic a syllable rate. Not real speech, but far
 * more likely to trip an energy/spectral VAD than a pure tone.
 */
function syntheticSpeechPcm(seconds, sampleRate) {
  const frames = Math.round(seconds * sampleRate);
  const buf = Buffer.alloc(frames * 2);
  const f0 = 120; // "pitch"
  const formants = [520, 1180, 2560]; // vowel-ish formants
  for (let i = 0; i < frames; i++) {
    const t = i / sampleRate;
    // syllable-rate amplitude modulation, 3-6 Hz
    const syl = 0.5 + 0.5 * Math.sin(2 * Math.PI * 4.5 * t);
    const wobble = 1 + 0.03 * Math.sin(2 * Math.PI * 1.7 * t); // slight pitch drift
    let s = 0.35 * Math.sin(2 * Math.PI * f0 * wobble * t);
    for (let k = 0; k < formants.length; k++) {
      s += (0.28 / (k + 1)) * Math.sin(2 * Math.PI * formants[k] * wobble * t);
    }
    const v = Math.max(-1, Math.min(1, s * syl * 0.55));
    buf.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Fixture texts
// ---------------------------------------------------------------------------

/** Target ~6-10s of speech. Gemini's Puck voice runs at roughly 3 words/second. */
const SHORT_TEXT =
  'I have about three years of experience, mostly building web applications with ' +
  'React and Node, and lately a lot of testing work.';

/**
 * Long answer, split across several TTS calls whose PCM we concatenate. Sized for
 * roughly 45-60s of speech in total; `LONG_TARGET_SEC` stops the loop early if the
 * voice runs slower than expected on a given day.
 */
const LONG_TARGET_SEC = 55;
const LONG_CHUNKS = [
  'So the biggest thing I built was an e-commerce platform. Next.js on the front end, ' +
    'server rendered for the catalogue because search visibility mattered, a Node service ' +
    'layer behind it, Postgres as the source of truth for orders and inventory, and Redis ' +
    'in front of it for caching the hot category pages.',
  'About six months in, the category pages started getting slow. The ninety fifth ' +
    'percentile crept from around two hundred milliseconds up to nearly two seconds, and ' +
    'it was gradual enough that nobody really noticed for weeks.',
  'What found it was turning on slow query logging and running explain analyze on the ' +
    'worst offenders. It was a classic N plus one. The listing endpoint went back to the ' +
    'database once per product for the variants and the price, so a page of sixty ' +
    'products meant a hundred and twenty extra round trips. There was also a missing ' +
    'composite index causing a sequential scan on one of the filters.',
  'The fix was not glamorous. We batched the variant lookups into a single query, added ' +
    'the index, and cached the assembled response instead of the individual pieces. That ' +
    'put us back under two hundred milliseconds. What I would do differently is add query ' +
    'level observability on day one, and run a load test in continuous integration ' +
    'against a realistically sized dataset, because everything looked fine on a laptop ' +
    'with two hundred products and fell over with two hundred thousand.',
];

const PAUSED_PART_A =
  'That is a good question. The hardest technical decision I have made was probably ' +
  'whether to split our monolith into services.';

const PAUSED_PART_B =
  'Sorry, I was just trying to remember the timeline. In the end we only extracted the ' +
  'payment flow, because that had genuinely different scaling and compliance needs, and ' +
  'we left everything else in the monolith. With a team of six, that was the right call.';

// ---------------------------------------------------------------------------
// Fixture builders - each returns the *speech body* PCM plus its sample rate.
// ---------------------------------------------------------------------------

async function buildShort() {
  try {
    return await synthesize(SHORT_TEXT, 'short-answer');
  } catch (err) {
    usedSyntheticFallback = true;
    console.warn(`  ! falling back to synthetic audio: ${err.message.slice(0, 200)}`);
    return { pcm: syntheticSpeechPcm(8, FALLBACK_RATE), sampleRate: FALLBACK_RATE };
  }
}

async function buildLong() {
  const parts = [];
  let sampleRate = FALLBACK_RATE;
  try {
    for (let i = 0; i < LONG_CHUNKS.length; i++) {
      const res = await synthesize(LONG_CHUNKS[i], `long-answer chunk ${i + 1}`);
      sampleRate = res.sampleRate;
      parts.push(res.pcm);
      // A short breath between sentences keeps it natural without ending the utterance.
      if (i < LONG_CHUNKS.length - 1) parts.push(silencePcm(0.25, sampleRate));
      const soFar = parts.reduce((n, b) => n + b.length, 0) / (sampleRate * 2);
      console.log(`    chunk ${i + 1}/${LONG_CHUNKS.length} -> ${soFar.toFixed(1)}s cumulative`);
      // Stop early if the voice ran slower than expected, so we stay in the 45-60s window.
      if (soFar >= LONG_TARGET_SEC) {
        console.log(`    reached ${soFar.toFixed(1)}s (target ${LONG_TARGET_SEC}s), stopping early`);
        break;
      }
    }
    const pcm = Buffer.concat(parts);
    const secs = pcm.length / (sampleRate * 2);
    if (secs < 45) {
      console.warn(`  ! long-answer speech is only ${secs.toFixed(1)}s (target 45-60s)`);
    }
    return { pcm, sampleRate };
  } catch (err) {
    usedSyntheticFallback = true;
    console.warn(`  ! falling back to synthetic audio: ${err.message.slice(0, 200)}`);
    return { pcm: syntheticSpeechPcm(50, FALLBACK_RATE), sampleRate: FALLBACK_RATE };
  }
}

async function buildPaused() {
  try {
    const a = await synthesize(PAUSED_PART_A, 'paused-answer part A');
    const b = await synthesize(PAUSED_PART_B, 'paused-answer part B');
    if (b.sampleRate !== a.sampleRate) {
      throw new Error(`sample rate mismatch between parts (${a.sampleRate} vs ${b.sampleRate})`);
    }
    // 1.2s thinking pause in the MIDDLE of the answer.
    return {
      pcm: Buffer.concat([a.pcm, silencePcm(MID_PAUSE_SEC, a.sampleRate), b.pcm]),
      sampleRate: a.sampleRate,
    };
  } catch (err) {
    console.warn(`  ! TTS unavailable for paused-answer: ${err.message.slice(0, 200)}`);

    // Tier 2: real speech recycled from a sibling fixture.
    const borrowed = await borrowRealSpeech('paused-answer.wav');
    if (borrowed) {
      usedBorrowedSpeech = true;
      const { pcm, sampleRate } = borrowed;
      console.warn(`  ! reusing real speech from ${borrowed.source} instead of synthetic tones`);
      return {
        pcm: Buffer.concat([
          sliceWithFades(pcm, sampleRate, 0.0, 8),
          silencePcm(MID_PAUSE_SEC, sampleRate),
          sliceWithFades(pcm, sampleRate, 0.45, 8),
        ]),
        sampleRate,
      };
    }

    // Tier 3: synthetic formant buffer.
    usedSyntheticFallback = true;
    console.warn('  ! falling back to synthetic audio');
    const sr = FALLBACK_RATE;
    return {
      pcm: Buffer.concat([
        syntheticSpeechPcm(5, sr),
        silencePcm(MID_PAUSE_SEC, sr),
        syntheticSpeechPcm(7, sr),
      ]),
      sampleRate: sr,
    };
  }
}

const FIXTURES = [
  { name: 'short-answer.wav', build: buildShort },
  { name: 'long-answer.wav', build: buildLong },
  { name: 'paused-answer.wav', build: buildPaused },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function exists(p) {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!API_KEY) {
    console.error(
      'ERROR: GOOGLE_GENERATIVE_AI_API_KEY is not set. Expected it in .env.local at the repo root.'
    );
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUT_DIR}`);
  if (FORCE) console.log('--force: regenerating every fixture.');

  const report = [];

  for (const fx of FIXTURES) {
    const outPath = path.join(OUT_DIR, fx.name);

    if (!FORCE && (await exists(outPath))) {
      const existing = await verifyWav(outPath);
      if (existing.ok) {
        console.log(`\n${fx.name}: already exists, skipping (pass --force to regenerate)`);
        report.push({ name: fx.name, ...existing, skipped: true });
        continue;
      }
      console.warn(`\n${fx.name}: existing file failed verification, regenerating.`);
    }

    console.log(`\n${fx.name}: generating...`);
    const { pcm, sampleRate } = await fx.build();

    // Trailing digital silence so Chrome's loop always presents an end-of-speech.
    const body = Buffer.concat([pcm, silencePcm(TRAILING_SILENCE_SEC, sampleRate)]);
    const wav = Buffer.concat([wavHeader(body.length, sampleRate, 1, 16), body]);
    await writeFile(outPath, wav);

    const v = await verifyWav(outPath);
    if (!v.ok) {
      console.error(`FATAL: wrote a malformed WAV for ${fx.name}:`);
      for (const p of v.problems) console.error(`  - ${p}`);
      process.exit(1);
    }
    report.push({ name: fx.name, ...v, skipped: false });
  }

  console.log('\n--- fixtures ---');
  for (const r of report) {
    console.log(
      `${r.name.padEnd(20)} ${r.durationSec.toFixed(2).padStart(7)}s  ` +
        `${String(r.sampleRate).padStart(6)} Hz  ${r.channels}ch/${r.bits}-bit  ` +
        `${String(r.bytes).padStart(9)} bytes (${(r.bytes / 1048576).toFixed(2)} MB)` +
        `${r.skipped ? '  [existing]' : ''}  header OK`
    );
  }

  if (usedBorrowedSpeech) {
    console.warn(
      '\nNOTE: Gemini TTS was rate limited (free tier allows 10 TTS requests per day), ' +
        'so paused-answer.wav was assembled from REAL speech recycled from a sibling ' +
        'fixture rather than a purpose-recorded take. It is genuine speech and valid for ' +
        'VAD testing; re-run with --force once quota resets for the scripted wording.'
    );
  }

  if (usedSyntheticFallback) {
    console.warn(
      '\nWARNING: Gemini TTS was unavailable for at least one fixture, so SYNTHETIC ' +
        'formant-like audio was written instead of real speech. These files may not ' +
        'reliably trip a production VAD. Re-run with --force once TTS is reachable.'
    );
  }

  console.log(
    `\nUse with: --use-fake-device-for-media-stream ` +
      `--use-file-for-fake-audio-capture=${path.join(OUT_DIR, 'short-answer.wav')}`
  );
}

main().catch((err) => {
  console.error(`\nFATAL: fixture generation failed: ${err?.message ?? err}`);
  process.exit(1);
});
