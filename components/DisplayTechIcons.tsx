import Image from "next/image";

import { cn, getTechLogos } from "@/lib/utils";

/**
 * Tech-stack chips on an interview card.
 *
 * This must stay synchronous. `getTechLogos` used to be async (a HEAD request
 * per icon), and this component was `async` to match. InterviewCard is rendered
 * inside the client-side InterviewList, so an async child becomes an async
 * Client Component, which Next.js 15 rejects.
 *
 * The catalogue is now resolved in-process, so there is nothing to await.
 * Keeping this a plain function means the same module can render from the
 * server interview page and from the client dashboard list.
 */
const DisplayTechIcons = ({ techStack }: TechIconProps) => {
  const techIcons = getTechLogos(techStack ?? []);
  if (techIcons.length === 0) return null;

  return (
    <div className="flex flex-row">
      {techIcons.slice(0, 3).map(({ tech, url }, index) => (
        <div
          key={tech}
          className={cn(
            "relative group bg-dark-300 rounded-full p-2 flex flex-center",
            index >= 1 && "-ml-3"
          )}
        >
          <span className="tech-tooltip">{tech}</span>

          <Image
            src={url}
            alt={tech}
            width={100}
            height={100}
            className="size-5"
          />
        </div>
      ))}
    </div>
  );
};

export default DisplayTechIcons;
