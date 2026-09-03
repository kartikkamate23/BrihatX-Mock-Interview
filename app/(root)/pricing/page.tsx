import { redirect } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewAccess } from "@/lib/actions/plan.action";
import { PLANS, PLAN_ORDER, formatPrice, getPlan } from "@/lib/plans";

/**
 * Prices, names and limits all come from lib/plans.ts, which the duration
 * selector and the server-side quota gate also read. There is no second copy to
 * fall out of step with this page.
 */
const Pricing = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const access = await getInterviewAccess();
  const currentPlan = getPlan(user.plan);
  const currentPlanIndex = PLAN_ORDER.indexOf(currentPlan.id);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-200/10 px-3 py-1 text-xs font-semibold text-primary-200">
          <ShieldCheck className="size-3.5" aria-hidden /> Transparent limits
        </span>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Plans built around practice time</h1>
        <p className="max-w-2xl text-light-100">
          Every plan is time-based: a session runs for the length you pick, and
          the AI decides how many questions fit. One interview is one session,
          however many questions it contains.
        </p>
        {access && (
          <p className="text-sm text-primary-200">
            You are on {access.planName}
            {access.limit === null
              ? " · unlimited interviews"
              : ` · ${access.remaining} of ${access.limit} interviews left this month`}
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((id, index) => {
          const plan = PLANS[id];
          const isCurrent = plan.id === currentPlan.id;
          return (
            <article
              key={plan.id}
              className={cn(
                "card-border h-full !w-full",
                isCurrent && "ring-2 ring-primary-200"
              )}
              aria-label={`${plan.name} plan${isCurrent ? ", current plan" : ""}`}
            >
              <div className="dark-gradient flex h-full flex-col gap-5 rounded-2xl p-6">
                <div className="flex flex-col gap-1">
                  {isCurrent && <span className="mb-2 w-fit rounded-full bg-primary-200 px-3 py-1 text-[11px] font-semibold text-dark-100">Current plan</span>}
                  <h3 className="text-primary-100">{plan.name}</h3>
                  <p className="text-2xl font-bold text-white">
                    {formatPrice(plan)}
                  </p>
                  <p className="text-sm text-light-100">
                    {plan.interviewsPerMonth === null
                      ? "Unlimited interviews"
                      : `${plan.interviewsPerMonth} interviews / month`}
                    {" · "}
                    up to {plan.maxSessionMinutes} min per session
                  </p>
                </div>

                <ul className="flex flex-1 flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-light-100"
                    >
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success-100" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <span className="rounded-full bg-dark-200 px-5 py-2 text-center text-sm text-light-100">
                    Active on your account
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-2 text-center text-sm text-light-100">
                    {index > currentPlanIndex
                      ? "Ask your administrator to upgrade"
                      : "Available through your administrator"}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-light-100">
        Plan changes are handled by your account administrator. Interview counts
        reset at the start of each calendar month.
      </p>
    </section>
  );
};

export default Pricing;
