/**
 * The site's moving background.
 *
 * Rendered once from the root layout and pinned behind every page. Purely
 * decorative, so it is hidden from assistive technology and never intercepts
 * pointer events.
 *
 * The orbs are radial gradients rather than blurred boxes: `filter: blur()`
 * over a viewport-sized element forces a large offscreen buffer on every
 * frame, which is a poor trade on low-memory machines. A gradient is soft for
 * free. Only `transform` is animated, so the whole layer stays on the
 * compositor and never triggers layout or paint.
 */
const AuroraBackground = () => (
  <div className="aurora" aria-hidden="true">
    <span className="aurora-orb aurora-orb-1" />
    <span className="aurora-orb aurora-orb-2" />
    <span className="aurora-orb aurora-orb-3" />
    <span className="aurora-grid" />
  </div>
);

export default AuroraBackground;
