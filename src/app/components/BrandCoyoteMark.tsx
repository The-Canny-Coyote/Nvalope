/**
 * Wolf glyph used as the brand mark. Screen readers typically
 * announce 🐺 as "wolf"; pair with sr-only text or use {@link BRAND_COYOTE_A11Y} in labels.
 */

export const BRAND_COYOTE_A11Y = "Canny Coyote Labs";

type BrandCoyoteMarkProps = {
  className?: string;
  /**
   * When true, only hides the glyph from the accessibility tree (no sr-only).
   * Use when visible text already names the brand (e.g. a footer trademark line).
   */
  decorativeOnly?: boolean;
};

export function BrandCoyoteMark({ className, decorativeOnly = false }: BrandCoyoteMarkProps) {
  return (
    <>
      <span className={className} aria-hidden>
        🐺
      </span>
      {!decorativeOnly ? <span className="sr-only">{BRAND_COYOTE_A11Y}</span> : null}
    </>
  );
}

/** Suffix for control labels tied to Cache / brand mascot (comma + brand name). */
export function brandCoyoteLabelSuffix(): string {
  return `, ${BRAND_COYOTE_A11Y}`;
}
