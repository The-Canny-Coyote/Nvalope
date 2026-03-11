/**
 * About The Canny Coyote: the why behind the name and how we build Nvalope.
 * Shown from the footer "About" link.
 */

export function AboutContent() {
  return (
    <div className="space-y-4 text-sm text-foreground">
      <p className="leading-relaxed">
        <strong>The Canny Coyote</strong> is the name behind Nvalope and the products we make. We chose it to reflect how we build software and what we care about.
      </p>

      <div className="space-y-2">
        <p className="leading-relaxed">
          <strong>Canny</strong> means careful, clear, and principled. We’re deliberate about your data: we don’t collect it, track you, or sell it. We explain what we do in plain language and avoid dark patterns. What you see is what you get.
        </p>
        <p className="leading-relaxed">
          <strong>Coyote</strong> is adaptable and resilient—it thrives in many environments without depending on a big infrastructure. In the same way, Nvalope runs on your device, works offline, and puts you in control. We don’t need to lock you in or hold your budget hostage to keep the lights on.
        </p>
      </div>

      <p className="leading-relaxed">
        We build Nvalope so your budget stays yours. Optional features stay optional; support (like donations) is voluntary. We’d rather be the careful, adaptable companion in the background than a company that treats you as the product.
      </p>

      <p className="text-muted-foreground text-xs leading-relaxed">
        For more on our principles and terms, see the Glossary and our Privacy and Terms pages.
      </p>
    </div>
  );
}
