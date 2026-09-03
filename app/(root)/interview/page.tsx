import { redirect } from "next/navigation";

import InterviewSetupWizard from "@/components/InterviewSetupWizard";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewAccess } from "@/lib/actions/plan.action";
import { resolveInterviewType } from "@/lib/interview-types";

interface PageProps {
  searchParams: Promise<{ type?: string | string[] }>;
}

const Page = async ({ searchParams }: PageProps) => {
  const user = await getCurrentUser();
  // Layouts and pages render in parallel, so guard here rather than relying on
  // the layout's redirect to stop an unauthenticated render.
  if (!user) redirect("/sign-in");

  const [access, params] = await Promise.all([getInterviewAccess(), searchParams]);
  const requestedType = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialType = resolveInterviewType(requestedType);

  return (
    <>
      <h3>Set up your interview</h3>
      <p className="max-w-2xl text-sm text-light-100">
        Choose the role, the topics, your experience level, and who interviews
        you. The interview is timed: it runs for the length you pick and your
        interviewer decides how many questions fit.
      </p>

      <InterviewSetupWizard access={access} initialType={initialType} />
    </>
  );
};

export default Page;
