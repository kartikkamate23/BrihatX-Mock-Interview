import { interviewCovers, mappings } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const techIconBaseURL = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons";

const normalizeTechName = (tech: string) => {
  const key = tech.toLowerCase().replace(/\.js$/, "").replace(/\s+/g, "");
  return mappings[key as keyof typeof mappings];
};

/**
 * Resolves display URLs without doing network work during render.
 *
 * This helper is consumed by both Server and Client Components. Keeping it
 * synchronous is important: InterviewCard is rendered inside the client-side
 * filterable InterviewList, and an async component below that boundary is not
 * supported by React/Next.js. The catalogue is curated, so an unknown label can
 * deterministically use the local fallback instead of issuing one HEAD request
 * per icon on every render.
 */
export const getTechLogos = (techArray: string[]) => {
  return techArray.map((tech) => {
    const normalized = normalizeTechName(tech);
    return {
      tech,
      url: normalized
        ? `${techIconBaseURL}/${normalized}/${normalized}-original.svg`
        : "/tech.svg",
    };
  });
};

export const getRandomInterviewCover = () => {
  const randomIndex = Math.floor(Math.random() * interviewCovers.length);
  return `/covers${interviewCovers[randomIndex]}`;
};
