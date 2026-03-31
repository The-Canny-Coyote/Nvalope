import { Checkbox } from '@/app/components/ui/checkbox';
import { useAppStore } from '@/app/store/appStore';

function ColorblindModeToggle() {
  const colorblindMode = useAppStore((s) => s.colorblindMode);
  const setColorblindMode = useAppStore((s) => s.setColorblindMode);

  const options = [
    { value: 'none' as const, label: 'None' },
    { value: 'deuteranopia' as const, label: 'Deuteranopia / Protanopia', note: 'Most common — affects red-green distinction' },
    { value: 'tritanopia' as const, label: 'Tritanopia', note: 'Affects blue-yellow distinction' },
    { value: 'monochromacy' as const, label: 'Monochromacy', note: 'Full grayscale vision' },
  ] as const;

  return (
    <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
      <span className="text-sm font-medium text-foreground block">Color vision</span>
      <p className="text-xs text-muted-foreground mt-0.5 mb-3">
        Replaces the app color scheme for common types of color vision deficiency.
      </p>
      <div className="flex flex-col gap-2" role="group" aria-label="Color vision mode">
        {options.map(({ value, label, note }) => (
          <button
            key={value}
            type="button"
            onClick={() => setColorblindMode(value)}
            className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border-2 text-left ${
              colorblindMode === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
            }`}
            aria-pressed={colorblindMode === value}
          >
            {label}
            {'note' in { value, label, note } && note && (
              <span className="block font-normal opacity-75 mt-0.5">{note}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function DisplayGridToggle() {
  const showGridBackground = useAppStore((s) => s.showGridBackground);
  const setShowGridBackground = useAppStore((s) => s.setShowGridBackground);
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between rounded-lg border border-primary/20 bg-card p-3">
      <div className="min-w-0 flex flex-1 items-start gap-2">
        <div>
          <span className="text-sm font-medium text-foreground block">Show grid background</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Show a subtle grid behind the main content. Turn off to reduce visual distraction.
          </p>
        </div>
      </div>
      <Checkbox
        checked={showGridBackground}
        onCheckedChange={(c) => setShowGridBackground(c === true)}
        aria-label="Show grid background"
        className="size-5 shrink-0 rounded"
      />
    </div>
  );
}

export type AccessibilityTogglesProps = {
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  screenReaderMode: boolean;
  setScreenReaderMode: (v: boolean) => void;
};

export function AccessibilityToggles({
  reducedMotion,
  setReducedMotion,
  highContrast,
  setHighContrast,
  screenReaderMode,
  setScreenReaderMode,
}: AccessibilityTogglesProps) {
  return (
    <>
      <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">Reduced Motion</span>
            <p className="text-xs text-muted-foreground">Disable animations and transitions</p>
          </div>
          <button
            type="button"
            onClick={() => setReducedMotion(!reducedMotion)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
              reducedMotion
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
            }`}
            aria-pressed={reducedMotion}
            aria-label={
              reducedMotion ? 'Reduced motion on; click to turn off' : 'Reduced motion off; click to turn on'
            }
          >
            {reducedMotion ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">High Contrast</span>
            <p className="text-xs text-muted-foreground">Bold borders and stronger contrast</p>
          </div>
          <button
            type="button"
            onClick={() => setHighContrast(!highContrast)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
              highContrast
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
            }`}
            aria-pressed={highContrast}
            aria-label={
              highContrast ? 'High contrast on; click to turn off' : 'High contrast off; click to turn on'
            }
          >
            {highContrast ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-primary/20 bg-card p-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">Screen Reader Mode</span>
            <p className="text-xs text-muted-foreground">Stronger focus rings and clearer keyboard visibility for assistive tech.</p>
          </div>
          <button
            type="button"
            onClick={() => setScreenReaderMode(!screenReaderMode)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border-2 ${
              screenReaderMode
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
            }`}
            aria-pressed={screenReaderMode}
            aria-label={
              screenReaderMode
                ? 'Screen reader mode on; click to turn off'
                : 'Screen reader mode off; click to turn on'
            }
          >
            {screenReaderMode ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      <DisplayGridToggle />
      <ColorblindModeToggle />
    </>
  );
}
