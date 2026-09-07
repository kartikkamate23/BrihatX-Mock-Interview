import Link from "next/link";

export default function TermsAndConditionsPage() {
  return (
    <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-200">BrihatX practice policy</p>
      <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">Terms and Conditions</h1>
      <div className="mt-8 space-y-6 text-sm leading-7 text-light-100">
        <section><h2 className="text-xl text-white">Practice service</h2><p className="mt-2">BrihatX provides simulated AI interviews and communication practice for educational purposes. Scores and feedback are guidance, not hiring, immigration, or professional decisions.</p></section>
        <section><h2 className="text-xl text-white">Camera and microphone</h2><p className="mt-2">Live camera and microphone access is required during a session. Camera checks run locally in your browser to identify framing, visibility, and attention conditions. Video is not recorded or uploaded by this feature.</p></section>
        <section><h2 className="text-xl text-white">Your responsibility</h2><p className="mt-2">Use the service lawfully, provide no sensitive personal identifiers during practice, and make sure your environment and device permissions are appropriate before starting.</p></section>
        <section><h2 className="text-xl text-white">AI limitations</h2><p className="mt-2">AI responses and feedback can be incomplete or incorrect. Review important advice independently and do not treat generated output as a guarantee of interview performance.</p></section>
      </div>
      <Link href="/interview?type=communication" className="btn-primary mt-9 px-6 text-sm">Return to practice setup</Link>
    </article>
  );
}
