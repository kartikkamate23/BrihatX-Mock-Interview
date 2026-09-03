import {
  Braces,
  BrainCircuit,
  Briefcase,
  Cloud,
  Coins,
  Database,
  Globe,
  GraduationCap,
  HeartPulse,
  Headset,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Megaphone,
  Palette,
  Scale,
  Server,
  Shield,
  ChartColumn,
  SquareCheckBig,
  Truck,
  Users,
  Wrench,
  Package,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { iconKeyForInterview, type StoredInterviewShape } from "@/lib/icons";

/**
 * The visual identity of an interview.
 *
 * Every icon here is derived from what the interview *is* -- its type, or the
 * category of the role it practises. Nothing about it is chosen at render time.
 *
 * The previous behaviour picked a company logo with `Math.random()` inside the
 * card component, so an interview showed a different brand on every render and
 * on every refresh, and a Visa Interview could show a Spotify logo. Those logos
 * also implied an association with companies this product has nothing to do
 * with. Deriving the icon from the record means the same interview always looks
 * the same, and the icon says something true about it.
 */
const ICONS: Record<string, LucideIcon> = {
  code: Braces,
  layout: LayoutDashboard,
  server: Server,
  database: Database,
  chart: ChartColumn,
  brain: BrainCircuit,
  cloud: Cloud,
  shield: Shield,
  test: SquareCheckBig,
  product: Package,
  design: Palette,
  megaphone: Megaphone,
  coin: Coins,
  users: Users,
  briefcase: Briefcase,
  scale: Scale,
  heart: HeartPulse,
  graduation: GraduationCap,
  truck: Truck,
  headset: Headset,
  wrench: Wrench,
  globe: Globe,
  message: MessageSquare,
};

const FALLBACK: LucideIcon = Briefcase;

interface Props {
  interview: StoredInterviewShape;
  /** Pixel size of the glyph. The surrounding badge scales with it. */
  size?: number;
  className?: string;
}

/**
 * Renders an interview's icon inside a subtle badge.
 *
 * `aria-hidden` throughout: the card already names the interview in text, and a
 * second announcement of the same thing is noise to a screen reader.
 */
const InterviewIcon = ({ interview, size = 20, className }: Props) => {
  const key = iconKeyForInterview(interview);
  const Glyph = ICONS[key] ?? FALLBACK;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-dark-200 text-primary-200",
        className
      )}
      style={{ width: size * 2, height: size * 2 }}
    >
      <Glyph size={size} strokeWidth={1.75} />
    </span>
  );
};

export default InterviewIcon;
