/**
 * The catalogue behind the "Visa Interview" practice category: which simulated
 * visa interviews we offer, how the simulated officer behaves, and what a valid
 * setup looks like.
 *
 * Sits alongside lib/interview-config.ts and follows the same rule: pure data
 * and pure functions, so the setup wizard, the prompt builder and the
 * server-side validator all read one copy of the truth instead of drifting.
 *
 * PRODUCT SAFETY RULE -- read before editing anything in this file.
 * This is a PRACTICE SIMULATION ONLY. Nothing here may state or imply that the
 * tool can predict, estimate or influence the outcome of a real visa
 * application. That is why:
 *   - no category or mode carries an "approval chance", a score-to-outcome
 *     mapping, or anything a user could read as a verdict;
 *   - every `behaviour` string is restricted to *questioning style* (pace, tone,
 *     how hard the officer presses) and never to how a real officer would
 *     decide;
 *   - the test suite asserts that no behaviour text contains outcome language,
 *     so a well-meaning copy edit cannot quietly reintroduce it.
 * If you add a field that the model or the UI will surface, keep it inside
 * those bounds.
 */

/**
 * The extra context fields worth collecting per category.
 *
 * A closed union rather than free strings because the wizard renders a specific
 * labelled input for each one and the prompt builder switches on them; a typo in
 * a new category would otherwise silently render nothing at all.
 */
export type VisaDetailField =
  | "destination"
  | "university"
  | "course"
  | "employer"
  | "jobTitle"
  | "sponsor"
  | "purpose"
  | "duration"
  | "relationship"
  | "event";

export interface VisaCategory {
  /** Stable id, PERSISTED to Firestore as `visaType`. Never rename one. */
  id: string;
  label: string;
  shortLabel: string;
  /** One line shown under the label in the picker. */
  description: string;
  /** What an officer actually probes for this category. Folded into the system prompt. */
  focus: string;
  /** Extra detail fields worth collecting for this category, e.g. ["university","course"]. */
  detailFields: VisaDetailField[];
}

/**
 * The offered categories.
 *
 * These ids are written onto every session document, so renaming one orphans
 * historical interviews and their feedback. Add new ids freely; treat the
 * existing ones as immutable. The order here is the order the picker shows them,
 * roughly by how often people practise them.
 *
 * Each `focus` is deliberately category-specific: a single generic "ask about
 * the trip" line produced interviews that all sounded the same, which is the one
 * thing a practice tool cannot afford.
 */
export const VISA_CATEGORIES: VisaCategory[] = [
  {
    id: "f1-student",
    label: "F1 Student Visa",
    shortLabel: "F1",
    description: "Studying full time at a university or college abroad.",
    focus:
      "Why this university and this course rather than the options at home, how the degree follows " +
      "from the candidate academic history and career plan, who is paying and whether the funding is " +
      "credible for the whole programme, and what concrete reason they have to return after graduating.",
    detailFields: ["destination", "university", "course", "sponsor", "duration"],
  },
  {
    id: "j1-exchange",
    label: "J1 Exchange Visitor",
    shortLabel: "J1",
    description: "Exchange programme, research placement, or sponsored training.",
    focus:
      "The exchange programme itself and the organisation sponsoring it, how the placement was arranged " +
      "and what the candidate will actually do day to day, how it connects to the work or study they " +
      "already do at home, and their grasp of the fixed dates and obligations the programme carries.",
    detailFields: ["destination", "event", "sponsor", "duration"],
  },
  {
    id: "b1-b2-visitor",
    label: "B1/B2 Visitor Visa",
    shortLabel: "B1/B2",
    description: "Short combined business and tourism travel.",
    focus:
      "The specific purpose of this trip and who arranged it, how the business and the leisure halves " +
      "fit together, how the travel is being paid for, and what the candidate is coming back to -- job, " +
      "family, studies -- at the end of a clearly bounded stay.",
    detailFields: ["destination", "purpose", "duration", "sponsor"],
  },
  {
    id: "h1b-work",
    label: "H1B Work Visa",
    shortLabel: "H1B",
    description: "Skilled employment with a sponsoring employer.",
    focus:
      "The sponsoring employer and how the candidate came to be hired, the real duties of the role and " +
      "how their qualifications map onto them, where they will physically work and who directs that " +
      "work, and the terms and length of the employment.",
    detailFields: ["destination", "employer", "jobTitle", "duration"],
  },
  {
    id: "h4-dependent",
    label: "H4 Dependent Visa",
    shortLabel: "H4",
    description: "Travelling as the spouse or child of an H visa holder.",
    focus:
      "The relationship to the primary visa holder and how it can be evidenced, that person status and " +
      "job situation, how the household will be supported and where it will live, and how long the " +
      "candidate intends to stay relative to the primary holder.",
    detailFields: ["destination", "relationship", "duration"],
  },
  {
    id: "l1-work",
    label: "L1 Work Visa",
    shortLabel: "L1",
    description: "Intra-company transfer to an overseas office.",
    focus:
      "The relationship between the home office and the receiving office, how long the candidate has " +
      "worked for the company and in what capacity, whether the role is managerial or rests on " +
      "specialised knowledge, and what the assignment involves and for how long.",
    detailFields: ["destination", "employer", "jobTitle", "duration"],
  },
  {
    id: "l2-dependent",
    label: "L2 Dependent Visa",
    shortLabel: "L2",
    description: "Travelling as the spouse or child of an L1 transferee.",
    focus:
      "The relationship to the transferee and how it is documented, the transferee assignment and " +
      "employer, the family living and schooling arrangements abroad, and the intended length of stay.",
    detailFields: ["destination", "relationship", "duration"],
  },
  {
    id: "o1-extraordinary",
    label: "O1 Visa",
    shortLabel: "O1",
    description: "Individuals with a record of extraordinary achievement.",
    focus:
      "The specific body of work the claim rests on -- publications, awards, performances, press, peer " +
      "recognition -- who is petitioning and why they need this person in particular, and the concrete " +
      "engagements, projects or itinerary the candidate is travelling to carry out.",
    detailFields: ["destination", "employer", "purpose"],
  },
  {
    id: "eb1-employment",
    label: "EB-1 / Employment Based",
    shortLabel: "EB-1",
    description: "Employment-based route with a long-term intent.",
    focus:
      "The professional record and the independent evidence behind it, the petitioning employer or the " +
      "basis for self-petitioning, how the candidate field of work continues once they have moved, and " +
      "the long-term plan this move is a step in.",
    detailFields: ["destination", "employer", "purpose"],
  },
  {
    id: "tourist",
    label: "Tourist / Visitor Visa",
    shortLabel: "Tourist",
    description: "Leisure travel, sightseeing, or visiting friends and family.",
    focus:
      "The itinerary and what the candidate plans to see or do, who they are visiting and where they " +
      "will stay, how a leisure trip is affordable on their stated income, and the work, study or family " +
      "commitments waiting for them at home.",
    detailFields: ["destination", "purpose", "duration", "sponsor"],
  },
  {
    id: "business-visitor",
    label: "Business Visitor Visa",
    shortLabel: "Business",
    description: "Meetings, conferences, training, or client visits.",
    focus:
      "The meeting, conference or client engagement being attended and who invited the candidate, their " +
      "role at their employer and why they specifically are the one going, who bears the cost, and the " +
      "fact that the work performed is still for the home employer.",
    detailFields: ["destination", "employer", "purpose", "event"],
  },
  {
    id: "dependent-family",
    label: "Dependent / Family Visa",
    shortLabel: "Family",
    description: "Joining a spouse, parent, or immediate family member abroad.",
    focus:
      "How the relationship began and how it can be evidenced, the sponsoring relative status, income " +
      "and accommodation, what the family day-to-day life will look like once together, and the " +
      "intended length of stay.",
    detailFields: ["destination", "relationship", "duration"],
  },
  {
    id: "custom",
    label: "Other / Custom Visa",
    shortLabel: "Custom",
    description: "Describe a visa category in your own words.",
    focus:
      "The purpose of travel exactly as the candidate has described it, the ties and commitments that " +
      "anchor them at home, how the trip is funded, and whether their account of the plan stays " +
      "consistent when the same ground is covered a second time.",
    detailFields: ["destination", "purpose", "duration", "sponsor"],
  },
];

export interface VisaMode {
  /** Stable id, PERSISTED as `visaMode`. */
  id: string;
  label: string;
  description: string;
  /** How this mode changes the officer's questioning style. Folded into the prompt. */
  behaviour: string;
  /** True only for modes where in-interview coaching is allowed. */
  allowsCoaching: boolean;
}

/**
 * The interviewing styles on offer.
 *
 * Every `behaviour` covers *only* pace, tone, interruption, and how hard a vague
 * answer gets pushed. None of them says anything about outcomes, odds, or what a
 * real officer would conclude -- see the safety rule at the top of this file --
 * and a test enforces that.
 *
 * `allowsCoaching` is true for exactly one mode so the prompt builder can switch
 * mid-interview tips on there and nowhere else: coaching inside a simulation
 * that is meant to feel like the real thing blurs the line between practice and
 * advice, so it is confined to the mode whose name says that is what it is.
 */
export const VISA_MODES: VisaMode[] = [
  {
    id: "standard",
    label: "Standard Visa Interview",
    description: "A realistic, businesslike interview at a normal pace.",
    behaviour:
      "Ask short, direct questions in a neutral, businesslike tone and move through the topics at a " +
      "steady pace. Follow up once when an answer is vague, then move on. Let the candidate finish " +
      "speaking rather than cutting in.",
    allowsCoaching: false,
  },
  {
    id: "strict",
    label: "Strict Visa Officer",
    description: "Formal and exacting, with little small talk.",
    behaviour:
      "Keep the tone formal and clipped, with no small talk and no encouragement between questions. " +
      "Ask for exact figures, dates and names, and repeat the question word for word when the answer " +
      "drifts off it. Cut in politely but firmly if the candidate starts a long rehearsed speech.",
    allowsCoaching: false,
  },
  {
    id: "friendly",
    label: "Friendly Visa Officer",
    description: "Conversational and calm, good for a first practice run.",
    behaviour:
      "Use a warm, conversational tone and give the candidate a moment to settle before the substantive " +
      "questions. Ask follow-ups gently and rephrase rather than pressing when an answer is unclear. " +
      "Never interrupt, and keep the pace unhurried throughout.",
    allowsCoaching: false,
  },
  {
    id: "challenging",
    label: "Difficult / Challenging Officer",
    description: "Sceptical and probing, for practising under pressure.",
    behaviour:
      "Sound sceptical and press hard on anything vague, inconsistent or unsupported, coming back to the " +
      "same point from a different angle until the answer is specific. Ask pointed follow-ups back to " +
      "back and offer little verbal reassurance. Interrupt when the candidate wanders off the question.",
    allowsCoaching: false,
  },
  {
    id: "rapid-fire",
    label: "Rapid-Fire Visa Interview",
    description: "Very short questions, very fast, to practise being concise.",
    behaviour:
      "Fire short questions one after another with almost no pause between them, and expect answers of " +
      "a sentence or two. Cut in as soon as an answer turns long-winded and go straight to the next " +
      "question. Skip pleasantries entirely.",
    allowsCoaching: false,
  },
  {
    id: "document-based",
    label: "Document / Background-Based Interview",
    description: "Focused on paperwork, history, and consistency.",
    behaviour:
      "Work methodically through the stated background and paperwork, asking the candidate to say dates, " +
      "amounts, institutions and names aloud. Cross-check each answer against what they said earlier and " +
      "ask about any mismatch directly. Keep the tone even and the pace unhurried.",
    allowsCoaching: false,
  },
  {
    id: "custom-practice",
    label: "Custom Practice",
    description: "A relaxed run where the officer can pause and coach you.",
    behaviour:
      "Keep the pace relaxed and let the candidate restart an answer or ask what a question is getting " +
      "at. Step out of character briefly to point out what made an answer weak or strong, then resume. " +
      "Never interrupt mid-answer.",
    allowsCoaching: true,
  },
];

export const DEFAULT_VISA_CATEGORY_ID = "f1-student";
export const DEFAULT_VISA_MODE_ID = "standard";
export const CUSTOM_VISA_CATEGORY_ID = "custom";

/**
 * Lookups that always return a value.
 *
 * The ids reaching these functions come off persisted documents that may predate
 * a catalogue change, so returning undefined would force every render site to
 * handle a case that only matters for old data. Falling back keeps a stale
 * session readable instead of crashing the feedback page.
 */
export function getVisaCategory(id: string | undefined | null): VisaCategory {
  return (
    VISA_CATEGORIES.find((c) => c.id === id) ??
    VISA_CATEGORIES.find((c) => c.id === DEFAULT_VISA_CATEGORY_ID)!
  );
}

export function getVisaMode(id: string | undefined | null): VisaMode {
  return (
    VISA_MODES.find((m) => m.id === id) ??
    VISA_MODES.find((m) => m.id === DEFAULT_VISA_MODE_ID)!
  );
}

export interface VisaSetup {
  visaTypeId: string;
  /** Free text, required only when visaTypeId === CUSTOM_VISA_CATEGORY_ID. */
  customVisaType?: string;
  visaModeId: string;
  destination: string;
  /** Optional context the officer can probe: university, employer, sponsor, purpose etc. */
  details: Partial<Record<VisaDetailField, string>>;
}

/** The label to show and to send to the model: the category label, or the custom text. */
export function resolveVisaTypeLabel(
  setup: Pick<VisaSetup, "visaTypeId" | "customVisaType">
): string {
  const category = getVisaCategory(setup.visaTypeId);
  if (category.id !== CUSTOM_VISA_CATEGORY_ID) return category.label;

  // Blank custom text should never get this far -- validateVisaSetup refuses to
  // start such a session -- but this also runs against old documents on the
  // feedback page, so it degrades to the generic label rather than dropping an
  // empty string into the prompt, where it would read as a missing sentence.
  const custom = setup.customVisaType?.trim() ?? "";
  return custom.length > 0 ? custom : category.label;
}

export interface VisaValidation {
  valid: boolean;
  errors: Partial<
    Record<"visaType" | "customVisaType" | "visaMode" | "destination" | "terms", string>
  >;
}

/** Validated identically on the client and the server -- a disabled button is not a check. */
export function validateVisaSetup(
  setup: Partial<VisaSetup>,
  options: { termsAccepted?: boolean } = {}
): VisaValidation {
  const errors: VisaValidation["errors"] = {};

  if (!VISA_CATEGORIES.some((c) => c.id === setup.visaTypeId)) {
    errors.visaType = "Choose the visa type you want to practise for.";
  } else if (setup.visaTypeId === CUSTOM_VISA_CATEGORY_ID) {
    // Checked only for the custom category: for every other one the text box is
    // not even rendered, so demanding it would deadlock the wizard on a field
    // the user cannot see. The 80-character cap matches the role field in
    // lib/interview-config.ts -- this string is interpolated into the system
    // prompt, and an essay pasted here would drown the actual instructions.
    const custom = setup.customVisaType?.trim() ?? "";
    if (custom.length < 2) {
      errors.customVisaType = "Describe the visa you want to practise for.";
    } else if (custom.length > 80) {
      errors.customVisaType = "That visa description is too long.";
    }
  }

  if (!VISA_MODES.some((m) => m.id === setup.visaModeId)) {
    errors.visaMode = "Choose an interview style.";
  }

  const destination = setup.destination?.trim() ?? "";
  if (destination.length < 2) {
    errors.destination = "Enter the country you are applying to travel to.";
  } else if (destination.length > 80) {
    errors.destination = "That destination is too long.";
  }

  // Strict `=== false`, not falsy: the wizard re-runs this after every step,
  // before the terms checkbox has been rendered at all, and an absent option
  // must not make those intermediate steps look invalid. Only an explicit "not
  // accepted" is an error. The wording matters as much as the check -- what the
  // user is agreeing to is that this is practice, not advice about a real
  // application.
  if (options.termsAccepted === false) {
    errors.terms =
      "Please confirm you understand this is practice only, not advice about a real application.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Topic areas per category, used as the interview topic guide.
 *
 * This plays the same role `topics` plays for a technical interview: it steers
 * what gets asked. It is not a checklist the candidate has to "pass", and
 * nothing downstream may score against it as though it were.
 *
 * The sets differ per category because the ground an officer covers for a
 * four-year degree really is different from a two-week holiday; keeping one
 * shared list produced interviews that asked a tourist about their course.
 */
const TOPICS_BY_CATEGORY: Record<string, string[]> = {
  "f1-student": [
    "purpose of travel",
    "course/programme details",
    "education background",
    "finances and sponsorship",
    "ties to home country",
    "return plans",
    "previous visa history",
  ],
  "j1-exchange": [
    "purpose of travel",
    "course/programme details",
    "education background",
    "finances and sponsorship",
    "duration and itinerary",
    "ties to home country",
    "return plans",
  ],
  "b1-b2-visitor": [
    "purpose of travel",
    "duration and itinerary",
    "accommodation",
    "finances and sponsorship",
    "employment",
    "previous travel history",
    "ties to home country",
    "return plans",
  ],
  "h1b-work": [
    "purpose of travel",
    "employer and role details",
    "employment",
    "education background",
    "duration and itinerary",
    "previous visa history",
    "ties to home country",
  ],
  "h4-dependent": [
    "purpose of travel",
    "family situation",
    "employer and role details",
    "finances and sponsorship",
    "duration and itinerary",
    "accommodation",
    "return plans",
  ],
  "l1-work": [
    "purpose of travel",
    "employer and role details",
    "employment",
    "duration and itinerary",
    "previous travel history",
    "ties to home country",
    "return plans",
  ],
  "l2-dependent": [
    "purpose of travel",
    "family situation",
    "employer and role details",
    "finances and sponsorship",
    "duration and itinerary",
    "accommodation",
  ],
  "o1-extraordinary": [
    "purpose of travel",
    "employer and role details",
    "employment",
    "education background",
    "duration and itinerary",
    "previous travel history",
  ],
  "eb1-employment": [
    "purpose of travel",
    "employer and role details",
    "employment",
    "education background",
    "family situation",
    "previous visa history",
  ],
  tourist: [
    "purpose of travel",
    "duration and itinerary",
    "accommodation",
    "finances and sponsorship",
    "family situation",
    "previous travel history",
    "employment",
    "return plans",
  ],
  "business-visitor": [
    "purpose of travel",
    "employer and role details",
    "duration and itinerary",
    "finances and sponsorship",
    "previous travel history",
    "return plans",
  ],
  "dependent-family": [
    "purpose of travel",
    "family situation",
    "finances and sponsorship",
    "accommodation",
    "duration and itinerary",
    "previous visa history",
  ],
};

/**
 * The set used for the custom category, and the safety net for any id missing
 * from the map -- an old document, or a category someone adds to
 * VISA_CATEGORIES without a topic list. A usable generic set beats an empty
 * array, because an empty topic guide produces a directionless interview and no
 * error anyone would notice.
 */
const DEFAULT_VISA_TOPICS: string[] = [
  "purpose of travel",
  "destination",
  "ties to home country",
  "finances and sponsorship",
  "duration and itinerary",
  "previous travel history",
  "return plans",
];

/** The topic areas a visa officer covers, used as the interview's topic guide. */
export function visaTopicsFor(
  setup: Pick<VisaSetup, "visaTypeId" | "customVisaType">
): string[] {
  const category = getVisaCategory(setup.visaTypeId);
  // Returned as a copy: callers append their own topics before handing the list
  // to the prompt builder, and would otherwise mutate the module-level
  // catalogue for the rest of the process.
  return [...(TOPICS_BY_CATEGORY[category.id] ?? DEFAULT_VISA_TOPICS)];
}
