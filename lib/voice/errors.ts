/**
 * Normalising whatever the voice transport hands us into something a person can
 * act on.
 *
 * Kept free of any SDK import so it can be tested in isolation, and deliberately
 * defensive about the *shape* of the input. The lesson from the previous
 * provider was not "that provider was bad" -- it was that a realtime transport
 * reports failure as whatever it happens to have: an `Error`, a bare string, a
 * `CloseEvent` carrying only a numeric code, an `ErrorEvent` whose `message` is
 * empty, or a plain object whose useful fields are nested two levels down.
 * `console.error(e)` on several of those prints `{}`, which is how a perfectly
 * diagnosable failure became an unreadable one.
 */

export type VoiceErrorKind =
  | "closed" // the session ended normally; not a failure at all
  | "quota" // rate limited or out of quota
  | "auth" // token rejected or expired
  | "permission" // microphone or camera refused by the browser
  | "network" // transport dropped, may be worth retrying
  | "unsupported" // the browser cannot do what this needs
  | "unknown";

export interface VoiceErrorReport {
  kind: VoiceErrorKind;
  /** One sentence, safe to show a user. Never contains credentials. */
  message: string;
  /** Everything we could recover, for the console and server log only. */
  detail: Record<string, unknown>;
  /** True when the session cannot continue. */
  fatal: boolean;
  /** True when reconnecting has a realistic chance of working. */
  retryable: boolean;
}

/** WebSocket close codes that mean "this ended the way it was supposed to". */
const NORMAL_CLOSE_CODES = new Set([1000, 1001, 1005]);

/**
 * Pulls a human sentence out of a value of unknown shape.
 *
 * Ordered by specificity: an explicit `message` beats a `reason`, which beats a
 * status line. Bounded on purpose -- walking arbitrary depth only finds noise.
 */
export function extractMessage(error: unknown): string | undefined {
  if (typeof error === "string") return error.trim() || undefined;
  if (error instanceof Error) return error.message?.trim() || undefined;
  if (typeof error !== "object" || error === null) return undefined;

  const e = error as Record<string, unknown>;
  const nested = (key: string): unknown =>
    (e[key] as Record<string, unknown> | undefined)?.message;

  const candidates = [
    e.message,
    e.reason,
    e.errorMessage,
    e.statusText,
    e.error,
    e.data,
    e.cause,
    nested("error"),
    nested("data"),
    nested("cause"),
    (e.error as Record<string, unknown> | undefined)?.status,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate.trim();
    }
  }
  return undefined;
}

/**
 * Serialises own properties including non-enumerable ones.
 *
 * `JSON.stringify(new Error("x"))` is `{}`, because `message` and `stack` are
 * non-enumerable. Passing the property-name list fixes that, and is exactly the
 * difference between a log line that says something and one that says `{}`.
 */
function ownProperties(error: unknown): Record<string, unknown> {
  if (typeof error !== "object" || error === null) return {};
  try {
    return JSON.parse(
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    ) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Reads the fields a DOM CloseEvent carries, without requiring the DOM type. */
function closeInfo(
  error: unknown
): { code: number; reason: string; wasClean: boolean } | null {
  if (typeof error !== "object" || error === null) return null;
  const e = error as Record<string, unknown>;
  if (typeof e.code !== "number") return null;
  // An HTTP-ish status on a plain object is not a socket close code.
  if (!("wasClean" in e) && !("reason" in e)) return null;
  return {
    code: e.code,
    reason: typeof e.reason === "string" ? e.reason : "",
    wasClean: e.wasClean === true,
  };
}

function detailOf(error: unknown): Record<string, unknown> {
  const detail: Record<string, unknown> = { ...ownProperties(error) };

  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    for (const key of ["name", "type", "code", "status", "reason", "wasClean"]) {
      const value = e[key];
      if (value !== undefined && value !== null && value !== "") {
        detail[key] = value;
      }
    }
  } else {
    detail.value = String(error);
  }

  if (error instanceof Error && error.stack) detail.stack = error.stack;
  return detail;
}

/**
 * The single classifier for anything the voice path throws or emits.
 *
 * A normal close is reported as `kind: "closed"`, `fatal: false`. That matters:
 * hanging up at the end of an interview must never reach the user as an error,
 * and the previous architecture's most misleading behaviour was exactly that --
 * a healthy session that logged like a crash on the way out.
 */
export function normalizeVoiceError(error: unknown): VoiceErrorReport {
  const detail = detailOf(error);
  const raw = extractMessage(error) ?? "";

  const close = closeInfo(error);
  if (close) {
    detail.closeCode = close.code;
    // `wasClean` only means the WebSocket closing handshake completed. A
    // provider can cleanly close with an application error code (for example
    // 4001 for an expired token), so the code remains authoritative.
    if (NORMAL_CLOSE_CODES.has(close.code)) {
      return {
        kind: "closed",
        message: "The interview session ended.",
        detail,
        fatal: false,
        retryable: false,
      };
    }
  }

  const haystack = (raw + " " + JSON.stringify(detail)).toLowerCase();

  // Browser media refusals arrive as DOMException with a meaningful `name`.
  const name = typeof detail.name === "string" ? detail.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      kind: "permission",
      message:
        "Microphone access was blocked. Allow it from the padlock icon in the address bar, then start the interview again.",
      detail,
      fatal: true,
      retryable: false,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      kind: "permission",
      message:
        "No microphone was found. Connect one and start the interview again.",
      detail,
      fatal: true,
      retryable: false,
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      kind: "permission",
      message:
        "Your microphone is in use by another application. Close it and start the interview again.",
      detail,
      fatal: true,
      retryable: false,
    };
  }

  if (
    /quota|rate.?limit|429|resource_exhausted|too many requests/.test(haystack)
  ) {
    return {
      kind: "quota",
      message:
        "The AI service is temporarily unavailable because it is rate limited. Please try again in a few minutes.",
      detail,
      fatal: true,
      // Retrying inside one session cannot clear a quota window.
      retryable: false,
    };
  }

  if (
    /401|403|1008|unauthenticated|permission.?denied|invalid.*(key|token)|token.*(expired|invalid)|api key/.test(
      haystack
    )
  ) {
    return {
      kind: "auth",
      message:
        "Voice interview configuration is unavailable. Please try again, or contact support if this continues.",
      detail,
      fatal: true,
      retryable: false,
    };
  }

  if (
    /audioworklet|audiocontext|not supported|unsupported|websocket is not defined/.test(
      haystack
    )
  ) {
    return {
      kind: "unsupported",
      message:
        "This browser cannot run a voice interview. Use a recent Chrome, Edge, or Safari over https.",
      detail,
      fatal: true,
      retryable: false,
    };
  }

  if (
    /network|timeout|timed out|econn|socket|disconnect|going away|1006|1011|1012|1013|abnormal/.test(
      haystack
    )
  ) {
    return {
      kind: "network",
      message: "Connection interrupted. Reconnecting…",
      detail,
      fatal: true,
      retryable: true,
    };
  }

  return {
    kind: "unknown",
    // Deliberately not the raw text: it is routinely a stack trace or several
    // hundred characters of provider JSON. The full detail is in the log.
    message:
      "The voice connection failed unexpectedly. Please start the interview again.",
    detail,
    fatal: true,
    retryable: false,
  };
}

/** True when this is the session closing normally rather than a fault. */
export function isNormalClosure(error: unknown): boolean {
  return normalizeVoiceError(error).kind === "closed";
}
