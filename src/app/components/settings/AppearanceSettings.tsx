import React from 'react';

export interface AppearanceSettingsProps {
  useCardLayout?: boolean;
  setUseCardLayout?: (v: boolean) => void;
}

export function AppearanceSettings({ useCardLayout = false, setUseCardLayout }: AppearanceSettingsProps) {
  if (!setUseCardLayout) return null;

  return useCardLayout ? (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        Using card layout. Switch back to the Feature Wheel to see all sections in a wheel.
      </p>
      <button
        type="button"
        onClick={() => setUseCardLayout(false)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Use Feature Wheel
      </button>
    </div>
  ) : (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        Using the Feature Wheel. Switch to cards to see sections as a card bar.
      </p>
      <button
        type="button"
        onClick={() => setUseCardLayout(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Switch to cards (Or not.)"
      >
        Or not.
      </button>
    </div>
  );
}
