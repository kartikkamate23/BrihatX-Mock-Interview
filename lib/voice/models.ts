/**
 * Which Gemini model does which job.
 *
 * These are deliberately two different models. The Live model is a realtime
 * audio model: it is the right tool for a spoken conversation and the wrong one
 * for a careful written assessment, and it is billed accordingly. Feedback is
 * generated once, after the interview, from a transcript -- a text model does
 * that better and cheaper.
 *
 * Both are environment-overridable. Google retires preview models on its own
 * schedule, and the previous pin (`gemini-2.0-flash-001`) started answering 404
 * mid-project; a one-line change in .env.local should be the whole remedy.
 * Verify what is actually served with:
 *   curl -H "x-goog-api-key: $KEY" https://generativelanguage.googleapis.com/v1beta/models
 */

/**
 * The realtime voice model. Confirmed available on this project's key at the
 * time of writing, alongside the `gemini-2.5-flash-native-audio-*` family, which
 * is the natural fallback if this preview is retired.
 */
export const LIVE_MODEL =
  process.env.GOOGLE_GENERATIVE_AI_LIVE_MODEL?.trim() ||
  "gemini-3.1-flash-live-preview";

/** Post-interview scoring. Shares lib/ai.ts's default so there is one text tier. */
export const FEEDBACK_MODEL =
  process.env.GOOGLE_GENERATIVE_AI_FEEDBACK_MODEL?.trim() ||
  process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() ||
  "gemini-2.5-flash";
