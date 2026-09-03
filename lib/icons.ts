/**
 * Deterministic visual identity for an interview.
 *
 * Pure, and free of React, so the rule "the same interview always shows the same
 * icon" is a property that can be tested rather than a claim about a component.
 *
 * The rule matters because the previous implementation called
 * `getRandomInterviewCover()` -- `Math.random()` -- inside the card's render.
 * The icon therefore changed on every render and every refresh, and it was drawn
 * from a set of real company logos that had nothing to do with the interview.
 * Nothing here consults a random source, a clock, or anything else that varies
 * between two renders of the same record.
 */

import { getInterviewTypeDefinition, resolveInterviewType } from "@/lib/interview-types";
import { getRoleCategory, iconKeyForRole } from "@/lib/roles";

/**
 * The subset of a stored interview this needs.
 *
 * Every field is optional because records written before these fields existed
 * must still resolve to something sensible rather than throwing.
 */
export interface StoredInterviewShape {
  interviewType?: string | null;
  role?: string | null;
  roleCategory?: string | null;
  iconKey?: string | null;
}

/**
 * The icon for an interview, in order of how much the source is trusted.
 *
 * 1. `iconKey` written at creation. Cheapest and most stable: an interview keeps
 *    the identity it was created with even if the role taxonomy is later
 *    reorganised underneath it.
 * 2. `roleCategory`, also written at creation.
 * 3. The role name, matched against the taxonomy -- this is what carries the
 *    old records, which have a role and nothing else.
 * 4. The interview type's own icon.
 */
export function iconKeyForInterview(interview: StoredInterviewShape): string {
  if (interview.iconKey && interview.iconKey.trim() !== "") {
    return interview.iconKey.trim();
  }

  const type = resolveInterviewType(interview.interviewType);

  // A visa interview has no role, and its identity comes from the type. Checking
  // this before the role keeps a legacy record that happens to carry a stray
  // role field from being drawn as a job interview.
  if (type === "visa" || type === "communication") {
    return getInterviewTypeDefinition(type).iconKey;
  }

  if (interview.roleCategory && interview.roleCategory.trim() !== "") {
    return getRoleCategory(interview.roleCategory).iconKey;
  }

  if (interview.role && interview.role.trim() !== "") {
    return iconKeyForRole(interview.role);
  }

  return getInterviewTypeDefinition(type).iconKey;
}

/**
 * The icon to store when an interview is created.
 *
 * Resolved once, at write time, so the record carries its own identity rather
 * than depending on a taxonomy that may be reorganised later.
 */
export function iconKeyForNewInterview(params: {
  interviewType: string;
  role?: string | null;
}): string {
  return iconKeyForInterview({
    interviewType: params.interviewType,
    role: params.role ?? null,
  });
}
