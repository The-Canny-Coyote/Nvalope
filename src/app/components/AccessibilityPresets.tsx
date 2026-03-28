import type { AccessibilityMode } from '@/app/components/accessibilityMode';

export type AccessibilityPresetsProps = {
  selectedMode: AccessibilityMode;
  setSelectedMode: (mode: AccessibilityMode) => void;
  onPresetApplied?: () => void;
};

export function AccessibilityPresets({ selectedMode, setSelectedMode, onPresetApplied }: AccessibilityPresetsProps) {
  return (
    <>
        <div className="flex items-center gap-1.5 mb-2">
          <h3 id="preset-modes-heading" className="text-lg text-primary">
            Preset modes
          </h3>
        </div>
        <p id="preset-modes-desc" className="text-sm text-muted-foreground mb-4">
          Each mode applies a different set of visual and interaction options. Click a mode to turn it on; click again to disable. Text size,
          line height, and letter spacing sliders above still apply so you can refine any preset.
        </p>

        <div className="space-y-3">
          {(
            [
              {
                id: 'focus' as const,
                emoji: '⚡',
                title: 'Focus Mode',
                subtitle: 'Minimize distractions, one task at a time',
                bullets: [
                  'No animations or flashing; secondary UI hidden',
                  'List of sections for clear navigation; one task at a time',
                  'Stronger focus indicators and bold headings',
                ],
                ariaLabel: 'Focus Mode',
              },
              {
                id: 'calm' as const,
                emoji: '🧘',
                title: 'Calm Mode',
                subtitle: 'Muted colors and extra space',
                bullets: [
                  'Muted colors (40% desaturation)',
                  'Extra whitespace & breathing room',
                  'No animations or sudden movements',
                  'Softer visual appearance',
                ],
                ariaLabel: 'Calm Mode',
              },
              {
                id: 'clear' as const,
                emoji: '📖',
                title: 'Clear Mode',
                subtitle: 'Readability and typography',
                bullets: [
                  'Readability-focused sans-serif (Verdana, Arial); no ligatures',
                  'Min 16px; letter-spacing 0.12em+, word-spacing 0.16em+',
                  'Line height 1.5–1.8×; paragraph spacing 2× font size',
                  'High-contrast cream background (4.5:1); optional Read aloud',
                ],
                ariaLabel: 'Clear Mode',
              },
              {
                id: 'contrast' as const,
                emoji: '💪',
                title: 'Maximum Contrast',
                subtitle: 'High contrast and bold borders',
                bullets: [
                  'Very high contrast',
                  'Bold 3px borders everywhere',
                  'Large 4px focus indicators',
                  '125% larger text size',
                ],
                ariaLabel: 'Maximum Contrast',
              },
              {
                id: 'tactile' as const,
                emoji: '👆',
                title: 'Tactile',
                subtitle: 'Touch-friendly and easy to tap',
                bullets: [
                  'Larger tap targets (min 48px) for fingers and styli',
                  'Extra padding on buttons, inputs, and controls',
                  'Rounded, graspable feel—borders and spacing that suit touch',
                  'Works great on phones and tablets',
                ],
                ariaLabel: 'Tactile Mode',
              },
            ] as const
          ).map(({ id, emoji, title, subtitle, bullets, ariaLabel }) => (
            <button
              key={id}
              onClick={() => {
                const next = selectedMode === id ? 'standard' : id;
                setSelectedMode(next);
                if (next !== 'standard') onPresetApplied?.();
              }}
              className={`w-full min-w-0 break-words p-4 border-2 rounded-lg text-left transition-all ${
                selectedMode === id
                  ? 'border-primary bg-primary/20 shadow-lg'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
              aria-pressed={selectedMode === id}
              aria-label={
                selectedMode === id ? `${ariaLabel} is on; click to turn off` : `${ariaLabel}; click to turn on`
              }
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden>
                  {emoji}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">{title}</h4>
                    {selectedMode === id && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                    {bullets.map((b) => (
                      <li key={b}>• {b}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          ))}
        </div>
    </>
  );
}
