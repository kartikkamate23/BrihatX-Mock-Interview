interface Feedback {
  id: string;
  interviewId: string;
  /** Absent on older records, which were all technical interviews. */
  interviewType?: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  /** Present on newly generated feedback; older reports predate this feature. */
  questionReviews?: QuestionReview[];
  createdAt: string;
  /** Present only on visa interview feedback. */
  visa?: VisaFeedbackDetail;
  /** Present only on resume interview feedback. */
  resume?: ResumeFeedbackDetail;
  session?: InterviewSessionMeta;
  attention?: InterviewAttentionSummary;
}

interface QuestionReview {
  question: string;
  candidateAnswer: string;
  score: number;
  whatWasGood: string[];
  mistakes: string[];
  howToImprove: string[];
  improvedAnswer: string;
}

/**
 * The extra detail a visa practice report carries.
 *
 * There is deliberately no outcome, decision, or likelihood field: the product
 * must never claim to predict what a real consular officer would do.
 */
interface VisaFeedbackDetail {
  strongAnswers: { question: string; note: string }[];
  weakAnswers: { question: string; note: string }[];
  tooLongAnswers: { question: string; note: string }[];
  tooVagueAnswers: { question: string; note: string }[];
  contradictions: string[];
  struggledWith: string[];
  suggestedAnswers: { question: string; suggestion: string }[];
  practiceAreas: string[];
  readiness: string;
  nextRecommendation: string;
}

interface Interview {
  id: string;
  role: string;
  level: string;
  questions: string[];
  techstack: string[];
  createdAt: string;
  userId: string;
  type: string;
  finalized: boolean;
  /** Set by the setup wizard. Absent on interviews created before it existed. */
  topics?: string[];
  levelLabel?: string;
  interviewerId?: string;
  interviewerName?: string;
  /** The length chosen at creation. The plan still clamps it at start time. */
  durationSeconds?: number;
  status?: string;
  /** "technical" | "communication" | "visa". Absent means technical. */
  interviewType?: string;
  /** Stable id from the role taxonomy, for filtering and the card icon. */
  roleCategory?: string;
  /** Stable catalogue id. Absent when the candidate typed a custom role. */
  roleId?: string;
  roleSubcategory?: string;
  /** Resolved once at creation so the icon never depends on a later taxonomy. */
  iconKey?: string;
  /** Visa interviews only. */
  visaType?: string;
  visaTypeLabel?: string;
  visaMode?: string;
  destination?: string;
  visaDetails?: Record<string, string>;
  /** Resume interviews only. The profile itself lives in `resumes/{resumeId}`. */
  resumeId?: string;
  resumeFileName?: string;
}

interface CreateFeedbackParams {
  /** Exact session being scored; used for the atomic single-scoring claim. */
  sessionId: string;
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string;
  /** Absent on records predating interview types; treated as "technical". */
  interviewType?: string;
  /** Context the scorer needs but the transcript does not carry. */
  context?: {
    role?: string;
    topics?: string[];
    visaTypeLabel?: string;
    visaModeLabel?: string;
    destination?: string;
    resumeSummary?: string;
  };
  /** Session metadata. Optional so records written before timing existed still load. */
  session?: InterviewSessionMeta;
  /** Interview-attention observations. Counts and durations only, never imagery. */
  attention?: InterviewAttentionSummary;
}

interface InterviewAttentionSummary {
  warnings: number;
  events: InterviewAttentionEvent[];
}

/** Counts and durations only. No imagery, and no frame ever leaves the browser. */
interface InterviewAttentionEvent {
  type: "attention_warning";
  /** ms since the interview started. */
  startedAt: number;
  duration: number | null;
  resolvedAt: number | null;
}

/** The extra detail a resume interview report carries. */
interface ResumeFeedbackDetail {
  strongAnswers: { question: string; note: string }[];
  weakAnswers: { question: string; note: string }[];
  missedOpportunities: string[];
  suggestedAnswers: { question: string; suggestion: string }[];
  studyTopics: string[];
  resumeRecommendations: string[];
  targetRoleGap: string;
}

/** One line of a saved interview transcript. */
interface InterviewTranscriptLine {
  speaker: "ai" | "user";
  text: string;
  /** Epoch milliseconds. */
  timestamp: number;
}

interface InterviewSessionMeta {
  /** The length the candidate selected, in seconds. */
  durationSeconds: number;
  /** How long the call actually ran, in seconds. */
  elapsedSeconds: number;
  startedAt: string;
  endedAt: string;
  /** True when the session ran to its deadline rather than being ended early. */
  completedFullDuration: boolean;
}

interface User {
  name: string;
  email: string;
  id: string;
  /** Optional avatar stored on the user document; absent for accounts created
   *  before profile images were captured, so always render a fallback. */
  profileURL?: string;
  resumeURL?: string;
  /** Subscription tier. Absent means the free Starter plan. */
  plan?: "starter" | "accelerator" | "pro" | "mastery";
}

interface InterviewCardProps {
  interviewId: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
  /** Absent on records predating interview types; treated as technical. */
  interviewType?: string;
  roleCategory?: string;
  iconKey?: string;
  visaTypeLabel?: string;
  resumeFileName?: string;
  /** Feedback is resolved by the list, not per card: one query beats N. */
  score?: number;
  finalAssessment?: string;
  feedbackCreatedAt?: string;
  hasFeedback?: boolean;
  durationSeconds?: number;
  elapsedSeconds?: number;
  status?: string;
  questionsAnswered?: number;
}

/** An interview plus its resolved feedback, as the dashboard list renders it. */
interface InterviewSummary {
  id: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
  interviewType?: string;
  roleCategory?: string;
  iconKey?: string;
  visaTypeLabel?: string;
  resumeFileName?: string;
  score?: number;
  finalAssessment?: string;
  feedbackCreatedAt?: string;
  hasFeedback: boolean;
  durationSeconds?: number;
  elapsedSeconds?: number;
  status?: string;
  questionsAnswered?: number;
  categoryScores?: Feedback["categoryScores"];
}

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

interface SignInParams {
  email: string;
  idToken: string;
}

interface SignUpParams {
  name: string;
  idToken: string;
}

type FormType = "sign-in" | "sign-up";

interface InterviewFormProps {
  interviewId: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  amount: number;
}

interface TechIconProps {
  techStack: string[];
}
