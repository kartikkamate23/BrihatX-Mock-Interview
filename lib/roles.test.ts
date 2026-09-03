import { describe, expect, it } from "vitest";

import {
  ALL_ROLES,
  ALL_ROLE_ENTRIES,
  AI_ROLE_ENTRIES,
  DEFAULT_ROLE_CATEGORY_ID,
  ICON_KEYS,
  MAX_ROLE_LENGTH,
  POPULAR_ROLES,
  ROLE_CATEGORIES,
  SUGGESTED_ROLES,
  categoryIdForRole,
  findCategoryForRole,
  findRole,
  focusForRole,
  getRoleById,
  getRoleCategory,
  iconKeyForRole,
  roleIdForRole,
  rolesInCategory,
  sanitiseRoleName,
  searchRoles,
  subcategoryForRole,
  suggestedTopicsForRole,
} from "@/lib/roles";

/** The names a search returned, for readable assertions. */
const names = (query: string, limit = 60) =>
  searchRoles(query, limit).map((result) => result.role);

describe("catalogue integrity", () => {
  it("has a stable, unique, kebab-case id for every role", () => {
    const ids = new Set<string>();
    for (const role of ALL_ROLE_ENTRIES) {
      expect(role.id, `${role.name} has a non-kebab id`).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(ids.has(role.id), `duplicate id: ${role.id}`).toBe(false);
      ids.add(role.id);
    }
  });

  it("never uses an array index as an id", () => {
    for (const role of ALL_ROLE_ENTRIES) {
      expect(role.id).not.toMatch(/^\d+$/);
    }
  });

  it("assigns every role to a real category", () => {
    const known = new Set(ROLE_CATEGORIES.map((c) => c.id));
    for (const role of ALL_ROLE_ENTRIES) {
      expect(known.has(role.categoryId), `${role.name}: ${role.categoryId}`).toBe(true);
    }
  });

  it("gives every role a subcategory, a description and at least one alias", () => {
    for (const role of ALL_ROLE_ENTRIES) {
      expect(role.subcategory.length, role.name).toBeGreaterThan(0);
      expect(role.description.length, role.name).toBeGreaterThan(10);
      expect(role.aliases.length, `${role.name} has no aliases`).toBeGreaterThan(0);
    }
  });

  it("is a substantial catalogue", () => {
    // The point of the exercise: a candidate should find essentially any modern
    // technology role rather than a token list.
    expect(ALL_ROLE_ENTRIES.length).toBeGreaterThan(300);
    expect(ALL_ROLES.length).toBe(ALL_ROLE_ENTRIES.length);
  });

  it("gives every category a valid icon, topics and an assessment focus", () => {
    const icons = new Set<string>(ICON_KEYS);
    for (const category of ROLE_CATEGORIES) {
      expect(icons.has(category.iconKey), category.id).toBe(true);
      expect(category.topics.length, category.id).toBeGreaterThanOrEqual(8);
      expect(category.focus.length, category.id).toBeGreaterThan(60);
      expect(rolesInCategory(category.id).length, category.id).toBeGreaterThan(0);
    }
  });

  it("keeps a small, real suggested set", () => {
    expect(SUGGESTED_ROLES.length).toBeGreaterThanOrEqual(10);
    expect(SUGGESTED_ROLES.length).toBeLessThanOrEqual(40);
    for (const role of SUGGESTED_ROLES) {
      expect(ALL_ROLES).toContain(role.name);
    }
    expect(POPULAR_ROLES).toEqual(SUGGESTED_ROLES.map((r) => r.name));
  });
});

/**
 * AI is the fastest-moving part of the market and the reason this catalogue was
 * expanded, so it gets its own assertions rather than being covered incidentally.
 */
describe("AI and GenAI coverage", () => {
  it("is a first-class category with deep coverage", () => {
    expect(AI_ROLE_ENTRIES.length).toBeGreaterThan(60);
    expect(getRoleCategory("ai-ml").label).toBe("AI & GenAI");
  });

  it("contains the modern AI titles people actually search for", () => {
    const present = new Set(AI_ROLE_ENTRIES.map((r) => r.name));
    for (const expected of [
      "AI Engineer",
      "Machine Learning Engineer",
      "Deep Learning Engineer",
      "Computer Vision Engineer",
      "NLP Engineer",
      "Generative AI Engineer",
      "LLM Engineer",
      "Prompt Engineer",
      "RAG Engineer",
      "AI Agent Engineer",
      "Agentic AI Engineer",
      "Conversational AI Engineer",
      "AI Solutions Architect",
      "AI Research Scientist",
      "Applied Scientist",
      "AI Evaluation Engineer",
      "LLM Evaluation Engineer",
      "AI Safety Engineer",
      "AI Governance Specialist",
      "Responsible AI Specialist",
    ]) {
      expect(present.has(expected), `missing AI role: ${expected}`).toBe(true);
    }
  });
});

/**
 * The behaviour this whole restructure exists for.
 *
 * People search by abbreviation and by technology, not by job title. Before
 * aliases existed, every one of these returned nothing -- which reads to a
 * candidate as "this product has no AI roles".
 */
describe("alias-aware search", () => {
  it("finds machine learning roles from “ML”", () => {
    const found = names("ML");
    expect(found).toContain("Machine Learning Engineer");
    expect(found.length).toBeGreaterThan(3);
  });

  it("finds generative AI roles from “GenAI”", () => {
    const found = names("GenAI");
    expect(found).toContain("Generative AI Engineer");
    expect(found.length).toBeGreaterThan(2);
  });

  it("finds LLM roles from “LLM” and from the spelled-out form", () => {
    expect(names("LLM")).toContain("LLM Engineer");
    expect(names("Large Language Model")).toContain("LLM Engineer");
  });

  it("finds agentic roles from “Agentic”", () => {
    const found = names("Agentic");
    expect(found).toContain("Agentic AI Engineer");
  });

  it("surfaces the AI category from a bare “AI”", () => {
    const found = names("AI", 60);
    expect(found).toContain("AI Engineer");
    expect(found.length).toBeGreaterThan(10);
  });

  it("finds roles by technology rather than by title", () => {
    expect(names("React")).toContain("React Developer");
    expect(names("Kubernetes")).toContain("Kubernetes Engineer");
    expect(names("Java")).toContain("Java Developer");
    expect(names("Python")).toContain("Python Developer");
    expect(names("DevOps")).toContain("DevOps Engineer");
  });

  it("finds reliability roles from “SRE”", () => {
    expect(names("SRE")).toContain("Site Reliability Engineer");
  });

  it("finds security roles from “Cybersecurity”", () => {
    expect(names("Cybersecurity")).toContain("Cybersecurity Engineer");
  });

  it("is case-insensitive and tolerant of stray whitespace", () => {
    expect(names("  mAcHiNe LeArNiNg  ")).toContain("Machine Learning Engineer");
    expect(names("genai")).toContain("Generative AI Engineer");
  });

  it("ranks an exact title above a partial match", () => {
    expect(names("Data Scientist")[0]).toBe("Data Scientist");
    expect(names("AI Engineer")[0]).toBe("AI Engineer");
  });

  it("reports which alias produced a non-obvious match", () => {
    const hit = searchRoles("ML", 60).find((r) => r.role === "Machine Learning Engineer");
    expect(hit?.matchedAlias).toBeDefined();
  });

  it("returns the suggested set for an empty query", () => {
    expect(names("")).toEqual(SUGGESTED_ROLES.map((r) => r.name));
    expect(names("   ")).toEqual(SUGGESTED_ROLES.map((r) => r.name));
  });

  it("respects the limit, including zero", () => {
    expect(searchRoles("engineer", 5)).toHaveLength(5);
    expect(searchRoles("engineer", 0)).toEqual([]);
  });

  it("returns nothing for a genuinely absent term rather than throwing", () => {
    expect(names("underwater basket weaving")).toEqual([]);
  });
});

describe("lookup and backward compatibility", () => {
  it("resolves a stored role name back to its catalogue entry", () => {
    expect(findRole("Software Engineer")?.categoryId).toBe("software");
    expect(findRole("Data Scientist")?.categoryId).toBe("data");
  });

  it("is insensitive to case, whitespace and punctuation", () => {
    expect(findRole("  software   engineer ")?.name).toBe("Software Engineer");
    expect(findRole("nodejs developer")?.name).toBe("Node.js Developer");
  });

  it("resolves an alias someone may have stored as the role name", () => {
    expect(findRole("ML Engineer")).not.toBeNull();
  });

  /**
   * Interviews saved under the previous taxonomy carry these category ids. They
   * must keep resolving, or every old card silently changes icon.
   */
  it("maps legacy category ids forward", () => {
    expect(getRoleCategory("software-development").id).toBe("software");
    expect(getRoleCategory("data-ai").id).toBe("data");
    expect(getRoleCategory("qa-testing").id).toBe("testing");
    expect(getRoleCategory("database").id).toBe("data");
    expect(getRoleCategory("sales-marketing").id).toBe("business");
    expect(getRoleCategory("hr").id).toBe("business");
    expect(getRoleCategory("engineering-manufacturing").id).toBe("other");
  });

  it("falls back rather than returning undefined", () => {
    expect(getRoleCategory("nonsense").id).toBe(DEFAULT_ROLE_CATEGORY_ID);
    expect(getRoleCategory(undefined).id).toBe(DEFAULT_ROLE_CATEGORY_ID);
    expect(getRoleById("nope")).toBeNull();
    expect(findRole(undefined)).toBeNull();
    expect(findRole("")).toBeNull();
    expect(findCategoryForRole("Underwater Basket Weaver")).toBeNull();
  });

  it("treats an unknown role as custom without breaking", () => {
    expect(categoryIdForRole("Quantum Computing Engineer")).toBe(DEFAULT_ROLE_CATEGORY_ID);
    expect(roleIdForRole("Quantum Computing Engineer")).toBeNull();
    expect(subcategoryForRole("Quantum Computing Engineer")).toBeNull();
    expect(suggestedTopicsForRole("Quantum Computing Engineer").length).toBeGreaterThan(0);
    expect(focusForRole("Quantum Computing Engineer").length).toBeGreaterThan(30);
  });

  it("returns a stable id for a catalogued role", () => {
    expect(roleIdForRole("Machine Learning Engineer")).toBe("machine-learning-engineer");
  });
});

/**
 * Choosing a role has to change the interview, not merely be displayed during
 * setup. These are the two values that carry it into the prompt.
 */
describe("role-aware interview inputs", () => {
  it("gives different topic sets to different role families", () => {
    const ai = suggestedTopicsForRole("Generative AI Engineer");
    const devops = suggestedTopicsForRole("DevOps Engineer");
    const frontend = suggestedTopicsForRole("Frontend Developer");

    expect(ai).not.toEqual(devops);
    expect(devops).not.toEqual(frontend);
    expect(ai.join(" ")).toMatch(/LLM|RAG|Agentic/);
    expect(devops.join(" ")).toMatch(/CI\/CD|Kubernetes|Docker/);
  });

  it("returns a copy, so a caller cannot mutate the catalogue", () => {
    const topics = suggestedTopicsForRole("Data Scientist");
    topics.push("Injected");
    expect(suggestedTopicsForRole("Data Scientist")).not.toContain("Injected");
  });

  it("distinguishes two roles inside the same category", () => {
    // An LLM Engineer and a Computer Vision Engineer share a category but must
    // not produce the same interview.
    expect(focusForRole("LLM Engineer")).not.toBe(focusForRole("Computer Vision Engineer"));
    expect(focusForRole("LLM Engineer")).toContain("LLM Engineer");
  });

  it("maps role families to the right icon", () => {
    expect(iconKeyForRole("Generative AI Engineer")).toBe("brain");
    expect(iconKeyForRole("Frontend Developer")).toBe("code");
    expect(iconKeyForRole("Data Analyst")).toBe("chart");
    expect(iconKeyForRole("DevOps Engineer")).toBe("cloud");
    expect(iconKeyForRole("Penetration Tester")).toBe("shield");
    expect(iconKeyForRole("QA Engineer")).toBe("test");
    expect(iconKeyForRole("Product Manager")).toBe("product");
    expect(iconKeyForRole("UI/UX Designer")).toBe("design");
  });
});

describe("sanitiseRoleName", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitiseRoleName("  Senior   Java   Architect ")).toBe("Senior Java Architect");
  });

  it("strips control characters that would reach a prompt", () => {
    expect(sanitiseRoleName("AI  Engineer")).toBe("AI Engineer");
  });

  it("caps the length", () => {
    expect(sanitiseRoleName("x".repeat(500))).toHaveLength(MAX_ROLE_LENGTH);
  });

  it("leaves a legitimate custom role intact", () => {
    expect(sanitiseRoleName("Quantum Computing Engineer")).toBe("Quantum Computing Engineer");
  });
});
