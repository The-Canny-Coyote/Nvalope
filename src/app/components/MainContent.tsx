/**
 * Main scrollable content: grid background, title card, wheel/list, footer.
 * Used by App to keep the main layout in a single place.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { WheelMenu } from '@/app/components/WheelMenu';
import { SimpleListView } from '@/app/components/SimpleListView';
import { GridBackground } from '@/app/components/GridBackground';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { StorageUsage } from '@/app/components/StorageUsage';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import {
  BottomNavBar,
  BOTTOM_NAV_BAR_ROW_HEIGHT_PX,
  BOTTOM_NAV_BAR_ROW_SELECTOR_STRIP_PX,
} from '@/app/components/BottomNavBar';
import {
  CARD_BAR_SIDE_CELL_WIDTH_PX,
  CARD_BAR_MINIMIZED_STRIP_PX,
  clampWheelScale,
} from '@/app/constants/accessibility';
import { CACHE_ASSISTANT_SECTION_ID, type AppSection } from '@/app/sections/appSections';
import { BrandCoyoteMark } from '@/app/components/BrandCoyoteMark';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/app/store/appStore';

/** Brown card color used for Accessibility, Glossary, Settings. */
const BROWN_CARD_COLOR = '#8b6944';
/** In card layout, brown sections appear last in this order: Accessibility, Glossary, Settings. */
const CARD_LAYOUT_BROWN_ORDER = [5, 105, 6];

function sectionsForCardLayout(sections: AppSection[]): AppSection[] {
  const brown = sections.filter((s) => s.color === BROWN_CARD_COLOR);
  const green = sections.filter((s) => s.color !== BROWN_CARD_COLOR);
  const brownOrdered = [...CARD_LAYOUT_BROWN_ORDER].filter((id) => brown.some((s) => s.id === id)).map((id) => brown.find((s) => s.id === id)!);
  return [...green, ...brownOrdered];
}

/** Apply user's custom section order; append any sections not in the order list. */
function applyCardBarOrder(sections: AppSection[], order: number[] | null): AppSection[] {
  if (!order || order.length === 0) return sections;
  const byId = new Map(sections.map((s) => [s.id, s]));
  const ordered: AppSection[] = [];
  for (const id of order) {
    const sec = byId.get(id);
    if (sec) ordered.push(sec);
  }
  for (const s of sections) {
    if (!order.includes(s.id)) ordered.push(s);
  }
  return ordered;
}

export interface MainContentProps {
  mainScrollRef: React.RefObject<HTMLDivElement | null>;
  sectionContentRef: React.RefObject<HTMLDivElement | null>;
  allSections: AppSection[];
  selectedMode: string;
  /** When switching to Wheel/Cards from list view, call to exit list so the chosen layout shows. */
  setSelectedMode?: (mode: string) => void;
  selectedWheelSection: number | null;
  setSelectedWheelSection: (id: number | null) => void;
  /** Called when the user clicks Close on a section card; closes the section without scrolling. */
  onCloseSection?: () => void;
  saveScrollForRestore: () => void;
  wheelScale: number;
  enabledModules: string[];
  showCacheAnimation: boolean;
  setAssistantOpen: (open: boolean) => void;
  /** Reserved for future use; mobile now uses same wheel/cards layout as desktop. */
  isMobile?: boolean;
  useCardLayout: boolean;
  setUseCardLayout: (v: boolean) => void;
}

export function MainContent({
  mainScrollRef,
  sectionContentRef,
  allSections,
  selectedMode,
  setSelectedMode: _setSelectedMode,
  selectedWheelSection,
  setSelectedWheelSection,
  onCloseSection,
  saveScrollForRestore,
  wheelScale,
  enabledModules,
  showCacheAnimation,
  setAssistantOpen,
  isMobile: _isMobile = false,
  useCardLayout,
  setUseCardLayout: _setUseCardLayout,
}: MainContentProps) {
  const showGridBackground = useAppStore((s) => s.showGridBackground);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const cardBarRows = useAppStore((s) => s.cardBarRows);
  const setCardBarRows = useAppStore((s) => s.setCardBarRows);
  const cardBarColumns = useAppStore((s) => s.cardBarColumns);
  const setCardBarColumns = useAppStore((s) => s.setCardBarColumns);
  const cardBarPosition = useAppStore((s) => s.cardBarPosition);
  const setCardBarPosition = useAppStore((s) => s.setCardBarPosition);
  const cardBarMinimized = useAppStore((s) => s.cardBarMinimized);
  const setCardBarMinimized = useAppStore((s) => s.setCardBarMinimized);
  const cardBarLockExpanded = useAppStore((s) => s.cardBarLockExpanded);
  const setCardBarLockExpanded = useAppStore((s) => s.setCardBarLockExpanded);
  const cardBarSectionOrder = useAppStore((s) => s.cardBarSectionOrder);
  const setCardBarSectionOrder = useAppStore((s) => s.setCardBarSectionOrder);
  const showCardBarRowSelector = useAppStore((s) => s.showCardBarRowSelector);
  const cardsSectionWidthPercent = useAppStore((s) => s.cardsSectionWidthPercent);
  const supportBlockMinimized = useAppStore((s) => s.supportBlockMinimized);
  const setSupportBlockMinimized = useAppStore((s) => s.setSupportBlockMinimized);
  const storageBarMinimized = useAppStore((s) => s.storageBarMinimized);
  const setStorageBarMinimized = useAppStore((s) => s.setStorageBarMinimized);
  const wheelMinimized = useAppStore((s) => s.wheelMinimized);
  const _setWheelMinimized = useAppStore((s) => s.setWheelMinimized);
  const listSections = allSections;
  const [narrowViewport, setNarrowViewport] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 480px)').matches : false
  );
  const prevScrolledSectionRef = useRef<number | null>(null);

  useEffect(() => {
    const m = window.matchMedia('(max-width: 480px)');
    const listener = () => setNarrowViewport(m.matches);
    m.addEventListener('change', listener);
    return () => m.removeEventListener('change', listener);
  }, []);

  const cardLayoutSections = sectionsForCardLayout(allSections);
  const orderedCardBarSections = applyCardBarOrder(cardLayoutSections, cardBarSectionOrder);
  const effectiveCardBarRows = cardBarRows === 0 ? (narrowViewport ? 2 : 1) : Math.max(1, Math.min(3, cardBarRows));
  const effectiveCardBarColumns =
    cardBarColumns === 0 ? (narrowViewport ? 2 : 1) : Math.max(1, Math.min(3, cardBarColumns));
  const cardsSectionWidthScale = Math.min(120, Math.max(60, cardsSectionWidthPercent)) / 100;
  const barActuallyExpanded = !cardBarMinimized || cardBarLockExpanded;
  const cardBarWidthPx =
    !useCardLayout || cardBarPosition === 'bottom'
      ? 0
      : barActuallyExpanded
        ? effectiveCardBarColumns * Math.round(CARD_BAR_SIDE_CELL_WIDTH_PX * cardsSectionWidthScale)
        : CARD_BAR_MINIMIZED_STRIP_PX;
  const bottomPaddingWhenCard =
    cardBarPosition === 'bottom'
      ? (barActuallyExpanded ? effectiveCardBarRows * BOTTOM_NAV_BAR_ROW_HEIGHT_PX + (showCardBarRowSelector ? BOTTOM_NAV_BAR_ROW_SELECTOR_STRIP_PX : 0) : CARD_BAR_MINIMIZED_STRIP_PX) +
        'px'
      : undefined;

  // Gentle scroll only when a slice/card is first opened or switched (not on every re-render or when toggling settings/accessibility)
  useEffect(() => {
    if (selectedWheelSection == null) {
      prevScrolledSectionRef.current = null;
      return;
    }
    if (prevScrolledSectionRef.current === selectedWheelSection) return;
    prevScrolledSectionRef.current = selectedWheelSection;
    const t = setTimeout(() => {
      const container = mainScrollRef?.current ?? null;
      const section = sectionContentRef?.current ?? null;
      if (!container || !section) return;
      const cRect = container.getBoundingClientRect();
      const sRect = section.getBoundingClientRect();
      const offsetTop = sRect.top - cRect.top + container.scrollTop;
      const padding = 24;
      const desiredScrollTop = Math.max(0, offsetTop - padding);
      container.scrollTo({ top: desiredScrollTop, behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(t);
  }, [selectedWheelSection, mainScrollRef, sectionContentRef]);

  const handleCloseSection = useCallback(() => {
    saveScrollForRestore();
    if (onCloseSection) {
      onCloseSection();
    } else {
      setSelectedWheelSection(null);
    }
  }, [onCloseSection, saveScrollForRestore, setSelectedWheelSection]);

  const noMotion = reducedMotion || selectedMode === 'calm';
  const sectionCardTransition = noMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 35 };
  const renderSectionContentCard = (sectionData: AppSection) => (
    <motion.div
      ref={sectionContentRef as React.Ref<HTMLDivElement>}
      data-testid="section-content"
      key={sectionData.id}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={sectionCardTransition}
      className="w-full mt-4 min-w-0"
    >
      <Card
        className="relative w-full min-w-0 overflow-x-auto overflow-y-hidden border-l-4 border-primary/30 bg-card shadow-xl"
        style={{ borderLeftColor: sectionData.color ?? 'var(--primary)' }}
      >
        <div className="min-w-0 p-4 sm:p-6">
          <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="mb-1 break-words text-xl font-semibold text-primary">{sectionData.title}</h2>
              <p className="break-words text-sm text-muted-foreground">{sectionData.description}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCloseSection();
              }}
              className="ml-3 flex items-center justify-center size-8 rounded-full bg-muted/60 hover:bg-primary/15 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all backdrop-blur-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Close section"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
            </button>
          </div>
          <div className="min-w-0 border-t border-border pt-4">{sectionData.content}</div>
        </div>
      </Card>
    </motion.div>
  );

  const selectedSectionData = selectedWheelSection != null ? allSections.find((s) => s.id === selectedWheelSection) : null;
  const sectionAnnouncement = selectedSectionData ? `Opened: ${selectedSectionData.title}` : '';

  return (
    <>
      {showGridBackground && <GridBackground />}
      <div
        id="main-content"
        ref={mainScrollRef as React.Ref<HTMLDivElement>}
        data-testid="main-scroll"
        data-section-open={selectedWheelSection != null ? '' : undefined}
        className="relative z-10 flex-1 min-h-0 min-w-0 px-4 sm:px-6 py-4 overflow-y-auto overflow-x-hidden"
        style={
          useCardLayout
            ? {
                paddingBottom:
                  cardBarPosition === 'bottom'
                    ? `calc(${bottomPaddingWhenCard ?? 0} + env(safe-area-inset-bottom, 0px))`
                    : undefined,
                paddingLeft: cardBarPosition === 'left' ? cardBarWidthPx : undefined,
                paddingRight: cardBarPosition === 'right' ? cardBarWidthPx : undefined,
              }
            : undefined
        }
        tabIndex={-1}
      >
        {/* Screen reader: announce opened section when user selects from wheel or list */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic>
          {sectionAnnouncement}
        </div>
        <div
          data-main-scroll-body
          className="origin-top w-full max-w-full min-w-0 overflow-x-hidden"
          style={{
            transform: 'scale(var(--layout-scale))',
            width: 'calc(100% / var(--layout-scale))',
            minHeight: 'calc(100% / var(--layout-scale))',
          }}
        >
          {/* Single centered column: all content shares this max-width so the center line stays consistent. */}
          <div className="mx-auto flex w-full max-w-[42rem] min-w-0 flex-col items-stretch px-0">
          <motion.div
            className="w-full mb-0 min-w-0"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={noMotion ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
          >
            <div className="w-full min-w-0 flex flex-col items-stretch">
              <div className="flex items-center justify-start mb-4 w-full" role="group" aria-label="Theme">
                <ThemeToggle />
              </div>
              <Card className="glass-card relative w-full min-w-0 overflow-hidden">
                <div className="p-4 text-center sm:p-6">
                  <h1
                    className="break-words text-4xl font-bold tracking-tight sm:text-5xl"
                    style={{
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      letterSpacing: '-0.02em',
                      lineHeight: 1.1,
                      textShadow: '0 1px 2px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06), 0 0 24px -4px color-mix(in srgb, var(--primary) 18%, transparent)',
                    }}
                  >
                    <span style={{ color: 'var(--nvalope-brown, #8b6944)' }}>N</span>
                    <span style={{ color: 'var(--nvalope-green, #2d7a3f)' }}>valope</span>
                    <sup className="text-lg sm:text-xl ml-0.5 align-super font-normal opacity-90" style={{ color: 'var(--nvalope-brown, #8b6944)' }} aria-label="trademark">
                      ™
                    </sup>
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    A Free Privacy-Focused, Offline Capable, Envelope Budgeting PWA.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No account needed and no data leaves your device unless you choose.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Absolutely no ads or tracking.
                  </p>
                </div>
              </Card>
              <div className="mt-3 text-center focus-mode-hide flex flex-col items-center gap-1">
                <a
                  href="/install-pwa.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                  aria-label="Open full guide: install Nvalope as an app on your device (opens in a new tab)"
                >
                  Install Nvalope on your device — step-by-step
                </a>
                <a
                  href="/user-guide.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
                  aria-label="Open the Nvalope user guide (opens in a new tab)"
                >
                  User guide — how to use Nvalope
                </a>
              </div>
            </div>

            <div className="mt-4 focus-mode-hide flex flex-col items-center gap-1 relative z-20">
              <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                {supportBlockMinimized ? (
                  <div className="flex items-center justify-center gap-2 w-full">
                    <span className="text-sm text-muted-foreground">Support the project</span>
                    <button
                      type="button"
                      onClick={() => setSupportBlockMinimized(false)}
                      className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0"
                      aria-expanded={false}
                      aria-label="Expand support / Buy me a coffee"
                    >
                      <ChevronDown className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full max-w-[16rem] mx-auto">
                    <a
                      href="https://www.buymeacoffee.com/thecannycoyote"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glow-support block p-4 rounded-2xl text-center min-w-[10rem]"
                      aria-label="Support the project — Buy me a coffee (opens Buy Me a Coffee; their privacy policy applies)"
                      title="Opens Buy Me a Coffee. Their data and privacy policy applies on that site."
                    >
                      <span className="text-2xl" aria-hidden>
                        ☕
                      </span>
                      <p className="text-sm font-semibold text-foreground mt-1">
                        Support the project
                      </p>
                      <p className="text-xs text-primary font-medium">Buy me a coffee</p>
                    </a>
                    <button
                      type="button"
                      onClick={() => setSupportBlockMinimized(true)}
                      className="absolute top-2 right-2 inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0 z-10"
                      aria-expanded={true}
                      aria-label="Minimize support section"
                    >
                      <ChevronUp className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </div>

          <div className="mt-4 w-full flex flex-col items-center gap-4">
            {selectedMode === 'focus' ? (
              <div key="list" data-layout="list">
              <SimpleListView
                sections={listSections}
                onUserAction={() => {}}
                selectedSection={selectedWheelSection}
                onSelectedSectionChange={(id) => {
                  if (id === null) saveScrollForRestore();
                  setSelectedWheelSection(id);
                }}
                sectionContentRef={sectionContentRef}
                maxVisibleSections={6}
              />
              </div>
            ) : useCardLayout ? (
              <div key="cards" data-layout="cards" className="flex w-full min-w-0 flex-col items-center">
                <div className="w-full min-w-0 mt-4">
                  <AnimatePresence mode="wait">
                    {selectedWheelSection != null && (() => {
                      const sectionData = allSections.find((s) => s.id === selectedWheelSection);
                      return sectionData ? renderSectionContentCard(sectionData) : null;
                    })()}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div key="wheel" data-layout="wheel" className="flex w-full flex-col items-center">
                {wheelMinimized ? (
                  <div className="w-full flex items-center justify-center gap-2 mt-4 py-2" data-wheel-minimized="true">
                    <span className="text-sm text-muted-foreground">Section wheel</span>
                    <button
                      type="button"
                      onClick={() => useAppStore.getState().setWheelMinimized(false)}
                      className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0"
                      aria-expanded={false}
                      aria-label="Expand section wheel"
                    >
                      <ChevronDown className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative w-full flex justify-center">
                      <button
                        type="button"
                        onClick={() => useAppStore.getState().setWheelMinimized(true)}
                        className="absolute top-0 right-0 inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0 z-20"
                        aria-expanded={true}
                        aria-label="Minimize section wheel"
                      >
                        <ChevronUp className="w-4 h-4" aria-hidden />
                      </button>
                      <div className="flex w-full min-w-0 flex-col items-center justify-center gap-3 pt-6">
                        <div className="flex min-w-0 flex-1 justify-center">
                          {(() => {
                            const scaleRatio = clampWheelScale(wheelScale) / 100;
                            return (
                              <div
                                className="relative z-10 mx-auto block w-full max-w-full min-w-0 overflow-hidden"
                                style={{
                                  maxWidth: `${600 * scaleRatio}px`,
                                  maxHeight: `${410 * scaleRatio}px`,
                                }}
                              >
                                <div
                                  style={{
                                    transform: `translateY(-${80 * scaleRatio}px)`,
                                    transformOrigin: 'top center',
                                  }}
                                >
                                  <WheelMenu
                                    sections={allSections.filter((s) => s.id !== CACHE_ASSISTANT_SECTION_ID)}
                                    enabledModules={enabledModules}
                                    showCacheAnimation={showCacheAnimation}
                                    accessibilityMode={selectedMode}
                                    onUserAction={() => {}}
                                    onOpenAssistant={() => setAssistantOpen(true)}
                                    selectedSection={selectedWheelSection}
                                    onSelectedSectionChange={(id) => {
                                      if (id === null) saveScrollForRestore();
                                      setSelectedWheelSection(id);
                                    }}
                                    sectionContentRef={sectionContentRef as React.Ref<HTMLDivElement>}
                                    expandContentOutside
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    {selectedWheelSection == null && (
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-6 w-full">
                        <p className="text-sm text-muted-foreground text-center">
                          Hover over sections to see labels • Click to expand. Use the buttons above to switch to Cards.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {/* When wheel is minimized, keep the open section content visible so the feature in use is not closed */}
                <div className="w-full min-w-0 mt-8 relative z-0">
                  <AnimatePresence>
                    {selectedWheelSection != null && (() => {
                      const sectionData = allSections.find((s) => s.id === selectedWheelSection);
                      return sectionData ? renderSectionContentCard(sectionData) : null;
                    })()}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          <div className="w-full mt-8 focus-mode-hide space-y-4">
            <div className="space-y-4">
              <div className="relative p-4 sm:p-6 glass-card rounded-2xl flex flex-wrap items-center justify-center gap-2">
                {storageBarMinimized ? (
                  <div className="flex items-center justify-center gap-2 w-full">
                    <span className="text-xs text-muted-foreground">Storage capacity</span>
                    <button
                      type="button"
                      onClick={() => setStorageBarMinimized(false)}
                      className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0"
                      aria-expanded={false}
                      aria-label="Expand storage capacity bar"
                    >
                      <ChevronDown className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <>
                    <StorageUsage />
                    <button
                      type="button"
                      onClick={() => setStorageBarMinimized(true)}
                      className="absolute top-2 right-2 inline-flex items-center justify-center p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0 z-10"
                      aria-expanded={true}
                      aria-label="Minimize storage capacity bar"
                    >
                      <ChevronUp className="w-4 h-4" aria-hidden />
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <span>This app can be installed on your device (PWA).</span>
                <Popover>
                  <PopoverTrigger
                    type="button"
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-transparent border-0 p-0 text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-bold text-sm cursor-pointer"
                    aria-label="How to install"
                  >
                    ?
                  </PopoverTrigger>
                <PopoverContent
                  side="top"
                  className="max-w-md w-[min(calc(100vw-2rem),28rem)] max-h-[min(70vh,22rem)] overflow-y-auto text-left text-xs p-3 sm:p-4"
                >
                  <p className="font-medium text-foreground mb-1">Install as an app (PWA)</p>
                  <p className="text-muted-foreground mb-2 leading-snug">
                    A <strong className="text-foreground">Progressive Web App</strong> means this site can be added to your home screen or app list so Nvalope opens like a standalone app. Your budget data stays on your device; installing does not send anything to our servers.
                  </p>
                  <p className="text-muted-foreground mb-2 leading-snug">
                    <strong className="text-foreground">Default:</strong> use the steps below. If your browser already shows an <strong className="text-foreground">Install</strong> prompt, you can accept it—then you’re done.
                  </p>
                  <p className="font-medium text-foreground mb-1.5">How to install on each device</p>
                  <ul className="space-y-1.5 text-muted-foreground list-disc list-inside leading-snug [&_strong]:text-foreground">
                    <li>
                      <strong>iPhone / iPad:</strong> Open Nvalope in <strong>Safari</strong>. Tap Share (square with arrow) → <strong>Add to Home Screen</strong> → Add.
                    </li>
                    <li>
                      <strong>Android:</strong> In <strong>Chrome</strong>, use the menu (⋮) → <strong>Install app</strong> or <strong>Add to Home screen</strong>, or tap Install when the banner appears.
                    </li>
                    <li>
                      <strong>Windows / Mac — Chrome or Edge:</strong> Click the <strong>install</strong> icon in the address bar, or menu (⋮) → <strong>Install Nvalope</strong> / install this site as an app.
                    </li>
                    <li>
                      <strong>Mac — Safari:</strong> Full PWA install works like iPhone; on desktop Safari, prefer <strong>Chrome or Edge</strong> for install, or <strong>File → Add to Dock</strong> for a shortcut.
                    </li>
                    <li>
                      <strong>Firefox:</strong> Menu → look for <strong>Install</strong> if shown; otherwise use Chrome or Edge for one-click install.
                    </li>
                  </ul>
                  <p className="mt-2 pt-2 border-t border-border">
                    <a
                      href="/install-pwa.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    >
                      Full guide: install on every device (new tab)
                    </a>
                  </p>
                </PopoverContent>
              </Popover>
              </div>
              <p className="text-xs text-muted-foreground text-center leading-relaxed">
                All data and processing occurs on your device only • Nvalope™, Cache™, and
                Cache the AI Assistant™ are trademarks of THE CANNY COYOTE LLC{' '}
                <BrandCoyoteMark decorativeOnly className="inline" />
              </p>
            </div>
            <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground focus-mode-hide" role="contentinfo" aria-label="Footer links">
              <a
                href="/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Privacy Policy
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="/terms.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Terms of Use
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="/license.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                License (MIT)
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="mailto:support@nvalope.com"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Contact us by email (support@nvalope.com)"
              >
                Contact us
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="https://github.com/the-canny-coyote/nvalope"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Nvalope on GitHub (opens in new tab)"
              >
                GitHub
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="/install-pwa.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="How to install Nvalope as an app on your device (opens in new tab)"
              >
                Install the app
              </a>
              <span aria-hidden="true">·</span>
              <a
                href="/user-guide.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Nvalope user guide — full documentation (opens in new tab)"
              >
                User guide
              </a>
            </footer>
          </div>
          </motion.div>
          </div>
        </div>
      </div>
      {useCardLayout && (
        <BottomNavBar
          sections={orderedCardBarSections}
          selectedSection={selectedWheelSection}
          onSelectedSectionChange={(id) => {
            if (id === null) saveScrollForRestore();
            setSelectedWheelSection(id);
          }}
          scale={wheelScale}
          position={cardBarPosition}
          onCardBarPositionChange={setCardBarPosition}
          rows={effectiveCardBarRows}
          columns={effectiveCardBarColumns}
          cardBarRows={cardBarRows}
          cardBarColumns={cardBarColumns}
          barMinimized={cardBarMinimized}
          onBarMinimizedChange={setCardBarMinimized}
          barLockExpanded={cardBarLockExpanded}
          onBarLockExpandedChange={setCardBarLockExpanded}
          showRowSelectorStrip={showCardBarRowSelector}
          onCardBarRowsChange={showCardBarRowSelector ? setCardBarRows : undefined}
          onCardBarColumnsChange={showCardBarRowSelector ? setCardBarColumns : undefined}
          onSectionOrderChange={(order) => setCardBarSectionOrder(order)}
          onUserAction={() => {}}
          sectionWidthPercent={cardsSectionWidthPercent}
        />
      )}
    </>
  );
}
