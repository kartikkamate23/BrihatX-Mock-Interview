import { redirect } from "next/navigation";

import InterviewSession from "@/components/InterviewSession";

import { getInterviewById } from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewAccess } from "@/lib/actions/plan.action";
import { DEFAULT_INTERVIEWER_ID } from "@/lib/interview-config";
import {
  getInterviewTypeDefinition,
  resolveInterviewType,
} from "@/lib/interview-types";
import InterviewIcon from "@/components/InterviewIcon";
import DisplayTechIcons from "@/components/DisplayTechIcons";

const InterviewDetails = async ({ params }: RouteParams) => {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const interview = await getInterviewById(id);
  if (!interview) redirect("/");

  // Feedback is not read here: finalizeInterviewSession writes exactly one
  // feedback document per (interview, user), so there is no id for this page to
  // thread through in order to keep it that way.
  const access = await getInterviewAccess();

  // Interviews created before the setup wizard existed carry neither topics nor
  // an interviewer. Falling back to the tech stack and the default persona keeps
  // those records runnable rather than stranding them.
  const topics =
    interview.topics && interview.topics.length > 0
      ? interview.topics
      : (interview.techstack ?? []);

  const interviewType = resolveInterviewType(interview.interviewType);
  const definition = getInterviewTypeDefinition(interviewType);
  const isVisa = interviewType === "visa";
  const heading = isVisa
    ? (interview.visaTypeLabel ?? interview.role)
    : `${interview.role} Interview`;

  return (
    <>
      <div className="flex flex-row gap-4 justify-between">
        <div className="flex flex-row gap-4 items-center max-sm:flex-col">
          <div className="flex flex-row gap-4 items-center">
            <InterviewIcon
              interview={{
                interviewType,
                role: interview.role,
                roleCategory: interview.roleCategory,
                iconKey: interview.iconKey,
              }}
              size={20}
            />
            <div className="flex flex-col">
              {isVisa && (
                <span className="text-xs uppercase tracking-wide text-primary-200">
                  {definition.cardLabel}
                </span>
              )}
              <h3 className="capitalize">{heading}</h3>
            </div>
          </div>

          {!isVisa && <DisplayTechIcons techStack={interview.techstack} />}
        </div>

        <p className="bg-dark-200 px-4 py-2 rounded-lg h-fit">
          {isVisa ? (interview.destination ?? "Visa practice") : interview.type}
        </p>
      </div>

      <InterviewSession
        userName={user.name}
        userId={user.id}
        interviewId={id}
        interviewType={interviewType}
        role={heading}
        topics={topics}
        experienceLevel={interview.level}
        interviewerId={interview.interviewerId ?? DEFAULT_INTERVIEWER_ID}
        savedDurationSeconds={interview.durationSeconds ?? 300}
        resumeFileName={interview.resumeFileName}
        visaTypeLabel={interview.visaTypeLabel}
        destination={interview.destination}
        visaMode={interview.visaMode}
        profileImage={user.profileURL}
        access={access}
      />
    </>
  );
};

export default InterviewDetails;
