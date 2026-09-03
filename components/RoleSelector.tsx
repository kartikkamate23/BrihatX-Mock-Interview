"use client";

import { useDeferredValue, useEffect, useId, useMemo, useState } from "react";

import {
  ALL_ROLE_ENTRIES,
  MAX_ROLE_LENGTH,
  POPULAR_ROLE_ENTRIES,
  ROLE_CATEGORIES,
  SUGGESTED_ROLES,
  rolesInCategory,
  sanitiseRoleName,
  searchRoles,
  type RoleCategoryId,
  type RoleSearchResult,
} from "@/lib/roles";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (role: string) => void;
}

/** Curated views come first; the rest are the catalogue's own categories. */
type Tab = "suggested" | "popular" | "all" | RoleCategoryId;

const RECENT_KEY = "prepwise.recentRoles";
const MAX_RECENT = 6;
const ALL_ROLES_PAGE_SIZE = 72;

/**
 * Reads the roles this browser has picked before.
 *
 * Wrapped because storage access throws outright in a few contexts -- a private
 * window with site data blocked, or a page being screenshotted -- and a
 * convenience feature must never be the reason the setup screen fails to render.
 */
function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const unique = new Map<string, string>();
    for (const item of parsed) {
      if (typeof item !== "string") continue;
      const role = sanitiseRoleName(item);
      if (role.length < 2) continue;
      const identity = role.toLocaleLowerCase();
      if (!unique.has(identity)) unique.set(identity, role);
      if (unique.size === MAX_RECENT) break;
    }
    return [...unique.values()];
  } catch {
    return [];
  }
}

function rememberRole(role: string) {
  try {
    const next = [role, ...readRecent().filter((r) => r !== role)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // A remembered list is a nicety; losing it costs nothing.
  }
}

/**
 * Picks the role an interview practises for.
 *
 * The catalogue runs to several hundred roles, which is far too many to render
 * as buttons -- so the default view is a search box plus a small suggested set,
 * and the rest is reachable by category tab. Search is the primary path and the
 * tabs are the fallback, which is the opposite of how a short list works.
 *
 * Whatever is typed is always usable as-is. The catalogue cannot anticipate
 * every job title, and refusing an unlisted one would be worse than accepting
 * it, so a non-matching entry is offered as a custom role rather than rejected.
 */
const RoleSelector = ({ value, onChange }: Props) => {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("suggested");
  const [visibleAllRoles, setVisibleAllRoles] = useState(ALL_ROLES_PAGE_SIZE);
  const listId = useId();
  const tabIds = useMemo(
    () =>
      (["suggested", "popular", "all", ...ROLE_CATEGORIES.map((category) => category.id)] as Tab[]),
    []
  );

  // Search runs over the whole catalogue on each keystroke. Deferring it keeps
  // typing responsive on a slow machine by letting React drop intermediate
  // results rather than queueing a render for every character.
  const deferredQuery = useDeferredValue(query);
  const searchPending = deferredQuery !== query;

  // Read in an effect, not during render: localStorage does not exist while the
  // server renders this, so reading it during render would make the first client
  // render disagree with the server's markup and trip a hydration error.
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const trimmed = sanitiseRoleName(query);
  const searching = trimmed.length > 0;

  const results: RoleSearchResult[] = useMemo(
    () => (searching ? searchRoles(deferredQuery, 60) : []),
    [deferredQuery, searching]
  );

  /** The roles shown when nothing has been typed: the selected tab's contents. */
  const browsing = useMemo(() => {
    if (tab === "suggested") {
      return SUGGESTED_ROLES.map((role) => ({
        role: role.name,
        roleId: role.id,
        subcategory: role.subcategory,
      }));
    }
    if (tab === "popular") {
      return POPULAR_ROLE_ENTRIES.map((role) => ({
        role: role.name,
        roleId: role.id,
        subcategory: role.subcategory,
      }));
    }
    if (tab === "all") {
      return ALL_ROLE_ENTRIES.slice(0, visibleAllRoles).map((role) => ({
        role: role.name,
        roleId: role.id,
        subcategory: role.subcategory,
      }));
    }
    return rolesInCategory(tab).map((role) => ({
      role: role.name,
      roleId: role.id,
      subcategory: role.subcategory,
    }));
  }, [tab, visibleAllRoles]);

  /** Grouped by subcategory, so a 90-role tab is scannable rather than a wall. */
  const grouped = useMemo(() => {
    const groups = new Map<string, string[]>();
    // Recently used roles have their own row in Suggested. Excluding them from
    // the curated row prevents one choice appearing twice in the same view.
    const displayed = new Set(
      tab === "suggested" ? recent.map((role) => role.toLocaleLowerCase()) : []
    );
    for (const entry of browsing) {
      const identity = entry.role.toLocaleLowerCase();
      if (displayed.has(identity)) continue;
      displayed.add(identity);
      const list = groups.get(entry.subcategory) ?? [];
      list.push(entry.role);
      groups.set(entry.subcategory, list);
    }
    return [...groups.entries()];
  }, [browsing, recent, tab]);

  // A typed role that matches nothing in the catalogue is still a valid choice.
  const isCustom =
    trimmed.length >= 2 &&
    !results.some((r) => r.role.toLowerCase() === trimmed.toLowerCase());

  const select = (role: string) => {
    const clean = sanitiseRoleName(role);
    if (clean.length < 2) return;
    onChange(clean);
    setRecent((current) => [clean, ...current.filter((r) => r !== clean)].slice(0, MAX_RECENT));
    rememberRole(clean);
  };

  const chip = (role: string, key: string, hint?: string) => (
    <button
      key={key}
      type="button"
      onClick={() => select(role)}
      aria-pressed={value === role}
      title={hint}
      className={cn(
        "min-h-11 rounded-full px-4 py-2 text-left text-sm transition-colors motion-reduce:transition-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200",
        value === role
          ? "bg-primary-200 font-semibold text-dark-100"
          : "bg-dark-200 text-light-100 hover:bg-dark-300"
      )}
    >
      {role}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${listId}-search`} className="text-sm text-light-100">
          Search hundreds of roles or type your own
        </label>
        <input
          id={`${listId}-search`}
          type="search"
          role="combobox"
          aria-expanded={searching}
          aria-controls={`${listId}-results`}
          aria-describedby={`${listId}-hint`}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter commits the top result, or the typed text when nothing
            // matched, so a custom title never needs the mouse.
            if (event.key === "Enter" && trimmed.length >= 2) {
              event.preventDefault();
              const deferredTrimmed = sanitiseRoleName(deferredQuery);
              select(deferredTrimmed === trimmed ? (results[0]?.role ?? trimmed) : trimmed);
            }
          }}
          placeholder="Search for a role…"
          maxLength={MAX_ROLE_LENGTH}
          className="w-full rounded-full bg-dark-200 px-5 py-3 text-sm text-white placeholder:text-light-100/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
        />
        <p id={`${listId}-hint`} className="text-xs text-light-100/70">
          Try “AI”, “ML”, “GenAI”, “LLM”, “Agentic”, “React”, “Kubernetes” — or type
          any job title.
        </p>
        <p className="sr-only" role="status" aria-live="polite">
          {searchPending ? "Searching roles" : searching ? `${results.length} roles found` : ""}
        </p>
      </div>

      {value && (
        <p className="text-sm text-light-100">
          Selected: <span className="font-semibold text-primary-200">{value}</span>
        </p>
      )}

      {/* Category tabs. Hidden while searching, because search already spans
          every category and a filter that narrows results the user did not ask
          to narrow is a trap. */}
      {!searching && (
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Browse roles by category"
        >
          {(
            ([
              ["suggested", "Suggested"],
              ["popular", "Popular"],
              ["all", "All roles"],
            ] as [Tab, string][]).concat(
              ROLE_CATEGORIES.map((c) => [c.id, c.label] as [Tab, string])
            )
          ).map(([id, label]) => (
            <button
              key={id}
              id={`${listId}-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${listId}-results`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => {
                setTab(id);
                if (id === "all") setVisibleAllRoles(ALL_ROLES_PAGE_SIZE);
              }}
              onKeyDown={(event) => {
                const current = tabIds.indexOf(id);
                const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                if (!delta) return;
                event.preventDefault();
                const next = tabIds[(current + delta + tabIds.length) % tabIds.length];
                setTab(next);
                document.getElementById(`${listId}-tab-${next}`)?.focus();
              }}
              className={cn(
                "min-h-11 rounded-full px-4 py-1.5 text-xs transition-colors motion-reduce:transition-none",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200",
                tab === id
                  ? "bg-primary-200 font-semibold text-dark-100"
                  : "bg-dark-200 text-light-100 hover:bg-dark-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div
        id={`${listId}-results`}
        role={searching ? "region" : "tabpanel"}
        aria-label={searching ? "Role search results" : undefined}
        aria-labelledby={searching ? undefined : `${listId}-tab-${tab}`}
        className="flex flex-col gap-4"
        aria-busy={searchPending}
      >
        {isCustom && (
          <button
            type="button"
            onClick={() => select(trimmed)}
            className="rounded-2xl border-2 border-dashed border-primary-200/50 px-4 py-3 text-left text-sm text-light-100 hover:border-primary-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
          >
            Can’t find your role? Use <span className="font-semibold text-primary-200">“{trimmed}”</span> as a
            custom role
          </button>
        )}

        {searching ? (
          results.length === 0 ? (
            <p className="text-sm text-light-100">
              No roles match “{trimmed}”. You can still use it as a custom role above.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-wide text-light-100/70">
                {results.length} matching
              </p>
              <div className="flex flex-wrap gap-2">
                {results.map((result) =>
                  chip(
                    result.role,
                    result.roleId,
                    // Explains why a result appeared when the query matched an
                    // abbreviation rather than the title itself.
                    result.matchedAlias
                      ? `${result.categoryLabel} · matched “${result.matchedAlias}”`
                      : `${result.categoryLabel} · ${result.subcategory}`
                  )
                )}
              </div>
            </div>
          )
        ) : (
          <>
            {recent.length > 0 && tab === "suggested" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-wide text-light-100/70">
                  Recently used
                </p>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => chip(r, `recent-${r}`))}
                </div>
              </div>
            )}

            {tab !== "suggested" && tab !== "popular" && tab !== "all" && (
              <p className="text-xs text-light-100/70">
                {ROLE_CATEGORIES.find((c) => c.id === tab)?.description}
              </p>
            )}

            {grouped.map(([subcategory, roles]) => (
              <div key={subcategory} className="flex flex-col gap-2">
                {tab !== "suggested" && (
                  <p className="text-xs uppercase tracking-wide text-light-100/70">
                    {subcategory}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {roles.map((r) => chip(r, `${tab}-${r}`))}
                </div>
              </div>
            ))}
            {tab === "all" && visibleAllRoles < ALL_ROLE_ENTRIES.length && (
              <button
                type="button"
                onClick={() =>
                  setVisibleAllRoles((current) =>
                    Math.min(current + ALL_ROLES_PAGE_SIZE, ALL_ROLE_ENTRIES.length)
                  )
                }
                className="self-start rounded-full bg-dark-200 px-5 py-2 text-sm text-primary-200 hover:bg-dark-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200"
              >
                Show more roles ({ALL_ROLE_ENTRIES.length - visibleAllRoles} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RoleSelector;
