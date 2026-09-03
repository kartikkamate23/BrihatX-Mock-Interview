/**
 * The shape of the role catalogue.
 *
 * Split from the data itself so the several files that make up the catalogue
 * can be written and reviewed independently while sharing one definition.
 *
 * The move from plain strings to objects was driven by search. A candidate
 * looking for a machine learning role types "ML", and someone looking for
 * generative AI work types "GenAI" -- neither of which appears in the job title
 * they are looking for. Without aliases those searches return nothing, which
 * reads as "this product has no AI roles".
 */

export const ICON_KEYS = [
  "code",
  "layout",
  "server",
  "database",
  "chart",
  "brain",
  "cloud",
  "shield",
  "test",
  "product",
  "design",
  "megaphone",
  "coin",
  "users",
  "briefcase",
  "scale",
  "heart",
  "graduation",
  "truck",
  "headset",
  "wrench",
  "globe",
  "message",
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

/**
 * The categories the role picker offers as filter tabs.
 *
 * Deliberately few. A tab strip is a navigation aid, and one with twenty entries
 * is a list with extra steps -- the finer breakdown lives in `subcategory`,
 * which groups results inside a tab without costing anyone a decision.
 */
export type RoleCategoryId =
  | "ai-ml"
  | "software"
  | "data"
  | "cloud-devops"
  | "cybersecurity"
  | "testing"
  | "product-management"
  | "design"
  | "business"
  | "other";

export interface Role {
  /**
   * Stable, kebab-case, derived from the name at authoring time.
   *
   * PERSISTED to Firestore as `roleId`, so an id is never renamed once shipped.
   * Deriving it from the name at runtime would be one refactor away from
   * silently repointing every saved interview.
   */
  id: string;
  /** What the candidate sees, and what is stored as `role`. */
  name: string;
  categoryId: RoleCategoryId;
  /** Groups results within a category, e.g. "Frontend" inside Software. */
  subcategory: string;
  /**
   * Other things people type when looking for this role: abbreviations
   * ("ML", "SRE"), spelled-out forms ("Large Language Model"), and the common
   * alternative titles. Matched by search, never displayed.
   */
  aliases: string[];
  /** One line, shown under the name where there is room for it. */
  description: string;
  /** Surfaces in the default "Suggested" view. Keep this set small. */
  suggested?: boolean;
  /** Ranked above equally-good matches in search. */
  popular?: boolean;
}

export interface RoleCategory {
  id: RoleCategoryId;
  label: string;
  /** Card and filter identity. Resolved through lib/icons.ts. */
  iconKey: IconKey;
  /** Shown under the tab when it is selected. */
  description: string;
  /** Topic areas offered for roles in this category. */
  topics: string[];
  /**
   * What a good candidate in this family is actually assessed on. Folded into
   * the interviewer's system instruction, which is what makes the selected role
   * change the questions rather than merely appear in them.
   */
  focus: string;
}

export interface RoleSearchResult {
  role: string;
  roleId: string;
  categoryId: string;
  categoryLabel: string;
  subcategory: string;
  /** Set when the query matched an alias rather than the name, for the UI hint. */
  matchedAlias?: string;
}
