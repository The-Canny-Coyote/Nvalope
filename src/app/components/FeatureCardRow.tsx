/**
 * Shared row of feature cards: one can be "popped up" (selected). Used by
 * desktop card layout. Supports smooth layout
 * when sections change (e.g. enabling more modules).
 */

import { memo } from 'react';
import { motion } from 'motion/react';
import type { AppSection } from '@/app/sections/appSections';
import { clampCardBarScale } from '@/app/constants/accessibility';
import { useAppStore } from '@/app/store/appStore';
import { BrandCoyoteMark, brandCoyoteLabelSuffix } from '@/app/components/BrandCoyoteMark';

const CARD_BASE_HEIGHT_PX = 56;
const POP_UP_PX = 10;
/** Min width so cards wrap instead of horizontal scroll; keeps all features visible. */
const CARD_MIN_WIDTH_PX = 52;
const CARD_MAX_WIDTH_PX = 120;

const SMOOTH_SPRING = { type: 'spring' as const, stiffness: 300, damping: 35 };

export interface FeatureCardRowProps {
  sections: AppSection[];
  selectedSection: number | null;
  onSelectedSectionChange: (id: number | null) => void;
  /** Scale 75–120; controls card height and size. */
  scale: number;
  /** When true, use slightly larger cards (desktop inline). */
  inline?: boolean;
  /** Called when user taps a card (first meaningful action). */
  onUserAction?: () => void;
}

function FeatureCardRowComponent({
  sections,
  selectedSection,
  onSelectedSectionChange,
  scale,
  inline = false,
  onUserAction,
}: FeatureCardRowProps) {
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const selectedMode = useAppStore((state) => state.selectedMode);
  const noMotion = reducedMotion || selectedMode === 'calm';
  const s = clampCardBarScale(scale) / 100;
  const cardHeightPx = Math.round(CARD_BASE_HEIGHT_PX * (inline ? Math.min(1.1, s) : s));
  /** Cards use flex to share row width and wrap when needed so no horizontal scroll. */
  const cardMinWidthPx = CARD_MIN_WIDTH_PX;
  const cardMaxWidthPx = Math.min(
    CARD_MAX_WIDTH_PX,
    Math.max(CARD_MIN_WIDTH_PX, Math.round((inline ? 88 : 80) * s))
  );

  const handleClick = (id: number) => {
    onUserAction?.();
    if (selectedSection === id) {
      onSelectedSectionChange(null);
    } else {
      onSelectedSectionChange(id);
    }
  };

  return (
    <motion.div
      className="flex flex-wrap gap-2 py-1 px-2 w-full max-w-full justify-center"
      style={{ minHeight: cardHeightPx + 16 }}
      layout={!noMotion}
      transition={noMotion ? { duration: 0 } : SMOOTH_SPRING}
      role="tablist"
      aria-label="Feature shortcuts"
    >
      {sections.map((section) => {
        const Icon = section.icon;
        const isSelected = selectedSection === section.id;
        const showEmoji = section.iconEmoji != null;
        return (
          <motion.button
            key={section.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            aria-label={section.iconEmoji === '🐺' ? `${section.title}${brandCoyoteLabelSuffix()}` : section.title}
            title={section.description}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => handleClick(section.id)}
            className="group flex-1 rounded-lg flex flex-col items-center justify-center gap-0.5 font-medium text-white shadow-md transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background min-w-0 relative"
            style={{
              minWidth: cardMinWidthPx,
              maxWidth: cardMaxWidthPx,
              flexBasis: cardMinWidthPx,
              height: cardHeightPx,
              backgroundColor: section.color,
              boxShadow: isSelected
                ? `0 -2px 12px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)`
                : undefined,
            }}
              layout={!noMotion}
              initial={false}
              animate={{
                y: isSelected ? -POP_UP_PX : 0,
              }}
              transition={noMotion ? { duration: 0 } : SMOOTH_SPRING}
            >
              {showEmoji ? (
                section.iconEmoji === '🐺' ? (
                  <span className="text-2xl leading-none shrink-0 inline-flex">
                    <BrandCoyoteMark decorativeOnly />
                  </span>
                ) : (
                  <span className="text-2xl leading-none shrink-0" aria-hidden>{section.iconEmoji}</span>
                )
              ) : (
                <Icon className="w-6 h-6 shrink-0" aria-hidden />
              )}
              {/* Hover label: same glass-pill style as wheel */}
              <span
                className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 inline-block px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap max-w-[200px] truncate text-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none"
                style={{
                  background: 'color-mix(in srgb, var(--card) 85%, transparent)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: '1px solid color-mix(in srgb, var(--primary) 50%, transparent)',
                  boxShadow: '0 2px 12px -2px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, var(--primary) 15%, transparent)',
                }}
              >
                {section.title}
              </span>
            </motion.button>
        );
      })}
    </motion.div>
  );
}

export const FeatureCardRow = memo(FeatureCardRowComponent);
