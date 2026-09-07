"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  CircleAlert,
  Headphones,
  Mic2,
  Signal,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { InterviewAccess } from "@/lib/actions/plan.action";
import { createInterviewFromSetup } from "@/lib/actions/session.action";
import { DEFAULT_INTERVIEWER_ID } from "@/lib/interview-config";
import { SESSION_LENGTHS } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface Props {
  access: InterviewAccess | null;
  onCancel: () => void;
}

type PracticeMode = "english" | "communication";
type MediaState = "requesting" | "ready" | "error";
type MicState = "unchecked" | "testing" | "passed" | "failed";

const MODES: Array<{
  id: PracticeMode;
  title: string;
  description: string;
  topics: string[];
}> = [
  {
    id: "english",
    title: "English Speaking Practice",
    description: "Practice real-time English conversations and speak with confidence.",
    topics: ["English conversation", "Fluency", "Grammar", "Vocabulary"],
  },
  {
    id: "communication",
    title: "Communication Skill Practice",
    description: "Improve communication skills, fluency, grammar, and vocabulary.",
    topics: ["Professional communication", "Clarity", "Answer structure", "Confidence"],
  },
];

const LEVELS = [
  { id: "entry", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "senior", label: "Advanced" },
] as const;

const TEST_PHRASE = "I'm ready for my BrihatX interview — testing one, two, three.";

export default function CommunicationPracticeSetup({ access, onCancel }: Props) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const testGenerationRef = useRef(0);

  const [mode, setMode] = useState<PracticeMode>("english");
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("entry");
  const [duration, setDuration] = useState(5);
  const [topic, setTopic] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mediaState, setMediaState] = useState<MediaState>("requesting");
  const [mediaError, setMediaError] = useState("");
  const [micState, setMicState] = useState<MicState>("unchecked");
  const [micLevel, setMicLevel] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const allowedMinutes = access?.allowedMinutes ?? [5];

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => undefined);
    }
  }, []);

  const requestMedia = useCallback(async (): Promise<MediaStream | null> => {
    const current = streamRef.current;
    if (current?.getVideoTracks().some((track) => track.readyState === "live") &&
        current.getAudioTracks().some((track) => track.readyState === "live")) {
      attachStream(current);
      return current;
    }

    setMediaState("requesting");
    setMediaError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      attachStream(stream);
      setMediaState("ready");
      return stream;
    } catch {
      setMediaState("error");
      setMediaError("Allow camera and microphone access in your browser, then try again.");
      return null;
    }
  }, [attachStream]);

  useEffect(() => {
    void requestMedia();
    return () => {
      testGenerationRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [requestMedia]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [mediaState]);

  const testMicrophone = async () => {
    if (micState === "testing") return;
    const stream = await requestMedia();
    if (!stream) return;

    const generation = ++testGenerationRef.current;
    setMicState("testing");
    setMicLevel(0);
    const AudioContextClass = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setMicState("failed");
      return;
    }

    const context = new AudioContextClass();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const startedAt = performance.now();
    let peak = 0;

    await new Promise<void>((resolve) => {
      const sample = () => {
        if (generation !== testGenerationRef.current) return resolve();
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const value of samples) {
          const normalized = (value - 128) / 128;
          energy += normalized * normalized;
        }
        const rms = Math.sqrt(energy / samples.length);
        peak = Math.max(peak, rms);
        setMicLevel(Math.min(1, rms * 9));
        if (performance.now() - startedAt >= 4_000) return resolve();
        requestAnimationFrame(sample);
      };
      sample();
    });

    source.disconnect();
    analyser.disconnect();
    await context.close();
    if (generation !== testGenerationRef.current) return;
    setMicLevel(0);
    setMicState(peak >= 0.025 ? "passed" : "failed");
  };

  const selectedMode = MODES.find((option) => option.id === mode)!;
  const canSubmit = mediaState === "ready" && micState === "passed" && termsAccepted && !submitting;

  const startPractice = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const topics = [...selectedMode.topics];
    if (topic.trim()) topics.unshift(topic.trim());
    try {
      const result = await createInterviewFromSetup({
        interviewType: "communication",
        role: selectedMode.title,
        topics: topics.slice(0, 6),
        experienceLevel: level,
        interviewerId: DEFAULT_INTERVIEWER_ID,
        durationMinutes: duration,
        termsAccepted,
      });
      if (!result.success || !result.interviewId) {
        toast.error(result.message ?? "Could not prepare this practice session.");
        return;
      }
      toast.success("Your communication practice is ready.");
      router.push(`/interview/${result.interviewId}`);
    } catch {
      toast.error("Unable to start practice. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="communication-options animate-slide-in" aria-labelledby="communication-options-title">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary-200">
            <span className="size-2 animate-pulse rounded-full bg-primary-200" /> Live setup
          </span>
          <h2 id="communication-options-title" className="mt-2 text-2xl text-white">Select Options</h2>
          <p className="mt-1 text-sm text-light-100">Personalize your speaking session and verify your setup.</p>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close communication setup" className="flex size-11 items-center justify-center rounded-full border border-white/10 text-light-100 hover:bg-white/[0.06]">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-7">
          <div className="grid gap-3 md:grid-cols-2">
            {MODES.map((option) => {
              const selected = option.id === mode;
              return (
                <button key={option.id} type="button" aria-pressed={selected} onClick={() => setMode(option.id)} className={cn("communication-mode-card", selected && "is-selected")}>
                  <span className="flex items-start justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-primary-200/10 text-primary-200"><Volume2 className="size-5" /></span>
                    <span className={cn("flex size-6 items-center justify-center rounded-full border", selected ? "border-primary-200 bg-primary-200 text-dark-100" : "border-white/15 text-transparent")}><Check className="size-3.5" /></span>
                  </span>
                  <span className="mt-5 block text-base font-semibold text-white">{option.title}</span>
                  <span className="mt-2 block text-left text-sm leading-6 text-light-100/75">{option.description}</span>
                </button>
              );
            })}
          </div>

          <OptionGroup title="Experience Level" required help="Controls vocabulary, pace, and how demanding follow-up questions are.">
            <div className="grid grid-cols-3 gap-2">
              {LEVELS.map((option) => (
                <ChoiceButton key={option.id} selected={level === option.id} onClick={() => setLevel(option.id)}>{option.label}</ChoiceButton>
              ))}
            </div>
          </OptionGroup>

          <OptionGroup title="Interview Duration" required help="Longer sessions need an eligible plan.">
            <div className="grid grid-cols-3 gap-2">
              {SESSION_LENGTHS.map((minutes) => {
                const permitted = allowedMinutes.includes(minutes);
                return (
                  <ChoiceButton key={minutes} selected={duration === minutes} disabled={!permitted} onClick={() => permitted && setDuration(minutes)}>
                    {minutes} mins{!permitted && <span className="block text-[9px] opacity-60">Locked</span>}
                  </ChoiceButton>
                );
              })}
            </div>
          </OptionGroup>

          <OptionGroup title="Enter Topic" help="Optional — leave blank for a varied conversation.">
            <input value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={80} placeholder="e.g. Workplace conversation, public speaking" className="min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white placeholder:text-light-100/40 focus:border-primary-200/60 focus:outline-none" />
          </OptionGroup>

          <div className="rounded-2xl border border-primary-200/15 bg-primary-200/[0.04] p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-200">Mic verification</p>
                <h3 className="mt-2 text-xl text-white">Ready to test your microphone?</h3>
                <p className="mt-3 text-sm italic leading-6 text-light-100">“{TEST_PHRASE}”</p>
              </div>
              <button type="button" onClick={() => void testMicrophone()} disabled={micState === "testing"} className="btn-primary shrink-0 px-6 text-sm disabled:opacity-50">
                <Mic2 className="size-4" /> {micState === "testing" ? "Listening…" : micState === "passed" ? "Test again" : "Test my mic"}
              </button>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-primary-200 to-[#00c9f2] transition-[width]" style={{ width: `${micState === "passed" ? 100 : micLevel * 100}%` }} /></div>
            <p className={cn("mt-3 flex items-center gap-2 text-xs", micState === "passed" ? "text-success-100" : micState === "failed" ? "text-destructive-100" : "text-light-100/65")} aria-live="polite">
              {micState === "passed" ? <><Check className="size-4" /> Microphone verified</> : micState === "failed" ? <><CircleAlert className="size-4" /> No clear voice detected. Speak louder and test again.</> : micState === "testing" ? "Speak the phrase now…" : "Mic not checked"}
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
            <div className="relative aspect-video bg-[#020708]">
              <video ref={videoRef} autoPlay playsInline muted className={cn("absolute inset-0 h-full w-full -scale-x-100 object-cover", mediaState !== "ready" && "invisible")} aria-label="Live camera preview" />
              {mediaState !== "ready" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center"><Camera className="size-8 text-light-100/45" /><p className="text-xs text-light-100">{mediaState === "requesting" ? "Requesting camera access…" : mediaError}</p></div>}
              <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"><span className={cn("size-2 rounded-full", mediaState === "ready" ? "bg-primary-200" : "bg-destructive-100")} /> Live</span>
            </div>
            <div className="grid grid-cols-2 border-t border-white/10 text-[11px] font-semibold">
              <span className={cn("flex items-center gap-2 border-r border-white/10 p-3", mediaState === "ready" ? "text-success-100" : "text-destructive-100")}><Camera className="size-3.5" />{mediaState === "ready" ? "Camera working" : "Camera blocked"}</span>
              <span className={cn("flex items-center gap-2 p-3", micState === "passed" ? "text-success-100" : "text-light-100/65")}><Mic2 className="size-3.5" />{micState === "passed" ? "Mic verified" : "Mic not checked"}</span>
            </div>
            {mediaState === "error" && <button type="button" onClick={() => void requestMedia()} className="m-3 mt-0 w-[calc(100%-1.5rem)] rounded-xl border border-primary-200/30 px-3 py-2 text-xs font-semibold text-primary-200">Try camera again</button>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg text-white">Before you begin</h3>
              <Sparkles className="size-5 text-primary-200" />
            </div>
            <ul className="mt-4 space-y-3">
              <ReadyItem icon={<Headphones />} title="Find a quiet spot" text="No background noise" />
              <ReadyItem icon={<Signal />} title="Check your internet" text="Stay connected" />
              <ReadyItem icon={<Camera />} title="Stay in frame" text="One clearly visible face" />
            </ul>
          </div>

          <div className="rounded-2xl border border-primary-200/20 bg-primary-200/[0.06] p-4 text-center">
            <p className="text-2xl font-bold text-white">{access?.limit === null ? "∞" : access?.remaining ?? "—"}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-200">Interviews remaining</p>
          </div>
        </aside>
      </div>

      <div className="border-t border-white/10 pt-5">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-light-100">
          <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-primary-200" />
          <span>I agree with the <Link href="/terms-and-conditions" target="_blank" rel="noreferrer" className="font-semibold text-primary-200 underline underline-offset-4">Terms and Conditions</Link>.</span>
        </label>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-full border border-white/15 px-6 text-sm font-semibold text-light-100 hover:bg-white/[0.05]">Cancel</button>
          <button type="button" onClick={() => void startPractice()} disabled={!canSubmit} className="btn-primary min-w-48 justify-center text-sm disabled:cursor-not-allowed disabled:opacity-45">
            {submitting ? "Preparing…" : "Start Practicing"}
          </button>
        </div>
        {!canSubmit && <p className="mt-3 text-right text-xs text-light-100/60" aria-live="polite">Camera access, microphone verification, and terms acceptance are required.</p>}
      </div>
    </section>
  );
}

function OptionGroup({ title, required = false, help, children }: { title: string; required?: boolean; help: string; children: React.ReactNode }) {
  return <fieldset><legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">{title}{required && <span className="text-primary-200">*</span>}<span title={help} aria-label={help} className="flex size-5 cursor-help items-center justify-center rounded-full border border-white/15 text-[10px] text-light-100">?</span></legend>{children}</fieldset>;
}

function ChoiceButton({ selected, disabled = false, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={selected} disabled={disabled} onClick={onClick} className={cn("min-h-12 rounded-xl border px-3 text-sm font-semibold transition-colors", selected ? "border-primary-200 bg-primary-200 text-dark-100" : "border-white/10 bg-white/[0.035] text-light-100 hover:border-primary-200/30", disabled && "cursor-not-allowed opacity-35")}>{children}</button>;
}

function ReadyItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <li className="flex items-center gap-3 rounded-xl bg-black/20 p-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-200/10 text-primary-200 [&_svg]:size-4">{icon}</span><span><span className="block text-xs font-semibold text-white">{title}</span><span className="mt-0.5 block text-[11px] text-light-100/60">{text}</span></span></li>;
}
