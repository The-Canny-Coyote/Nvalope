/**
 * Shared Tailwind className constants for common UI patterns.
 * Use these instead of repeating long class strings across components.
 *
 * Usage:
 *   import { inputCls, inputMonoCls, selectCls } from '@/app/utils/classNames';
 *   <input className={inputCls} ... />
 */

/** Standard text input field. */
export const inputCls =
  'w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

/** Monospace text input field (amounts, dates). */
export const inputMonoCls =
  'w-full px-3 py-2 border border-primary/30 rounded-lg bg-card text-foreground text-sm font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

/** Compact (px-2 py-1) text input. */
export const inputSmCls =
  'px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

/** Compact monospace input (amounts in dense rows). */
export const inputSmMonoCls =
  'px-2 py-1 border border-primary/30 rounded text-sm bg-card text-foreground font-mono focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

/** Standard select element. */
export const selectCls =
  'rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** Form field label. */
export const labelCls = 'block text-sm font-medium text-foreground mb-1';

/** Form field label (semibold variant). */
export const labelSemiboldCls = 'block text-sm font-semibold text-foreground';

/** Inline text link style. */
export const linkCls =
  'text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/** Small card / list item container. */
export const cardItemCls = 'min-w-0 rounded-lg border border-primary/20 bg-card p-3';

/** Square icon button container. */
export const iconContainerCls =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary';
