/**
 * The extra detail a resume interview report carries, beneath the shared score
 * breakdown every interview type renders.
 *
 * Every section is optional and rendered only when it has entries: an empty
 * "Answers to work on" heading reads as a finding in itself.
 *
 * The wording throughout is about the *answers*, never about the candidate's
 * honesty. An interview can observe that a claim was thinly explained; it cannot
 * know whether the claim was true, and saying otherwise would be both wrong and
 * unkind.
 */

interface Props {
  resume: ResumeFeedbackDetail;
}

const AnswerNotes = ({
  title,
  description,
  notes,
}: {
  title: string;
  description: string;
  notes: { question: string; note: string }[];
}) => {
  if (!notes || notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3>{title}</h3>
        <p className="text-sm text-light-100">{description}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {notes.map((entry, index) => (
          <li key={index} className="rounded-2xl bg-dark-200/60 p-4">
            <p className="text-sm font-semibold text-primary-200">{entry.question}</p>
            <p className="mt-1 text-sm">{entry.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const SimpleList = ({
  title,
  description,
  items,
}: {
  title: string;
  description?: string;
  items: string[];
}) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3>{title}</h3>
        {description && <p className="text-sm text-light-100">{description}</p>}
      </div>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

const ResumeFeedbackReport = ({ resume }: Props) => (
  <>
    <AnswerNotes
      title="Answers that landed"
      description="Specific, concrete, and backed by detail only someone who did the work would have."
      notes={resume.strongAnswers}
    />

    <AnswerNotes
      title="Answers to work on"
      description="An interviewer would have pushed further on these. Usually the fix is a concrete detail: a number, a name, a decision you made."
      notes={resume.weakAnswers}
    />

    <SimpleList
      title="Missed opportunities"
      description="Things on your resume you could have brought into an answer but did not."
      items={resume.missedOpportunities}
    />

    {resume.suggestedAnswers?.length > 0 && (
      <div className="flex flex-col gap-3">
        <div>
          <h3>Stronger ways to answer</h3>
          <p className="text-sm text-light-100">
            Rewrites based on your own experience. Adapt them rather than
            memorising them — a rehearsed answer is easy to spot.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {resume.suggestedAnswers.map((entry, index) => (
            <li key={index} className="rounded-2xl bg-dark-200/60 p-4">
              <p className="text-sm font-semibold text-primary-200">{entry.question}</p>
              <p className="mt-1 text-sm">{entry.suggestion}</p>
            </li>
          ))}
        </ul>
      </div>
    )}

    <SimpleList
      title="Topics to revise"
      items={resume.studyTopics}
    />

    <SimpleList
      title="Changes to your resume"
      description="About the document, not the interview: claims that need evidence attached, and strengths you are underselling."
      items={resume.resumeRecommendations}
    />

    {resume.targetRoleGap && (
      <div className="flex flex-col gap-3">
        <h3>How your background fits the role you targeted</h3>
        <p>{resume.targetRoleGap}</p>
      </div>
    )}
  </>
);

export default ResumeFeedbackReport;
