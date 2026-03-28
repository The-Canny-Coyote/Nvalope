import { useState, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { useAppStore } from '@/app/store/appStore';
import { clampScrollbarSize } from '@/app/constants/accessibility';
import { BrandCoyoteMark, brandCoyoteLabelSuffix } from '@/app/components/BrandCoyoteMark';

interface WheelSection {
  id: number;
  icon: LucideIcon;
  title: string;
  description: string;
  content: React.ReactNode;
  color: string;
}

interface WheelMenuProps {
  sections: WheelSection[];
  enabledModules: string[];
  showCacheAnimation?: boolean;
  accessibilityMode?: string;
  /** Controlled selected section (e.g. from App) so selection persists when sections content updates. */
  selectedSection?: number | null;
  onSelectedSectionChange?: (id: number | null) => void;
  /** Ref to attach to the expanded section content (used by App for scroll restore on layout changes only). */
  sectionContentRef?: React.Ref<HTMLDivElement>;
  /** Called when user selects or deselects a section (first meaningful action). */
  onUserAction?: () => void;
  /** Called when user clicks the center (Cache the AI Assistant) icon. */
  onOpenAssistant?: () => void;
  /** When true, do not render the expanded content card here (parent renders it in the main flow to avoid clipping). */
  expandContentOutside?: boolean;
}

function WheelMenuComponent({ sections, enabledModules, showCacheAnimation = false, accessibilityMode: _accessibilityMode = 'standard', selectedSection: controlledSelected, onSelectedSectionChange, sectionContentRef, onUserAction, onOpenAssistant, expandContentOutside = false }: WheelMenuProps) {
  const [hoveredSection, setHoveredSection] = useState<number | null>(null);
  const [uncontrolledSelected, setUncontrolledSelected] = useState<number | null>(null);
  const selectedSection = controlledSelected !== undefined ? controlledSelected : uncontrolledSelected;
  const setSelectedSection = onSelectedSectionChange ?? setUncontrolledSelected;

  const scrollbarSize = useAppStore((s) => s.scrollbarSize);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const motionTransition = reducedMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 35 };
  const strokeBase = useMemo(() => {
    const chonk = clampScrollbarSize(scrollbarSize);
    return chonk <= 10 ? 1 : chonk <= 15 ? 2 : 3;
  }, [scrollbarSize]);

  const centerX = 300;
  const centerY = 300;
  const baseRadius = 180;
  const hoverRadiusIncrease = 25;
  const anglePerSection = (2 * Math.PI) / sections.length;

  const isCacheEnabled = enabledModules.includes('cacheAssistant');

  const handleSectionClick = (sectionId: number) => {
    onUserAction?.();
    if (selectedSection === sectionId) {
      setSelectedSection(null);
    } else {
      setSelectedSection(sectionId);
    }
  };

  const createSectionPath = (
    index: number,
    isHovered: boolean,
    isSelected: boolean
  ) => {
    const startAngle = index * anglePerSection - Math.PI / 2;
    const endAngle = (index + 1) * anglePerSection - Math.PI / 2;
    const radius = isHovered || isSelected ? baseRadius + hoverRadiusIncrease : baseRadius;
    // Fixed donut geometry so toggling Cache does not change wedge paths or cause reflow
    const innerRadius = 40;

    const x1 = centerX + Math.cos(startAngle) * innerRadius;
    const y1 = centerY + Math.sin(startAngle) * innerRadius;
    const x2 = centerX + Math.cos(endAngle) * innerRadius;
    const y2 = centerY + Math.sin(endAngle) * innerRadius;
    const x3 = centerX + Math.cos(endAngle) * radius;
    const y3 = centerY + Math.sin(endAngle) * radius;
    const x4 = centerX + Math.cos(startAngle) * radius;
    const y4 = centerY + Math.sin(startAngle) * radius;

    return `M ${x1},${y1} L ${x4},${y4} A ${radius},${radius} 0 0,1 ${x3},${y3} L ${x2},${y2} A ${innerRadius},${innerRadius} 0 0,0 ${x1},${y1} Z`;
  };

  const getIconPosition = (index: number) => {
    const angle = (index + 0.5) * anglePerSection - Math.PI / 2;
    const iconRadius = baseRadius * 0.7;
    return {
      x: centerX + Math.cos(angle) * iconRadius,
      y: centerY + Math.sin(angle) * iconRadius,
    };
  };

  const getLabelPosition = (index: number) => {
    const angle = (index + 0.5) * anglePerSection - Math.PI / 2;
    // Anchor point on the slice (same as icon radius) so label sits over the slice
    const labelAnchorRadius = baseRadius * 0.7;
    const x = centerX + Math.cos(angle) * labelAnchorRadius;
    const y = centerY + Math.sin(angle) * labelAnchorRadius;
    return { x, y };
  };

  const selectedSectionData = sections.find(s => s.id === selectedSection);

  return (
    <div className="flex w-full max-w-full min-w-0 flex-col items-center gap-0">
      {/* SVG Wheel — responsive so narrow viewports don’t overflow horizontally */}
      <svg
        viewBox="0 0 600 600"
        className="h-auto w-full max-w-full min-w-0 block select-none drop-shadow-lg pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* One interactive group per slice: wedge + icon share role="button" so hit-testing matches a11y (no stray path <g> under icon). */}
        {[
          ...sections.filter((s) => s.id !== selectedSection),
          ...(selectedSection != null ? sections.filter((s) => s.id === selectedSection) : []),
        ].map((section, orderIndex) => {
          const index = sections.indexOf(section);
          const IconComponent = section.icon;
          const iconPos = getIconPosition(index);
          const isHovered = hoveredSection === section.id;
          const isSelected = selectedSection === section.id;
          return (
            <g
              key={`slice-${section.id}`}
              data-section-id={section.id}
              role="button"
              tabIndex={0}
              className="pointer-events-auto"
              aria-label={section.title}
              aria-current={isSelected ? 'page' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSectionClick(section.id);
                }
              }}
              onMouseEnter={() => setHoveredSection(section.id)}
              onMouseLeave={() => setHoveredSection(null)}
              onClick={() => handleSectionClick(section.id)}
            >
              <title>{section.description}</title>
              <motion.path
                d={createSectionPath(index, isHovered, isSelected)}
                fill={isSelected ? section.color : isHovered ? `${section.color}cc` : `${section.color}99`}
                stroke="var(--primary)"
                strokeWidth={isSelected ? strokeBase + 2 : isHovered ? strokeBase + 1 : strokeBase}
                className="cursor-pointer transition-all"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.3, delay: orderIndex * 0.05 }}
              />
              <foreignObject
                x={iconPos.x - 16}
                y={iconPos.y - 16}
                width={32}
                height={32}
                className="pointer-events-none"
              >
                <div className="flex items-center justify-center w-full h-full">
                  <IconComponent
                    className="w-7 h-7"
                    style={{
                      color: isSelected || isHovered ? 'var(--primary-foreground)' : 'var(--foreground)',
                      filter: isSelected || isHovered
                        ? 'drop-shadow(0 0 6px var(--primary)) drop-shadow(0 2px 4px rgba(0,0,0,0.4))'
                        : 'none',
                      transition: reducedMotion ? 'none' : 'filter 0.2s ease',
                    }}
                  />
                </div>
              </foreignObject>
            </g>
          );
        })}
        {/* Hover labels: single group so labels always render on top of all slices */}
        <g className="pointer-events-none" aria-hidden>
          <AnimatePresence>
            {hoveredSection != null && (() => {
              const section = sections.find((s) => s.id === hoveredSection);
              if (!section) return null;
              const index = sections.indexOf(section);
              const labelPos = getLabelPosition(index);
              const labelWidth = 220;
              const labelHeight = 40;
              const gapAboveSlice = 8;
              return (
                <motion.g
                  key={hoveredSection}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={motionTransition}
                >
                  <foreignObject
                    x={labelPos.x - labelWidth / 2}
                    y={labelPos.y - labelHeight - gapAboveSlice}
                    width={labelWidth}
                    height={labelHeight}
                  >
                    <div className="flex items-center justify-center w-full h-full px-2">
                      <span
                        className="inline-block px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap max-w-[200px] truncate text-foreground"
                        style={{
                          background: 'color-mix(in srgb, var(--card) 85%, transparent)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid color-mix(in srgb, var(--primary) 50%, transparent)',
                          boxShadow: '0 2px 12px -2px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, var(--primary) 15%, transparent)',
                        }}
                        title={section.title}
                      >
                        {section.title}
                      </span>
                    </div>
                  </foreignObject>
                </motion.g>
              );
            })()}
          </AnimatePresence>
        </g>

        {/* Center circle - only if Cache the AI Assistant is enabled; click opens assistant */}
        {isCacheEnabled && (
          <g
            data-testid="open-ai-assistant"
            className="pointer-events-auto"
            onClick={onOpenAssistant}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenAssistant?.(); } }}
            role="button"
            tabIndex={0}
            aria-label={`Open Cache the AI Assistant${brandCoyoteLabelSuffix()}`}
            style={{ cursor: onOpenAssistant ? 'pointer' : undefined }}
          >
            <title>{`Open Cache the AI Assistant${brandCoyoteLabelSuffix()}`}</title>
            <motion.circle
              cx={centerX}
              cy={centerY}
              r="40"
              fill="var(--card)"
              stroke="var(--primary)"
              strokeWidth={strokeBase + 1}
              style={{ filter: 'drop-shadow(0 0 12px var(--primary)) drop-shadow(0 0 28px color-mix(in srgb, var(--primary) 50%, transparent))' }}
              initial={showCacheAnimation ? { scale: 0, opacity: 0 } : {}}
              animate={{ scale: 1, opacity: 1 }}
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, duration: 0.6 }}
            />
            {/* Cache the AI Assistant 🐺 in center */}
            <foreignObject
              x={centerX - 24}
              y={centerY - 24}
              width={48}
              height={48}
              style={{ pointerEvents: 'none' }}
            >
              <motion.div
                className="flex items-center justify-center w-full h-full text-[2.25rem] leading-none"
                initial={showCacheAnimation ? { scale: 0, rotate: -180 } : {}}
                animate={{ scale: 1, rotate: 0 }}
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
                aria-hidden
              >
                <BrandCoyoteMark decorativeOnly />
              </motion.div>
            </foreignObject>
          </g>
        )}
      </svg>

      {/* Expanded content card (skipped when expandContentOutside – parent renders in main flow) */}
      {!expandContentOutside && (
        <AnimatePresence mode="wait">
          {selectedSectionData && (
            <motion.div
              ref={sectionContentRef}
              data-testid="section-content"
              key={selectedSectionData.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={motionTransition}
              className="mt-1 w-full min-w-0 max-w-[min(42rem,100%)]"
            >
              <Card className="relative w-full min-w-0 overflow-x-auto overflow-y-hidden border-primary/30 bg-card shadow-xl">
                <div className="p-4 sm:p-6 min-w-0">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-primary mb-1">
                        {selectedSectionData.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedSectionData.description}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedSection(null)}
                      className="ml-3 flex items-center gap-1 px-3 py-1 rounded-full bg-muted/60 hover:bg-primary/15 border border-border hover:border-primary/40 text-xs font-medium text-muted-foreground hover:text-foreground transition-all backdrop-blur-sm"
                      aria-label="Close"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Close
                    </button>
                  </div>
                  <div className="border-t border-border pt-4">
                    {selectedSectionData.content}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}

    </div>
  );
}

export const WheelMenu = memo(WheelMenuComponent);