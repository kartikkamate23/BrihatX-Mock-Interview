import { describe, expect, it } from "vitest";

import {
  buildResumeExtractionPrompt,
  buildResumeInterviewInstruction,
  describeResumeProfile,
  normaliseResumeProfile,
  resumeProfileSchema,
  type ResumeInterviewPromptConfig,
  type ResumeProfile,
} from "@/lib/resume/profile";

const fullProfile: ResumeProfile = resumeProfileSchema.parse({
  name: "Priya Nair",
  headline: "Frontend Developer",
  summary: "Three years building customer-facing React applications.",
  skills: ["React", "TypeScript", "Accessibility"],
  technologies: ["Next.js", "PostgreSQL"],
  roles: [
    {
      title: "Frontend Developer",
      company: "Zeta Labs",
      duration: "2022 - present",
      highlights: ["Rebuilt the checkout flow", "Optimised the database"],
    },
  ],
  projects: [
    {
      name: "Nimbus Scheduler",
      description: "A shift planner for small clinics",
      technologies: ["React", "Firebase"],
    },
  ],
  education: [
    { degree: "BSc Computer Science", institution: "Pune University", year: "2021" },
  ],
  certifications: ["AWS Cloud Practitioner"],
  achievements: ["Winner, Zeta internal hackathon"],
  domains: ["Healthcare"],
  yearsOfExperience: 3,
  currentRole: "Frontend Developer",
});

const emptyProfile: ResumeProfile = resumeProfileSchema.parse({});

const config: ResumeInterviewPromptConfig = {
  candidateName: "Priya",
  profile: fullProfile,
  targetRole: "AI Engineer",
  experienceLevel: "Intermediate",
  interviewerName: "Tanya",
  interviewerStyle: "Warm but rigorous.",
  interviewerTitle: "Senior Engineering Manager",
  topics: ["System Design", "React"],
  durationSeconds: 900,
};

/**
 * The schema exists to survive real CVs, not to police them. These tests are the
 * guard against someone later "tightening" a field and breaking uploads for
 * every candidate whose resume happens to omit that section.
 */
describe("resumeProfileSchema", () => {
  it("parses a complete profile without losing anything", () => {
    expect(fullProfile.name).toBe("Priya Nair");
    expect(fullProfile.skills).toEqual(["React", "TypeScript", "Accessibility"]);
    expect(fullProfile.roles[0].company).toBe("Zeta Labs");
    expect(fullProfile.projects[0].technologies).toEqual(["React", "Firebase"]);
    expect(fullProfile.yearsOfExperience).toBe(3);
  });

  it("parses an entirely empty object into defaults rather than failing", () => {
    expect(emptyProfile).toEqual({
      name: null,
      headline: null,
      summary: null,
      skills: [],
      technologies: [],
      roles: [],
      projects: [],
      education: [],
      certifications: [],
      achievements: [],
      domains: [],
      yearsOfExperience: null,
      currentRole: null,
    });
  });

  it("never throws on a sparse resume that has only one section", () => {
    const parsed = resumeProfileSchema.parse({ skills: ["Figma"] });
    expect(parsed.skills).toEqual(["Figma"]);
    expect(parsed.roles).toEqual([]);
    expect(parsed.currentRole).toBeNull();
  });

  it("fills in defaults inside role, project and education entries too", () => {
    const parsed = resumeProfileSchema.parse({
      roles: [{ company: "Zeta Labs" }],
      projects: [{ name: "Nimbus" }],
      education: [{ degree: "BSc" }],
    });
    expect(parsed.roles[0]).toEqual({
      title: null,
      company: "Zeta Labs",
      duration: null,
      highlights: [],
    });
    expect(parsed.projects[0].technologies).toEqual([]);
    expect(parsed.education[0].institution).toBeNull();
  });

  it("accepts explicit nulls for every scalar", () => {
    const parsed = resumeProfileSchema.parse({
      name: null,
      headline: null,
      summary: null,
      yearsOfExperience: null,
      currentRole: null,
    });
    expect(parsed.name).toBeNull();
    expect(parsed.yearsOfExperience).toBeNull();
  });

  it("still rejects values of the wrong type", () => {
    expect(() => resumeProfileSchema.parse({ skills: "React" })).toThrow();
    expect(() => resumeProfileSchema.parse({ roles: "Zeta Labs" })).toThrow();
    expect(() => resumeProfileSchema.parse({ yearsOfExperience: "three" })).toThrow();
  });
});

describe("normaliseResumeProfile", () => {
  it("trims and collapses whitespace in scalars and lists", () => {
    const clean = normaliseResumeProfile(
      resumeProfileSchema.parse({
        name: "  Priya   Nair ",
        currentRole: " Frontend  Developer ",
        skills: ["  React ", "TypeScript "],
      })
    );
    expect(clean.name).toBe("Priya Nair");
    expect(clean.currentRole).toBe("Frontend Developer");
    expect(clean.skills).toEqual(["React", "TypeScript"]);
  });

  it("turns blank scalars into null and drops blank list entries", () => {
    const clean = normaliseResumeProfile(
      resumeProfileSchema.parse({
        headline: "   ",
        skills: ["React", "", "   ", "Vue"],
      })
    );
    expect(clean.headline).toBeNull();
    expect(clean.skills).toEqual(["React", "Vue"]);
  });

  it("de-duplicates skills case-insensitively, keeping the first spelling", () => {
    const clean = normaliseResumeProfile(
      resumeProfileSchema.parse({
        skills: ["React", "react", "REACT", "Node.js"],
        technologies: ["Next.js", "NEXT.JS"],
      })
    );
    expect(clean.skills).toEqual(["React", "Node.js"]);
    expect(clean.technologies).toEqual(["Next.js"]);
  });

  /**
   * A profile is pasted into a system instruction, so an unbounded list is
   * prompt budget spent on noise. The caps are generous; the point is only that
   * they exist.
   */
  it("caps oversized arrays", () => {
    const clean = normaliseResumeProfile(
      resumeProfileSchema.parse({
        skills: Array.from({ length: 90 }, (_, i) => `Skill ${i}`),
        roles: Array.from({ length: 30 }, (_, i) => ({ title: `Role ${i}` })),
        projects: Array.from({ length: 30 }, (_, i) => ({ name: `Project ${i}` })),
      })
    );
    expect(clean.skills).toHaveLength(40);
    expect(clean.roles).toHaveLength(12);
    expect(clean.projects).toHaveLength(12);
  });

  it("drops entries that carry no information at all", () => {
    const clean = normaliseResumeProfile(
      resumeProfileSchema.parse({
        roles: [{}, { title: "  " }, { company: "Zeta Labs" }],
        projects: [{}, { name: "Nimbus Scheduler" }],
        education: [{}, { degree: "BSc" }],
      })
    );
    expect(clean.roles).toEqual([
      { title: null, company: "Zeta Labs", duration: null, highlights: [] },
    ]);
    expect(clean.projects).toHaveLength(1);
    expect(clean.education).toHaveLength(1);
  });

  it("keeps years of experience sane and drops nonsense", () => {
    const round = normaliseResumeProfile(
      resumeProfileSchema.parse({ yearsOfExperience: 3.4 })
    );
    const negative = normaliseResumeProfile(
      resumeProfileSchema.parse({ yearsOfExperience: -2 })
    );
    const absurd = normaliseResumeProfile(
      resumeProfileSchema.parse({ yearsOfExperience: 400 })
    );
    expect(round.yearsOfExperience).toBe(3);
    expect(negative.yearsOfExperience).toBeNull();
    expect(absurd.yearsOfExperience).toBe(60);
  });

  it("leaves an already-empty profile empty rather than inventing shape", () => {
    expect(normaliseResumeProfile(emptyProfile)).toEqual(emptyProfile);
  });
});

describe("buildResumeExtractionPrompt", () => {
  it("embeds the resume text it was given", () => {
    const prompt = buildResumeExtractionPrompt(
      "  Priya Nair\nFrontend Developer at Zeta Labs  "
    );
    expect(prompt).toContain("Priya Nair");
    expect(prompt).toContain("Frontend Developer at Zeta Labs");
  });

  /**
   * The reason this matters: a fabricated project becomes an interviewer asking
   * the candidate, live, to walk through work they never did.
   */
  it("forbids inventing anything and asks for empty arrays instead", () => {
    const prompt = buildResumeExtractionPrompt("Some resume");
    expect(prompt).toMatch(/never invent/i);
    expect(prompt).toMatch(/do NOT infer/i);
    expect(prompt).toMatch(/empty array/i);
    expect(prompt).toMatch(/null/);
  });

  it("asks for technology names to be copied verbatim", () => {
    expect(buildResumeExtractionPrompt("Some resume")).toMatch(/verbatim/i);
  });
});

describe("buildResumeInterviewInstruction", () => {
  const prompt = buildResumeInterviewInstruction(config);

  it("names the candidate, the interviewer and the target role", () => {
    expect(prompt).toContain("Priya");
    expect(prompt).toContain("Tanya");
    expect(prompt).toContain("Senior Engineering Manager");
    expect(prompt).toContain("AI Engineer");
  });

  it("hands over the actual employers, projects, skills and education", () => {
    expect(prompt).toContain("Zeta Labs");
    expect(prompt).toContain("Nimbus Scheduler");
    expect(prompt).toContain("TypeScript");
    expect(prompt).toContain("Pune University");
    expect(prompt).toContain("Rebuilt the checkout flow");
  });

  it("insists on resume-specific questions over generic ones", () => {
    expect(prompt).toMatch(/BY NAME/);
    expect(prompt).toMatch(/never ask a generic question/i);
    expect(prompt).toMatch(/open by referencing something specific/i);
  });

  it("states the interview length", () => {
    expect(prompt).toContain("15 minutes");
    expect(
      buildResumeInterviewInstruction({ ...config, durationSeconds: 300 })
    ).toContain("5 minutes");
  });

  it("keeps the project conventions: one question at a time, topics as a guide", () => {
    expect(prompt).toMatch(/ONE question at a time/);
    expect(prompt).toMatch(/guide, not a queue/i);
    expect(prompt).toMatch(/TIME/);
  });

  it("forbids the model from ending the session itself", () => {
    expect(prompt).toMatch(/cannot end this session/i);
    expect(prompt).toMatch(/never try to/i);
  });

  it("carries the worked follow-up example", () => {
    expect(prompt).toContain("I optimised the database.");
    expect(prompt).toContain("Which specific bottleneck, and what did you change?");
  });

  it("asks for the candidate's specific contribution behind a broad claim", () => {
    expect(prompt).toMatch(/built scalable microservices/i);
    expect(prompt).toMatch(/specific contribution/i);
    expect(prompt).toMatch(/mechanics/i);
  });

  /**
   * The line this product will not cross. Probing a thin claim is the value of a
   * resume interview; telling a candidate they are lying is a harm the model is
   * in no position to inflict, so every mention of accusation in the prompt must
   * be a prohibition of it.
   */
  it("forbids accusing the candidate rather than instructing it", () => {
    // Word-bounded, because "implying" contains "lying" and the point here is
    // the accusation vocabulary, not the substring.
    const accusation = /\b(accus\w*|lying|liar|dishonest\w*)\b/i;
    const lines = prompt.split("\n").filter((line) => accusation.test(line));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toMatch(/never|not|forbid/i);
    }
    expect(prompt).toMatch(/NEVER accuse the candidate/i);
    expect(prompt).toMatch(/do NOT say or imply that a claim is false/i);
  });

  it("routes weak substantiation into the written feedback instead of a confrontation", () => {
    expect(prompt).toMatch(/do not confront them/i);
    expect(prompt).toMatch(/weak substantiation/i);
    expect(prompt).toMatch(/written feedback/i);
  });

  it("probes the gap when the target role differs from the resume background", () => {
    expect(prompt).toMatch(/GAP ANALYSIS/);
    expect(prompt).toContain("Frontend Developer -> AI Engineer");
    expect(prompt).toMatch(/transfers/i);
    expect(prompt).toMatch(/LLMs, RAG, embeddings/);
  });

  it("tells the interviewer to ask rather than assume anything not in the profile", () => {
    expect(prompt).toMatch(/it is not a fact you have/i);
    expect(prompt).toMatch(/never state a detail about their history/i);
  });

  /**
   * The seam for the shared safety rules. The marker has to be the last line, or
   * the caller in lib/voice/prompt.ts has nowhere to put UNIVERSAL_INTERVIEW_RULES
   * and the rules would be silently absent from this interview type.
   */
  it("ends with the universal-rules marker on its own line", () => {
    const lines = prompt.split("\n");
    expect(lines[lines.length - 1]).toBe("{{UNIVERSAL_RULES}}");
    expect(prompt.match(/\{\{UNIVERSAL_RULES\}\}/g)).toHaveLength(1);
  });

  it("produces a usable prompt from a completely empty profile", () => {
    const bare = buildResumeInterviewInstruction({
      ...config,
      profile: emptyProfile,
      topics: [],
    });
    expect(bare).toContain("Priya");
    expect(bare).toContain("AI Engineer");
    expect(bare).not.toMatch(/undefined|\[object Object\]/);
    expect(bare).toMatch(/lists no employment history/i);
    expect(bare).toMatch(/names no projects/i);
    expect(bare).toMatch(/never assume they lack experience/i);
    expect(bare.split("\n").pop()).toBe("{{UNIVERSAL_RULES}}");
  });

  it("survives a blank target role without producing a dangling sentence", () => {
    const bare = buildResumeInterviewInstruction({ ...config, targetRole: "  " });
    expect(bare).toContain("the role they are targeting");
    expect(bare).not.toMatch(/a {2,}position/);
  });
});

describe("describeResumeProfile", () => {
  it("summarises a full profile in a sentence or two", () => {
    expect(describeResumeProfile(fullProfile)).toBe(
      "3 years of experience, currently a Frontend Developer. 3 skills, 1 project detected."
    );
  });

  it("says so plainly when nothing could be read", () => {
    const summary = describeResumeProfile(emptyProfile);
    expect(summary).toMatch(/no details/i);
    expect(summary).not.toMatch(/\b0\b/);
  });

  it("describes a partial profile without mentioning what is missing", () => {
    const summary = describeResumeProfile(
      resumeProfileSchema.parse({ skills: ["React"], yearsOfExperience: 1 })
    );
    expect(summary).toBe("1 year of experience. 1 skill detected.");
  });
});
