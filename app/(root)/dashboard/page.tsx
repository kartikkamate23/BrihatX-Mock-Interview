import { redirect } from "next/navigation";

/** Backwards-compatible product URL; the dashboard itself remains the root. */
export default function DashboardAlias() {
  redirect("/");
}
