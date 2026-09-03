/**
 * The extra detail a visa practice report carries, beneath the shared score
 * breakdown every interview type renders.
 *
 * Every section is optional and every list is rendered only when it has
 * entries: an empty "Contradictions detected" heading reads as a finding in
 * itself, and a model that correctly found none should not leave one behind.
 *
 * The closing note is not decoration. This tool rehearses a high-stakes,
 * expensive process, and it must be unambiguous on every screen that shows a
 * score that no simulation can predict a real decision.
 */

interface Props {
  visa: VisaFeedbackDetail;
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

const SimpleList = ({ title, items }: { title: string; items: string[] }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3>{title}</h3>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

const VisaFeedbackReport = ({ visa }: Props) => (
  <>
    <AnswerNotes
      title="Strong answers"
      description="These were clear, specific and credible."
      notes={visa.strongAnswers}
    />

    <AnswerNotes
      title="Answers to work on"
      description="An officer would most likely have pushed back on these."
      notes={visa.weakAnswers}
    />

    <AnswerNotes
      title="Answers that ran long"
      description="Visa interviews are short. Say the essential thing first."
      notes={visa.tooLongAnswers}
    />

    <AnswerNotes
      title="Answers that were too vague"
      description="Specifics — names, dates, amounts, places — carry far more weight."
      notes={visa.tooVagueAnswers}
    />

    <SimpleList title="Inconsistencies to resolve" items={visa.contradictions} />
    <SimpleList title="Questions you struggled with" items={visa.struggledWith} />

    {visa.suggestedAnswers?.length > 0 && (
      <div className="flex flex-col gap-3">
        <div>
          <h3>Stronger ways to answer</h3>
          <p className="text-sm text-light-100">
            Rewrites based on what you actually said. Adapt them to your own
            situation rather than memorising them — a rehearsed-sounding answer is
            one of the things an officer notices.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {visa.suggestedAnswers.map((entry, index) => (
            <li key={index} className="rounded-2xl bg-dark-200/60 p-4">
              <p className="text-sm font-semibold text-primary-200">{entry.question}</p>
              <p className="mt-1 text-sm">{entry.suggestion}</p>
            </li>
          ))}
        </ul>
      </div>
    )}

    <SimpleList title="What to practise next" items={visa.practiceAreas} />

    {visa.readiness && (
      <div className="flex flex-col gap-3">
        <h3>How prepared you sound</h3>
        <p>{visa.readiness}</p>
      </div>
    )}

    {visa.nextRecommendation && (
      <div className="flex flex-col gap-3">
        <h3>Recommended next session</h3>
        <p>{visa.nextRecommendation}</p>
      </div>
    )}

    <p className="rounded-2xl border border-primary-200/40 bg-dark-200/60 p-4 text-sm text-light-100">
      This is practice feedback on how you answered, and nothing more. This tool
      is not connected to any embassy, consulate or government, and no simulation
      can tell you how a real visa application would be decided.
    </p>
  </>
);

export default VisaFeedbackReport;
