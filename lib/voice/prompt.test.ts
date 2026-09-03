import { describe, expect, it } from "vitest";

import { getInterviewer } from "@/lib/interview-config";
import {
  buildOpeningTurn,
  buildSystemInstruction,
  buildWrapUpNote,
  describeDuration,
} from "@/lib/voice/prompt";

const config = {
  candidateName: "Priya",
  role: "Software Engineer",
  topics: ["Data Structures & Algorithms", "System Design"],
  experienceLevel: "intermediate",
  interviewerId: "tanya",
  durationSeconds: 600,
};

describe("buildSystemInstruction", () => {
  it("carries every part of the setup into the prompt", () => {
    const prompt = buildSystemInstruction(config);
    expect(prompt).toContain("Priya");
    expect(prompt).toContain("Software Engineer");
    expect(prompt).toContain("Data Structures & Algorithms");
    expect(prompt).toContain("System Design");
    expect(prompt).toContain("Intermediate");
    expect(prompt).toContain(getInterviewer("tanya").name);
  });

  it("states the interview length in the prompt", () => {
    expect(buildSystemInstruction(config)).toContain("10 minutes");
  });

  /**
   * The behaviour this product is built around: the clock ends the interview,
   * never the length of a list. These assertions exist because a prompt that
   * quietly reads as a to-do list produces a question-count-based interview no
   * matter what the timer does.
   */
  it("frames the topics as a guide rather than a queue to finish", () => {
    const prompt = buildSystemInstruction(config);
    expect(prompt).toMatch(/guide, not a queue/i);
    expect(prompt).toMatch(/TIME-BASED/);
    expect(prompt).toMatch(/does NOT end when you run out of listed topics/i);
  });

  it("forbids the model from ending the session itself", () => {
    const prompt = buildSystemInstruction(config);
    expect(prompt).toMatch(/cannot end this session/i);
    expect(prompt).toMatch(/never try to/i);
  });

  it("asks for one question at a time and for follow-ups", () => {
    const prompt = buildSystemInstruction(config);
    expect(prompt).toMatch(/ONE question at a time/);
    expect(prompt).toMatch(/follow-up/i);
  });

  it("tells the interviewer not to coach during the interview", () => {
    expect(buildSystemInstruction(config)).toMatch(/do NOT give the candidate the answers/i);
  });

  it("adapts the guidance to the experience level", () => {
    const entry = buildSystemInstruction({ ...config, experienceLevel: "entry" });
    const senior = buildSystemInstruction({ ...config, experienceLevel: "senior" });
    expect(entry).toContain("Entry level");
    expect(senior).toContain("Senior");
    expect(entry).not.toBe(senior);
  });

  it("falls back to a sensible interviewer and level for unknown ids", () => {
    const prompt = buildSystemInstruction({
      ...config,
      interviewerId: "nobody",
      experienceLevel: "unknown",
    });
    expect(prompt).toContain("Tanya");
    expect(prompt).toContain("Intermediate");
  });

  it("still produces a usable prompt with no topics selected", () => {
    const prompt = buildSystemInstruction({ ...config, topics: [] });
    expect(prompt).toContain("General questions appropriate to the role");
  });
});

describe("describeDuration", () => {
  it("uses minutes for real interview lengths", () => {
    expect(describeDuration(300)).toBe("5 minutes");
    expect(describeDuration(900)).toBe("15 minutes");
    expect(describeDuration(60)).toBe("1 minute");
  });

  it("uses seconds for the short development sessions", () => {
    expect(describeDuration(20)).toBe("20 seconds");
  });
});

describe("buildWrapUpNote", () => {
  it("tells the interviewer to land the conversation without hanging up", () => {
    const note = buildWrapUpNote(30);
    expect(note).toMatch(/do not start a new topic/i);
    expect(note).toMatch(/do NOT say goodbye yet/i);
    expect(note).toContain("30 seconds");
  });

  it("never reports a nonsensical remaining time", () => {
    expect(buildWrapUpNote(0)).toContain("5 seconds");
    expect(buildWrapUpNote(-10)).toContain("5 seconds");
  });
});

describe("buildOpeningTurn", () => {
  it("asks for a greeting and the first question", () => {
    const turn = buildOpeningTurn("Priya", "Backend Developer");
    expect(turn).toContain("Priya");
    expect(turn).toContain("Backend Developer");
    expect(turn).toMatch(/ask your first question/i);
  });
});

// ---------------------------------------------------------------------------
// Visa and communication instructions
// ---------------------------------------------------------------------------

import {
  buildCommunicationInstruction,
  buildInterviewInstruction,
  buildVisaInstruction,
} from "@/lib/voice/prompt";

const visaConfig = {
  candidateName: "Arjun",
  visaTypeLabel: "F1 Student Visa",
  visaFocus: "Whether the study plan is genuine and affordable.",
  modeBehaviour: "Brisk and businesslike. You cut off long answers.",
  allowsCoaching: false,
  destination: "United States",
  details: { university: "Arizona State University", sponsor: "My father" },
  topics: ["Purpose of travel", "Finances and sponsorship"],
  durationSeconds: 300,
};

describe("buildVisaInstruction", () => {
  it("carries the application details into the prompt", () => {
    const prompt = buildVisaInstruction(visaConfig);
    expect(prompt).toContain("F1 Student Visa");
    expect(prompt).toContain("United States");
    expect(prompt).toContain("Arizona State University");
    expect(prompt).toContain("Arjun");
    expect(prompt).toContain(visaConfig.visaFocus);
    expect(prompt).toContain(visaConfig.modeBehaviour);
  });

  /**
   * The product's central safety rule. A mock tool telling someone their real
   * visa application will fail is both worthless and harmful, so the instruction
   * has to forbid a verdict outright -- while still allowing the officer to be
   * genuinely demanding, which is the whole point of practising.
   */
  it("forbids predicting a real visa outcome, in several forms", () => {
    const prompt = buildVisaInstruction(visaConfig);
    expect(prompt).toMatch(/PRACTICE SIMULATION/);
    expect(prompt).toMatch(/NEVER say or imply that the candidate would be approved/i);
    expect(prompt).toMatch(/no simulation can predict a real decision/i);
    expect(prompt).toMatch(/not a real officer/i);
    expect(prompt).toMatch(/never issue a decision, verdict, score or probability/i);
  });

  it("still instructs the officer to probe hard", () => {
    const prompt = buildVisaInstruction(visaConfig);
    expect(prompt).toMatch(/vague answers/i);
    expect(prompt).toMatch(/memorised/i);
    expect(prompt).toMatch(/inconsistency|contradict/i);
    expect(prompt).toMatch(/unclear finances/i);
  });

  it("never asks the candidate for real identifying details", () => {
    expect(buildVisaInstruction(visaConfig)).toMatch(
      /never ask for passport numbers/i
    );
  });

  it("suppresses coaching unless the mode allows it", () => {
    expect(buildVisaInstruction(visaConfig)).toMatch(/NO COACHING DURING THIS SESSION/);
    expect(
      buildVisaInstruction({ ...visaConfig, allowsCoaching: true })
    ).toMatch(/COACHING IS ENABLED/);
  });

  it("tells the officer to establish missing background rather than assume it", () => {
    const prompt = buildVisaInstruction({ ...visaConfig, details: {} });
    expect(prompt).toMatch(/did not supply background details/i);
  });

  it("is time-based, not question-count based", () => {
    const prompt = buildVisaInstruction(visaConfig);
    expect(prompt).toContain("5 minutes");
    expect(prompt).toMatch(/does not end when you run out of topics/i);
  });
});

describe("buildCommunicationInstruction", () => {
  const communicationConfig = {
    candidateName: "Sam",
    role: "Product Manager",
    topics: ["Explaining technical ideas", "Handling difficult questions"],
    experienceLevel: "intermediate",
    interviewerId: "aisha",
    durationSeconds: 600,
  };

  it("focuses on delivery rather than technical depth", () => {
    const prompt = buildCommunicationInstruction(communicationConfig);
    expect(prompt).toMatch(/HOW the candidate communicates/);
    expect(prompt).toContain("Product Manager");
    expect(prompt).toContain("10 minutes");
  });

  it("copes with no field named", () => {
    const prompt = buildCommunicationInstruction({ ...communicationConfig, role: undefined });
    expect(prompt).toMatch(/not named a specific field/i);
  });

  it("does not coach mid-session", () => {
    expect(buildCommunicationInstruction(communicationConfig)).toMatch(
      /do NOT coach them mid-answer/i
    );
  });
});

describe("buildInterviewInstruction", () => {
  it("dispatches to the right builder for each type", () => {
    expect(
      buildInterviewInstruction({ type: "visa", ...visaConfig })
    ).toBe(buildVisaInstruction(visaConfig));

    expect(buildInterviewInstruction({ type: "technical", ...config })).toBe(
      buildSystemInstruction(config)
    );
  });

  it("appends the universal rules to every type", () => {
    const types = [
      buildInterviewInstruction({ type: "visa", ...visaConfig }),
      buildInterviewInstruction({ type: "technical", ...config }),
      buildInterviewInstruction({
        type: "communication",
        candidateName: "Sam",
        topics: [],
        experienceLevel: "intermediate",
        interviewerId: "tanya",
        durationSeconds: 300,
      }),
    ];
    for (const prompt of types) {
      expect(prompt).toMatch(/UNIVERSAL RULES/);
      expect(prompt).toMatch(/TIME-BASED/);
      expect(prompt).toMatch(/never when you run out of questions/i);
    }
  });
});

describe("buildOpeningTurn per type", () => {
  it("opens a visa interview as an officer would", () => {
    const turn = buildOpeningTurn("Arjun", "F1 Student Visa", "visa");
    expect(turn).toMatch(/applicant/i);
    expect(turn).toMatch(/purpose of their travel/i);
  });

  it("opens a communication session as practice", () => {
    expect(buildOpeningTurn("Sam", "", "communication")).toMatch(
      /communication practice/i
    );
  });
});
