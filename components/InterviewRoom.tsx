"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useInterviewSession } from "@/hooks/useInterviewSession";
import { cn } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/voice/session-state";

interface Props {
  userName: string;
  interviewId: string;
  role: string;
  interviewerName: string;
  profileImage?: string;
  requestedDurationSeconds: number;
  devDurationSeconds?: number;
  startDisabled?: boolean;
  startDisabledReason?: string;
  onStateChange?: (state: string) => void;
}

const InterviewRoom = ({
  userName,
  interviewId,
  role,
  interviewerName,
  profileImage,
  requestedDurationSeconds,
  devDurationSeconds,
  startDisabled = false,
  startDisabledReason,
  onStateChange,
}: Props) => {
  const router = useRouter();
  const [confirmingEnd, setConfirmingEnd] = useState(false);

  const handleCompleted = useCallback(
    (feedbackId: string | undefined) => {
      toast.success("Interview complete. Preparing your feedback...");
      router.push(`/interview/${interviewId}/feedback`);
      router.refresh();
      void feedbackId;
    },
    [interviewId, router]
  );

  const handleFailed = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const session = useInterviewSession({
    interviewId,
    userName,
    role,
    requestedDurationSeconds,
    devDurationSeconds,
    onCompleted: handleCompleted,
    onFailed: handleFailed,
  });

  const { state, media, timer, attention, speaking, lastLine } = session;

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const cameraLive = media.cameraLive;
  const isBusy = state === "requesting_permissions" || state === "connecting";
  const isFinishing = state === "ending" || state === "duration_expired";
  const showStartButton = !session.canEnd && !isFinishing && state !== "completed";
  const endingSoon = timer.remainingMs !== null && timer.remainingMs <= 60_000;
  const tone = statusTone(state, { speaking });
  const status = statusLabel(state, { speaking });

  const cameraFallbackLabel = (() => {
    if (media.status === "requesting") {
      return "Waiting for camera and microphone access...";
    }
    if (media.status === "denied") {
      if (media.blocked === "camera") {
        return "Camera access is blocked. Allow it in your browser, then start again.";
      }
      if (media.blocked === "microphone") {
        return "Microphone access is blocked. Allow it in your browser, then start again.";
      }
      return "Camera and microphone access are blocked. Allow both in your browser, then start again.";
    }
    if (media.status === "unavailable") {
      if (media.blocked === "camera") return "No camera was found on this device.";
      if (media.blocked === "microphone") {
        return "No microphone was found on this device.";
      }
      return "No camera or microphone was found on this device.";
    }
    if (media.status === "error") {
      return "The camera or microphone could not be started.";
    }
    if (media.status === "ready" && !media.cameraEnabled) return "Camera is off";
    if (media.status === "ready" && !media.cameraLive) {
      return "Camera unavailable. Check that it is connected and allowed.";
    }
    return "Your camera preview turns on when the interview starts.";
  })();

  const statusHint = (() => {
    if (state === "connected") return "The AI is lining up the opening question.";
    if (state === "interviewing" && speaking) {
      return "Listen through the question, then answer naturally when the AI stops.";
    }
    if (state === "interviewing") {
      return "Answer clearly. The AI is listening for your response.";
    }
    if (state === "reconnecting") {
      return "Stay on this screen while we restore the live connection.";
    }
    if (state === "duration_expired") {
      return "Your responses so far are being wrapped up and saved.";
    }
    if (state === "ending") {
      return "Please stay here while your transcript and score are prepared.";
    }
    return "A live camera and microphone preview helps you catch permission issues before the interview begins.";
  })();

  const roomAlert =
    session.error && state !== "interviewing"
      ? session.error
      : media.message && (session.canEnd || !session.error)
        ? media.message
        : null;

  return (
    <div className="flex flex-col gap-5">
      <div className={cn(
        "camera-stage w-full",
        attention.warningActive && "camera-stage-warning",
        attention.view.severity === "CRITICAL" && "camera-stage-critical"
      )}>
        <div className="relative aspect-video w-full overflow-hidden rounded-[1.35rem] bg-[#020708]">
          <video
            ref={media.videoRef}
            autoPlay
            playsInline
            muted
            aria-label={`Your camera preview, ${userName}`}
            className={cn(
              "absolute inset-0 h-full w-full object-cover -scale-x-100",
              !cameraLive && "invisible"
            )}
          />

          {cameraLive && session.canEnd && (
            <div className="pointer-events-none absolute inset-[12%_27%_15%] rounded-[48%] border border-dashed border-white/25" aria-hidden>
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium tracking-wide text-white/70">
                Keep face inside guide
              </span>
            </div>
          )}

          {!cameraLive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-dark-100/30 p-6 text-center">
              <Image
                src={profileImage || "/user-avatar.png"}
                alt=""
                width={110}
                height={110}
                className="size-[110px] rounded-full object-cover"
              />
              <div className="space-y-2">
                <p className="text-base font-semibold text-primary-100">
                  Camera preview unavailable
                </p>
                <p className="mx-auto max-w-md text-sm text-light-100">
                  {cameraFallbackLabel}
                </p>
              </div>
            </div>
          )}

          <div className="absolute left-4 right-4 top-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <span
              className={cn(
                "inline-flex max-w-fit items-center gap-2 rounded-full bg-dark-100/85 px-3 py-2 text-xs font-medium backdrop-blur-sm",
                {
                  speaking: "text-primary-200",
                  listening: "text-success-100",
                  working: "text-light-100",
                  idle: "text-light-100",
                  error: "text-destructive-100",
                }[tone]
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full bg-current",
                  tone === "speaking" && "animate-ping",
                  tone === "working" && "animate-breathe"
                )}
              />
              {status}
            </span>

            {timer.display && (
              <div
                data-testid="interview-clock"
                className={cn(
                  "rounded-lg bg-dark-100/85 px-3 py-2 font-mono text-base tabular-nums backdrop-blur-sm sm:text-lg",
                  endingSoon ? "text-destructive-100" : "text-primary-200"
                )}
                aria-live="off"
              >
                {timer.display}
                <span className="ml-2 font-sans text-xs text-light-100">
                  remaining
                </span>
              </div>
            )}
          </div>

          {attention.warningActive && (
            <div
              role="alert"
              className={cn(
                "proctor-warning absolute inset-x-4 top-20 px-4 py-3 sm:top-16 sm:max-w-xl",
                attention.view.severity === "CRITICAL" && "is-critical"
              )}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-black" aria-hidden>!</span>
                <div>
                  <p className="text-sm font-bold text-white">{attention.view.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-white/90">{attention.view.message}</p>
                </div>
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-dark-100/75 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="truncate text-sm text-light-100">{userName}</span>
            <div className="flex flex-wrap items-center gap-3 text-xs text-light-100">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    cameraLive ? "bg-success-100" : "bg-destructive-100"
                  )}
                />
                {cameraLive ? "Camera on" : "Camera off"}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 rounded-full transition-transform duration-150 ease-out",
                    media.micLive ? "bg-success-100" : "bg-destructive-100"
                  )}
                  style={
                    media.micLive
                      ? { transform: `scale(${1 + session.micLevel * 1.6})` }
                      : undefined
                  }
                />
                {media.micLive ? "Mic on" : "Mic off"}
              </span>
              <span className={cn(
                "rounded-full border px-2 py-1 text-[11px]",
                attention.warningActive
                  ? "border-destructive-100/60 bg-destructive-100/10 text-destructive-100"
                  : "border-primary-200/30 bg-primary-200/10 text-primary-100"
              )}>
                {attention.ready
                  ? attention.warningActive
                    ? `${attention.warningCount} warning${attention.warningCount === 1 ? "" : "s"}`
                    : "Strict monitor active"
                  : "Strict monitor loading"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {session.canEnd && (
        <div className="proctor-status-grid" aria-label="Live interview checks">
          <MonitorCheck
            label="Face detection"
            value={attention.view.faceStatus === "multiple" ? "Multiple detected" : attention.view.faceStatus === "not_detected" ? "Not detected" : "One face"}
            ok={attention.view.faceStatus === "detected"}
          />
          <MonitorCheck
            label="Eye contact"
            value={attention.view.attentionStatus === "ok" ? "Camera focused" : "Look at camera"}
            ok={attention.view.attentionStatus === "ok"}
          />
          <MonitorCheck
            label="Camera feed"
            value={attention.view.cameraStatus === "active" ? "Continuous" : "Interrupted"}
            ok={attention.view.cameraStatus === "active"}
          />
          <MonitorCheck
            label="Visibility"
            value={attention.view.poorQuality ? "Improve lighting" : "Clear"}
            ok={!attention.view.poorQuality}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-2xl border border-primary-200/35 bg-dark-200/70 p-4">
          <div className="flex items-start gap-4">
            <div className="relative flex size-14 shrink-0 items-center justify-center rounded-full blue-gradient">
              <Image
                src="/ai-avatar.png"
                alt=""
                width={40}
                height={34}
                className="object-cover"
              />
              {speaking && (
                <span className="absolute inline-flex size-5/6 animate-ping rounded-full bg-primary-200 opacity-75" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-lg text-primary-100">{interviewerName}</h3>
              <p className="text-sm text-light-100">AI interviewer · {role}</p>
              <p className="text-sm text-light-100/90">{statusHint}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary-200/35 bg-dark-200/70 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-primary-200">
            Live transcript
          </p>
          {lastLine ? (
            <p
              key={`${lastLine.timestamp}-${lastLine.text.slice(0, 24)}`}
              className="mt-3 animate-slide-in text-sm text-light-100"
            >
              <span className="mr-2 text-xs uppercase tracking-wide text-primary-200">
                {lastLine.speaker === "ai" ? interviewerName : "You"}
              </span>
              {lastLine.text}
            </p>
          ) : (
            <p className="mt-3 text-sm text-light-100/80">
              The latest question or answer will appear here once the conversation begins.
            </p>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {status}
      </p>

      {roomAlert && (
        <div
          className="rounded-2xl border border-destructive-100/50 bg-destructive-200/10 px-4 py-3 text-sm text-destructive-100"
          role="alert"
        >
          {roomAlert}
        </div>
      )}

      {confirmingEnd && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="end-interview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-100/80 p-4"
        >
          <div className="dark-gradient flex w-full max-w-md flex-col gap-4 rounded-2xl border border-primary-200/40 p-6">
            <h3 id="end-interview-title" className="text-primary-100">
              End this interview?
            </h3>
            <p className="text-sm text-light-100">
              Your answers so far will be saved and scored. You will not be able to
              continue this session afterwards.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                className="rounded-full bg-dark-200 px-5 py-2 text-sm text-light-100"
                onClick={() => setConfirmingEnd(false)}
              >
                Keep going
              </button>
              <button
                type="button"
                className="btn-disconnect"
                onClick={() => {
                  setConfirmingEnd(false);
                  void session.end("manual");
                }}
              >
                End interview
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        {showStartButton ? (
          <button
            type="button"
            className="relative btn-call"
            onClick={() => void session.start()}
            disabled={isBusy || startDisabled}
            aria-describedby={
              startDisabled && startDisabledReason ? "start-blocked" : undefined
            }
          >
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                !isBusy && "hidden"
              )}
            />
            <span className="relative">
              {isBusy ? "Starting..." : "Start interview"}
            </span>
          </button>
        ) : session.canEnd ? (
          <>
            <button
              type="button"
              className="rounded-full bg-dark-200 px-4 py-2 text-sm text-primary-200"
              onClick={media.toggleMic}
              aria-pressed={!media.micEnabled}
              aria-label={
                media.micEnabled ? "Mute your microphone" : "Unmute your microphone"
              }
            >
              {media.micEnabled ? "Mute mic" : "Unmute mic"}
            </button>
            {!media.cameraLive && (
              <button
                type="button"
                className="rounded-full bg-dark-200 px-4 py-2 text-sm text-primary-200"
                onClick={() => void media.retryCamera()}
              >
                Restore required camera
              </button>
            )}
            <span className="rounded-full border border-primary-200/20 bg-primary-200/5 px-4 py-2 text-xs font-medium text-primary-100">
              Camera required during interview
            </span>
            <button
              type="button"
              className="btn-disconnect"
              onClick={() => setConfirmingEnd(true)}
            >
              End interview
            </button>
          </>
        ) : (
          <p className="text-sm text-light-100">{status}</p>
        )}
      </div>

      {showStartButton && startDisabled && startDisabledReason && (
        <p id="start-blocked" className="text-center text-xs text-light-100">
          {startDisabledReason}
        </p>
      )}
    </div>
  );
};

export default InterviewRoom;

function MonitorCheck({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={cn("proctor-check", ok ? "is-ok" : "is-warning")}>
      <span className="proctor-check-dot" aria-hidden />
      <span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-light-100/60">{label}</span>
        <span className="mt-0.5 block text-xs font-semibold text-white">{value}</span>
      </span>
    </div>
  );
}
