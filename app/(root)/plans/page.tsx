import { redirect } from "next/navigation";

/** Keep older /plans links working without duplicating the pricing page. */
export default function PlansAlias() {
  redirect("/pricing");
}
