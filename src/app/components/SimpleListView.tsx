import { LucideIcon } from 'lucide-react';
import { BrandCoyoteMark } from '@/app/components/BrandCoyoteMark';
import { Card } from '@/app/components/ui/card';
import { useState, memo } from 'react';

interface Section {
  id: number;
  icon: LucideIcon;
  title: string;
  description: string;
  content: React.ReactNode;
  color: string;
  /** Optional emoji shown instead of icon when set (e.g. wheel sections). */
  iconEmoji?: string;
}

interface SimpleListViewProps {
  sections: Section[];
  /** Controlled selected section so selection persists when sections content updates. */
  selectedSection?: number | null;
  onSelectedSectionChange?: (id: number | null) => void;
  /** Ref to attach to the expanded section content so App can scroll it into view when a list item is clicked. */
  sectionContentRef?: React.RefObject<HTMLDivElement | null>;
  /** Called when user selects a section (first meaningful action). */
  onUserAction?: () => void;
  /** When set, show only this many sections initially with "Show more". */
  maxVisibleSections?: number;
}

function SimpleListViewComponent({ sections, selectedSection: controlledSelected, onSelectedSectionChange, sectionContentRef, onUserAction, maxVisibleSections }: SimpleListViewProps) {
  const [uncontrolledSelected, setUncontrolledSelected] = useState<number | null>(null);
  const [showAllSections, setShowAllSections] = useState(false);
  const selectedSection = controlledSelected !== undefined ? controlledSelected : uncontrolledSelected;
  const setSelectedSection = onSelectedSectionChange ?? setUncontrolledSelected;

  const limit = maxVisibleSections ?? sections.length;
  const visibleSections = showAllSections || limit >= sections.length ? sections : sections.slice(0, limit);
  const hasMore = sections.length > limit && !showAllSections;

  const selectedSectionData = sections.find(s => s.id === selectedSection);

  return (
    <div className="w-full max-w-[min(56rem,100%)] mx-auto min-w-0 space-y-4">
      <div className="text-center mb-6" role="navigation" aria-label="Sections">
        <h2 className="text-2xl font-semibold text-primary mb-2">Sections</h2>
        <p className="text-sm text-muted-foreground">
          Choose a section below to open it. Use the Close button to return to this list. Tab to move between sections; Enter to open.
        </p>
      </div>

      {selectedSectionData ? (
        <div ref={sectionContentRef as React.Ref<HTMLDivElement>} data-testid="section-content" className="w-full min-w-0">
        <Card
          className="relative w-full min-w-0 overflow-x-auto overflow-y-hidden border-l-4 border-primary/30 bg-card py-2 shadow-lg"
          style={{ borderLeftColor: selectedSectionData.color ?? 'var(--primary)' }}
        >
          <div className="min-w-0 p-4 sm:p-6">
            <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="mb-1 break-words text-xl font-semibold text-primary">
                  {selectedSectionData.title}
                </h2>
                <p className="break-words text-sm text-muted-foreground">
                  {selectedSectionData.description}
                </p>
              </div>
              <button
                onClick={() => setSelectedSection(null)}
                className="ml-3 flex items-center justify-center size-8 rounded-full bg-muted/60 hover:bg-primary/15 border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Close section"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="min-w-0 border-t border-border pt-4">
              {selectedSectionData.content}
            </div>
          </div>
        </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleSections.map((section) => {
            const Icon = section.icon;
            const showEmoji = section.iconEmoji != null;
            return (
              <button
                key={section.id}
                data-section-id={section.id}
                onClick={() => {
                  onUserAction?.();
                  setSelectedSection(section.id);
                }}
                className="w-full p-4 sm:p-6 bg-card border-2 border-primary/30 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors text-left min-w-0"
                aria-current={selectedSection === section.id ? 'page' : undefined}
                title={section.description}
              >
                <div className="flex items-center min-w-0 gap-3 sm:gap-4">
                  <div
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${section.color}20` }}
                  >
                    {showEmoji ? (
                      section.iconEmoji === '🐺' ? (
                        <span className="inline-flex items-center justify-center text-2xl sm:text-3xl leading-none">
                          <BrandCoyoteMark />
                        </span>
                      ) : (
                        <span className="text-2xl sm:text-3xl leading-none" aria-hidden>{section.iconEmoji}</span>
                      )
                    ) : (
                      <Icon
                        className="w-8 h-8"
                        style={{ color: section.color }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-semibold text-foreground break-words mb-1">
                      {section.title}
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground break-words">
                      {section.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0" aria-hidden>
                    <svg
                      className="w-8 h-8 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAllSections(true)}
              className="w-full py-3 px-4 border-2 border-dashed border-primary/40 rounded-lg text-primary font-medium hover:bg-primary/5"
              aria-label="Show more sections"
            >
              Show more ({sections.length - limit} more)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const SimpleListView = memo(SimpleListViewComponent);
