/**
 * The role catalogue: assembly, lookup and search.
 *
 * The data lives in `catalog/`, split by area so it can be maintained without
 * merge conflicts. This file is the only thing the application imports, and it
 * owns three concerns the data files deliberately do not:
 *
 *   - the category definitions, including the topics and assessment focus that
 *     make the selected role actually change the interview;
 *   - the lookup maps, including the legacy-name and legacy-category handling
 *     that keeps interviews saved before this catalogue existed working;
 *   - search, which is alias-aware because people search by abbreviation and by
 *     technology ("ML", "GenAI", "SRE", "React"), not by job title.
 */

import { AI_ROLES } from "@/lib/roles/catalog/ai";
import {
  BUSINESS_ROLES,
  DESIGN_ROLES,
  OTHER_ROLES,
  PRODUCT_ROLES,
} from "@/lib/roles/catalog/business";
import {
  CLOUD_ROLES,
  DATA_ROLES,
  SECURITY_ROLES,
  TESTING_ROLES,
} from "@/lib/roles/catalog/infrastructure";
import { SOFTWARE_ROLES } from "@/lib/roles/catalog/software";
import type {
  IconKey,
  Role,
  RoleCategory,
  RoleCategoryId,
  RoleSearchResult,
} from "@/lib/roles/types";

export { ICON_KEYS } from "@/lib/roles/types";
export type {
  IconKey,
  Role,
  RoleCategory,
  RoleCategoryId,
  RoleSearchResult,
} from "@/lib/roles/types";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * `topics` and `focus` are what make choosing a role mean something.
 *
 * `topics` seeds the checklist on the next step of the wizard, and `focus` is
 * injected into the interviewer's system instruction. Without the latter, the
 * role would be displayed during setup and then have no effect on the questions
 * -- which is the failure mode this data exists to prevent. Each set is
 * genuinely specific: a Data Scientist and a DevOps Engineer must not be handed
 * the same list.
 */
export const ROLE_CATEGORIES: RoleCategory[] = [
  {
    id: "ai-ml",
    label: "AI & GenAI",
    iconKey: "brain",
    description: "Machine learning, generative AI, agents and evaluation.",
    topics: [
      "Machine Learning Fundamentals",
      "Deep Learning",
      "LLMs & Prompting",
      "RAG & Embeddings",
      "Agentic Systems",
      "Model Evaluation",
      "MLOps & Deployment",
      "Data & Feature Engineering",
      "AI Safety & Guardrails",
      "Python for ML",
    ],
    focus:
      "Whether they understand what a model actually does rather than only which API to call: how it is trained or adapted, how it fails, how its output is evaluated, and what it costs to run in production. Strong candidates reason about trade-offs and can describe how they measured whether a system worked.",
  },
  {
    id: "software",
    label: "Software",
    iconKey: "code",
    description: "Backend, frontend, mobile, embedded and everything building products.",
    topics: [
      "Data Structures & Algorithms",
      "System Design",
      "Object-Oriented Programming",
      "APIs & Integration",
      "Databases & SQL",
      "Testing & Quality",
      "Concurrency",
      "Version Control & Code Review",
      "Debugging & Incidents",
      "Performance",
    ],
    focus:
      "Whether they can design, build and reason about working software: correctness, structure, trade-offs, and how they debug something that is failing. Strong candidates explain decisions they made and what they would change now.",
  },
  {
    id: "data",
    label: "Data",
    iconKey: "chart",
    description: "Analytics, data science, pipelines and databases.",
    topics: [
      "SQL & Data Modelling",
      "Statistics & Probability",
      "Experimentation & A/B Testing",
      "Data Pipelines & ETL",
      "Data Warehousing",
      "Python for Data",
      "Data Visualisation",
      "Data Quality & Governance",
      "Business Metrics",
      "Big Data Tooling",
    ],
    focus:
      "Whether they can get from a business question to a defensible answer: modelling the data correctly, choosing the right method, understanding what the numbers do and do not support, and communicating it to someone who will act on it.",
  },
  {
    id: "cloud-devops",
    label: "Cloud & DevOps",
    iconKey: "cloud",
    description: "Cloud platforms, CI/CD, containers, reliability and infrastructure.",
    topics: [
      "CI/CD Pipelines",
      "Docker & Containers",
      "Kubernetes",
      "Cloud Platforms",
      "Infrastructure as Code",
      "Monitoring & Observability",
      "Incident Response",
      "Networking",
      "Scaling & Reliability",
      "Linux & Scripting",
    ],
    focus:
      "Whether they can keep a system running and shipping: how they automate delivery, how they observe what is happening in production, and what they actually did the last time something broke at an inconvenient hour.",
  },
  {
    id: "cybersecurity",
    label: "Cybersecurity",
    iconKey: "shield",
    description: "Security engineering, analysis, offensive security and compliance.",
    topics: [
      "Threat Modelling",
      "Network Security",
      "Application Security",
      "Cloud Security",
      "Identity & Access Management",
      "Incident Response",
      "Vulnerability Management",
      "Cryptography Basics",
      "Security Monitoring",
      "Compliance & Governance",
    ],
    focus:
      "Whether they think in terms of attackers and consequences rather than checklists: how they would find a weakness, how they would detect an intrusion, and how they judge which risks are worth spending on.",
  },
  {
    id: "testing",
    label: "Testing",
    iconKey: "test",
    description: "Quality assurance, test automation and evaluation.",
    topics: [
      "Test Strategy & Planning",
      "Test Automation",
      "API Testing",
      "Performance Testing",
      "Mobile Testing",
      "Bug Reporting & Triage",
      "CI Integration",
      "Exploratory Testing",
      "Test Data Management",
      "Quality Metrics",
    ],
    focus:
      "Whether they can decide what is worth testing and prove it: designing cases that find real defects, automating the ones that pay for themselves, and explaining how they judge whether a release is safe.",
  },
  {
    id: "product-management",
    label: "Product & Management",
    iconKey: "product",
    description: "Product, programme, delivery and engineering leadership.",
    topics: [
      "Product Discovery",
      "Prioritisation & Trade-offs",
      "Stakeholder Management",
      "Metrics & Success Criteria",
      "Roadmapping",
      "Agile Delivery",
      "Working with Engineering",
      "Go-to-Market",
      "Handling Conflict",
      "Case Study & Estimation",
    ],
    focus:
      "Whether they can decide what to build and defend it: how they choose between competing demands, how they know something worked, and how they handle disagreement with engineering or with a stakeholder.",
  },
  {
    id: "design",
    label: "Design",
    iconKey: "design",
    description: "Product design, UX research, design systems and visual design.",
    topics: [
      "Design Process",
      "User Research",
      "Interaction Design",
      "Visual Design & Typography",
      "Design Systems",
      "Accessibility",
      "Prototyping",
      "Portfolio Walkthrough",
      "Working with Engineers",
      "Critique & Feedback",
    ],
    focus:
      "Whether they can explain the reasoning behind their work: what problem it solved, what they tried and discarded, how they validated it, and how they handle critique.",
  },
  {
    id: "business",
    label: "Business",
    iconKey: "briefcase",
    description: "Analysis, consulting, sales, marketing, people and finance.",
    topics: [
      "Business Case & Analysis",
      "Stakeholder Communication",
      "Requirements Gathering",
      "Problem Structuring",
      "Commercial Awareness",
      "Negotiation & Influence",
      "Process Improvement",
      "Reporting & Metrics",
      "Client Management",
      "Behavioural & Situational",
    ],
    focus:
      "Whether they can structure an ambiguous problem, reason commercially about it, and carry other people with them. Strong candidates use concrete examples with numbers attached.",
  },
  {
    id: "other",
    label: "Other",
    iconKey: "briefcase",
    description: "Everything else, including any role you type yourself.",
    topics: [
      "Background & Motivation",
      "Core Skills for the Role",
      "Problem Solving",
      "Communication",
      "Teamwork & Collaboration",
      "Handling Pressure",
      "Behavioural & Situational",
      "Career Goals",
    ],
    focus:
      "Whether they can explain their experience clearly, reason through a problem out loud, and give specific examples rather than generalities.",
  },
];

export const DEFAULT_ROLE_CATEGORY_ID: RoleCategoryId = "other";

const CATEGORY_BY_ID = new Map<string, RoleCategory>(
  ROLE_CATEGORIES.map((category) => [category.id, category])
);

/**
 * Category ids used before this catalogue was reorganised.
 *
 * Interviews saved under the old taxonomy carry these in `roleCategory`, and
 * they are what the dashboard resolves an icon from. Mapping them forward is
 * cheaper and far safer than rewriting every stored document, and it means an
 * interview taken months ago still shows the icon it always showed.
 */
const LEGACY_CATEGORY_IDS: Record<string, RoleCategoryId> = {
  "software-development": "software",
  "data-ai": "data",
  "qa-testing": "testing",
  database: "data",
  "sales-marketing": "business",
  hr: "business",
  finance: "business",
  consulting: "business",
  legal: "other",
  healthcare: "other",
  education: "other",
  "operations-supply-chain": "other",
  "customer-support": "business",
  "engineering-manufacturing": "other",
};

export function getRoleCategory(id: string | undefined | null): RoleCategory {
  if (id) {
    const direct = CATEGORY_BY_ID.get(id);
    if (direct) return direct;
    const legacy = LEGACY_CATEGORY_IDS[id];
    if (legacy) return CATEGORY_BY_ID.get(legacy)!;
  }
  return CATEGORY_BY_ID.get(DEFAULT_ROLE_CATEGORY_ID)!;
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

/** Ordered so the technology categories, which dominate use, come first. */
export const ALL_ROLE_ENTRIES: Role[] = [
  ...AI_ROLES,
  ...SOFTWARE_ROLES,
  ...DATA_ROLES,
  ...CLOUD_ROLES,
  ...SECURITY_ROLES,
  ...TESTING_ROLES,
  ...PRODUCT_ROLES,
  ...DESIGN_ROLES,
  ...BUSINESS_ROLES,
  ...OTHER_ROLES,
];

/** Role names only, in catalogue order. */
export const ALL_ROLES: string[] = ALL_ROLE_ENTRIES.map((role) => role.name);

export const SUGGESTED_ROLES: Role[] = ALL_ROLE_ENTRIES.filter((role) => role.suggested);

/** A broader high-frequency set for the role picker's Popular view. */
export const POPULAR_ROLE_ENTRIES: Role[] = ALL_ROLE_ENTRIES.filter((role) => role.popular);

/** Kept as names for the callers that only ever needed the label. */
export const POPULAR_ROLES: string[] = SUGGESTED_ROLES.map((role) => role.name);

export const AI_ROLE_ENTRIES: Role[] = ALL_ROLE_ENTRIES.filter(
  (role) => role.categoryId === "ai-ml"
);

export function rolesInCategory(id: RoleCategoryId): Role[] {
  return ALL_ROLE_ENTRIES.filter((role) => role.categoryId === id);
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/** Trimmed, whitespace-collapsed, lowercased. */
function normalise(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** The same, with punctuation removed, so "Node.js" matches "nodejs". */
function loosen(value: string): string {
  return normalise(value).replace(/[^a-z0-9]/g, "");
}

const BY_ID = new Map<string, Role>(ALL_ROLE_ENTRIES.map((role) => [role.id, role]));
const BY_NAME = new Map<string, Role>();
const BY_LOOSE_NAME = new Map<string, Role>();

for (const role of ALL_ROLE_ENTRIES) {
  const key = normalise(role.name);
  if (!BY_NAME.has(key)) BY_NAME.set(key, role);
  const loose = loosen(role.name);
  if (!BY_LOOSE_NAME.has(loose)) BY_LOOSE_NAME.set(loose, role);
}

/**
 * An alias index for exact-match lookup.
 *
 * First writer wins, so a role that lists "ML" as an alias does not have that
 * mapping stolen by a later one. Search does its own ranked pass over aliases;
 * this map is only for resolving a stored value back to a catalogue entry.
 */
const BY_ALIAS = new Map<string, Role>();
for (const role of ALL_ROLE_ENTRIES) {
  for (const alias of role.aliases) {
    const key = normalise(alias);
    if (!BY_ALIAS.has(key)) BY_ALIAS.set(key, role);
  }
}

export function getRoleById(id: string | undefined | null): Role | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/**
 * Resolves a stored role *name* back to a catalogue entry.
 *
 * Old interviews store only the name, so this is the path that keeps them
 * working. Exact match first, then punctuation-insensitive, then aliases -- a
 * record saved as "ML Engineer" still resolves even though the catalogue's
 * canonical name is different.
 */
export function findRole(role: string | undefined | null): Role | null {
  if (!role) return null;
  const key = normalise(role);
  if (key === "") return null;
  return BY_NAME.get(key) ?? BY_LOOSE_NAME.get(loosen(role)) ?? BY_ALIAS.get(key) ?? null;
}

export function findCategoryForRole(role: string): RoleCategory | null {
  const entry = findRole(role);
  return entry ? getRoleCategory(entry.categoryId) : null;
}

/** The category id to store. Falls back rather than throwing on a custom role. */
export function categoryIdForRole(role: string): string {
  return findRole(role)?.categoryId ?? DEFAULT_ROLE_CATEGORY_ID;
}

/** The stable id to store, or null when the candidate typed something custom. */
export function roleIdForRole(role: string): string | null {
  return findRole(role)?.id ?? null;
}

export function subcategoryForRole(role: string): string | null {
  return findRole(role)?.subcategory ?? null;
}

export function iconKeyForRole(role: string): IconKey {
  return getRoleCategory(findRole(role)?.categoryId).iconKey;
}

export function suggestedTopicsForRole(role: string): string[] {
  return [...getRoleCategory(findRole(role)?.categoryId).topics];
}

/**
 * What this role is assessed on, for the interviewer's system instruction.
 *
 * Category focus plus the role's own description, so two roles in the same
 * category still produce different prompts -- an LLM Engineer and a Computer
 * Vision Engineer share a category but should not share an interview.
 */
export function focusForRole(role: string): string {
  const entry = findRole(role);
  const categoryFocus = getRoleCategory(entry?.categoryId).focus;
  if (!entry) return categoryFocus;
  return `${entry.name}: ${entry.description}\n${categoryFocus}`;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

interface Scored {
  role: Role;
  score: number;
  position: number;
  matchedAlias?: string;
}

/**
 * Ranked, alias-aware search.
 *
 * Alias matching is the whole point. A candidate looking for machine learning
 * work types "ML"; one looking for generative AI types "GenAI"; one looking for
 * reliability work types "SRE". None of those strings appears in the job titles
 * they are looking for, and without aliases every one of those searches returns
 * nothing -- which reads as "this product does not have those roles".
 *
 * Tiers, highest first: exact name, exact alias, name prefix, alias prefix, name
 * substring, alias substring, subcategory, category label. Ties break on where
 * the match occurred and then on catalogue order, so results do not reshuffle
 * between keystrokes.
 */
export function searchRoles(query: string, limit = 30): RoleSearchResult[] {
  const q = normalise(query);
  const safeLimit = Math.max(0, limit);
  if (safeLimit === 0) return [];

  if (q === "") {
    // Wrapped rather than passed by reference: `map` supplies the index as a
    // second argument, which `toResult` would read as a matched alias.
    return SUGGESTED_ROLES.slice(0, safeLimit).map((role) => toResult(role));
  }

  const loose = loosen(query);
  const scored: Scored[] = [];

  for (const role of ALL_ROLE_ENTRIES) {
    const name = normalise(role.name);
    const looseName = loosen(role.name);

    if (name === q || looseName === loose) {
      scored.push({ role, score: 100, position: 0 });
      continue;
    }

    let best: Scored | null = null;

    const namePosition = name.indexOf(q);
    if (namePosition === 0) {
      best = { role, score: 80, position: 0 };
    } else if (namePosition > 0) {
      best = { role, score: 60, position: namePosition };
    } else if (looseName.includes(loose)) {
      // Catches "nodejs" typed against "Node.js Developer".
      best = { role, score: 58, position: looseName.indexOf(loose) };
    }

    for (const alias of role.aliases) {
      const a = normalise(alias);
      const aliasPosition = a.indexOf(q);
      let candidate: Scored | null = null;

      if (a === q) {
        candidate = { role, score: 90, position: 0, matchedAlias: alias };
      } else if (aliasPosition === 0) {
        candidate = { role, score: 70, position: 0, matchedAlias: alias };
      } else if (aliasPosition > 0) {
        candidate = { role, score: 50, position: aliasPosition, matchedAlias: alias };
      } else if (loosen(alias).includes(loose)) {
        candidate = { role, score: 48, position: 0, matchedAlias: alias };
      }

      if (candidate && (!best || candidate.score > best.score)) best = candidate;
    }

    if (!best && normalise(role.subcategory).includes(q)) {
      best = { role, score: 30, position: 0 };
    }

    if (!best) {
      const label = normalise(getRoleCategory(role.categoryId).label);
      if (label.includes(q)) best = { role, score: 20, position: 0 };
    }

    if (best) scored.push(best);
  }

  const order = new Map(ALL_ROLE_ENTRIES.map((role, index) => [role.id, index]));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.position !== b.position) return a.position - b.position;
    // A commonly hired role wins an otherwise exact tie.
    const popularity = Number(b.role.popular ?? false) - Number(a.role.popular ?? false);
    if (popularity !== 0) return popularity;
    return (order.get(a.role.id) ?? 0) - (order.get(b.role.id) ?? 0);
  });

  return scored.slice(0, safeLimit).map((entry) => toResult(entry.role, entry.matchedAlias));
}

function toResult(role: Role, matchedAlias?: string): RoleSearchResult {
  return {
    role: role.name,
    roleId: role.id,
    categoryId: role.categoryId,
    categoryLabel: getRoleCategory(role.categoryId).label,
    subcategory: role.subcategory,
    ...(matchedAlias ? { matchedAlias } : {}),
  };
}

/**
 * Cleans a role the candidate typed themselves.
 *
 * Custom roles are deliberately allowed -- the catalogue cannot anticipate every
 * job title, and refusing an unlisted one would be worse than accepting it --
 * but the value reaches a model prompt and a database field, so it is trimmed,
 * collapsed, stripped of control characters, and capped.
 */
export const MAX_ROLE_LENGTH = 80;

export function sanitiseRoleName(value: string): string {
  return value
    // Control characters would otherwise survive into a model prompt and into
    // a stored field. Written as escapes because the literal characters are
    // invisible in a diff and easy to mangle.
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ROLE_LENGTH);
}
