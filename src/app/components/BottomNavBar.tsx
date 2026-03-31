/**
 * Persistent card bar for card layout: fixed to the viewport.
 * Can be bottom (horizontal rows), or left/right (vertical columns).
 * Supports 1–3 rows (bottom) or 1–3 columns (left/right), optional drag-to-reorder.
 * One minimize control collapses the whole bar (selector + tabs) to an expand strip.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import type { AppSection } from '@/app/sections/appSections';
import {
  clampCardBarScale,
  clampCardBarRows,
  clampCardBarColumns,
  BOTTOM_NAV_BAR_ROW_SELECTOR_STRIP_PX,
  CARD_BAR_SIDE_CELL_WIDTH_PX,
  CARD_BAR_SIDE_SELECTOR_STRIP_PX,
  CARD_BAR_MINIMIZED_STRIP_PX,
} from '@/app/constants/accessibility';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, PanelLeft, PanelRight, Rows2, Pin, PinOff } from 'lucide-react';

/** Height of one row when bar is at bottom (px). */
export const BOTTOM_NAV_BAR_ROW_HEIGHT_PX = 64;
export { BOTTOM_NAV_BAR_ROW_SELECTOR_STRIP_PX, BOTTOM_NAV_BAR_ROW_SELECTOR_STRIP_MINIMIZED_PX } from '@/app/constants/accessibility';

export type CardBarPosition = 'bottom' | 'left' | 'right';

export interface BottomNavBarProps {
  sections: AppSection[];
  selectedSection: number | null;
  onSelectedSectionChange: (id: number | null) => void;
  scale: number;
  /** Bar position: bottom = horizontal, left/right = vertical. */
  position?: CardBarPosition;
  /** Effective row count when position is bottom (1–3). */
  rows?: number;
  /** Effective column count when position is left/right (1–3). */
  columns?: number;
  /** User's row preference when bottom: 0 = auto, 1–3 = fixed. */
  cardBarRows?: number;
  /** User's column preference when left/right: 0 = auto, 1–3 = fixed. */
  cardBarColumns?: number;
  /** When true, whole bar (selector + tabs) is collapsed to expand strip. */
  barMinimized?: boolean;
  /** Called when user minimizes or expands the whole bar. */
  onBarMinimizedChange?: (minimized: boolean) => void;
  /** When true, bar stays expanded (e.g. user locked it); hover won't collapse. */
  barLockExpanded?: boolean;
  /** Called when user locks or unlocks the bar expanded state. */
  onBarLockExpandedChange?: (locked: boolean) => void;
  /** When false, row/column selector strip is hidden (Settings). When true, strip is shown. */
  showRowSelectorStrip?: boolean;
  /** When set (bottom), show row selector and call with 0–3. */
  onCardBarRowsChange?: (rows: number) => void;
  /** When set (left/right), show column selector and call with 0–3. */
  onCardBarColumnsChange?: (columns: number) => void;
  /** When set, strip shows buttons to switch bar position (rows vs columns left/right). */
  onCardBarPositionChange?: (position: 'bottom' | 'left' | 'right') => void;
  /** When set, sections can be reordered by drag. */
  onSectionOrderChange?: (order: number[]) => void;
  onUserAction?: () => void;
  /** Cards section width 60–120%. Bottom: max-width % of viewport; left/right: bar width as % of 72px per cell. */
  sectionWidthPercent?: number;
}

const ROW_COL_OPTIONS = [
  { value: 0, label: 'Auto' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
] as const;

function BottomNavBarComponent({
  sections,
  selectedSection,
  onSelectedSectionChange,
  scale,
  position = 'bottom',
  rows = 1,
  columns = 1,
  cardBarRows = 0,
  cardBarColumns = 0,
  barMinimized = false,
  onBarMinimizedChange,
  barLockExpanded = false,
  onBarLockExpandedChange,
  showRowSelectorStrip = true,
  onCardBarRowsChange,
  onCardBarColumnsChange,
  onCardBarPositionChange,
  onSectionOrderChange,
  onUserAction,
  sectionWidthPercent = 100,
}: BottomNavBarProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 900
  );

  const showExpanded = !barMinimized || barLockExpanded || hoverExpanded;
  const s = clampCardBarScale(scale) / 100;
  const isVertical = position === 'left' || position === 'right';
  const widthScale = Math.min(120, Math.max(60, sectionWidthPercent)) / 100;
  const sideCellWidthPx = Math.round(CARD_BAR_SIDE_CELL_WIDTH_PX * widthScale);

  const rowCount = Math.max(1, Math.min(3, rows));
  const columnCount = Math.max(1, Math.min(3, columns));
  const bottomColumnCount = Math.ceil(sections.length / rowCount);
  const sideRowCount = Math.ceil(sections.length / columnCount);

  const canReorder = typeof onSectionOrderChange === 'function';
  const showRowSelector = !isVertical && showRowSelectorStrip && typeof onCardBarRowsChange === 'function';
  const showColumnSelector = isVertical && showRowSelectorStrip && typeof onCardBarColumnsChange === 'function';
  const showSelector = showRowSelector || showColumnSelector;
  const showPositionToggles = showRowSelectorStrip && typeof onCardBarPositionChange === 'function';
  const showVerticalControlRow = showPositionToggles || typeof onBarLockExpandedChange === 'function';
  const verticalControlsRows = isVertical ? Number(showColumnSelector) + Number(showVerticalControlRow) : 0;
  const estimatedVerticalControlsHeight = isVertical && showExpanded ? verticalControlsRows * 34 + 12 : 0;
  const availableVerticalNavHeight = isVertical
    ? Math.max(180, viewportHeight - estimatedVerticalControlsHeight - 8)
    : 0;
  const sideCellHeightPx = isVertical
    ? Math.max(40, Math.min(BOTTOM_NAV_BAR_ROW_HEIGHT_PX, Math.floor(availableVerticalNavHeight / Math.max(1, sideRowCount))))
    : BOTTOM_NAV_BAR_ROW_HEIGHT_PX;
  const iconBase = Math.round(24 * Math.min(1.1, s));
  const iconSize = isVertical ? Math.max(16, Math.min(iconBase, Math.floor(sideCellHeightPx * 0.42))) : iconBase;
  const sectionTitleClass = isVertical && sideCellHeightPx <= 48 ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs';
  const compactIconButtonClass =
    'flex items-center justify-center p-1 rounded text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportHeight(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleClick = useCallback(
    (id: number) => {
      onUserAction?.();
      if (selectedSection === id) {
        onSelectedSectionChange(null);
      } else {
        onSelectedSectionChange(id);
      }
    },
    [onUserAction, selectedSection, onSelectedSectionChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (sections.length === 0) return;
      const idx = sections.findIndex((sec) => sec.id === selectedSection);
      const current = idx >= 0 ? idx : 0;
      let next: number | null = null;
      if (isVertical) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          next = sections[(current + 1) % sections.length].id;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          next = sections[(current - 1 + sections.length) % sections.length].id;
        }
      } else {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          next = sections[(current + 1) % sections.length].id;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          next = sections[(current - 1 + sections.length) % sections.length].id;
        }
      }
      if (e.key === 'Home') {
        e.preventDefault();
        next = sections[0].id;
      } else if (e.key === 'End') {
        e.preventDefault();
        next = sections[sections.length - 1].id;
      }
      if (next != null) {
        onUserAction?.();
        onSelectedSectionChange(next);
      }
    },
    [sections, selectedSection, onSelectedSectionChange, onUserAction, isVertical]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!canReorder) return;
      setDraggedId(sections[index].id);
      e.dataTransfer.setData('text/plain', String(sections[index].id));
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    },
    [canReorder, sections]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      if (!canReorder || draggedId == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    [canReorder, draggedId]
  );

  const handleDragLeave = useCallback(() => setDragOverIndex(null), []);
  const handleDragEnd = useCallback(() => {
    setDragOverIndex(null);
    setDraggedId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);
      setDraggedId(null);
      if (!canReorder || !onSectionOrderChange) return;
      const id = Number(e.dataTransfer.getData('text/plain'));
      if (Number.isNaN(id)) return;
      const dragIndex = sections.findIndex((sec) => sec.id === id);
      if (dragIndex === -1 || dragIndex === dropIndex) return;
      const ids = sections.map((sec) => sec.id);
      const [removed] = ids.splice(dragIndex, 1);
      ids.splice(dropIndex, 0, removed);
      onSectionOrderChange(ids);
    },
    [canReorder, onSectionOrderChange, sections]
  );

  const renderSectionButton = (section: AppSection, index: number) => {
    const Icon = section.icon;
    const isSelected = selectedSection === section.id;
    const showEmoji = section.iconEmoji != null;
    const isDropTarget = dragOverIndex === index;
    const isDragging = draggedId === section.id;
    return (
      <button
        key={section.id}
        type="button"
        data-section-id={section.id}
        role="tab"
        aria-selected={isSelected}
        aria-label={section.title}
        title={section.description}
        tabIndex={isSelected ? 0 : -1}
        draggable={canReorder}
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
        onClick={() => handleClick(section.id)}
        className={`flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 px-1 font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
          canReorder ? 'cursor-grab active:cursor-grabbing' : ''
        } ${isDragging ? 'opacity-50' : ''} ${isDropTarget ? 'ring-2 ring-primary ring-inset bg-primary/10' : ''}`}
        style={{
          backgroundColor: isSelected ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
          color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)',
        }}
      >
        {showEmoji ? (
          <span className="text-xl leading-none shrink-0" aria-hidden>
            {section.iconEmoji}
          </span>
        ) : (
          <Icon className="shrink-0" style={{ width: iconSize, height: iconSize }} aria-hidden />
        )}
        <span className={`${sectionTitleClass} truncate max-w-full`}>{section.title}</span>
      </button>
    );
  };

  const isLeft = position === 'left';
  const isRight = position === 'right';
  // Minimized strip: always visible when bar is minimized so the edge doesn't "disappear". Hover expands; Lock keeps expanded.
  const minimizedStrip = (
    <div className="flex items-center justify-center gap-1 w-full h-full">
      <button
        type="button"
        onClick={() => onBarMinimizedChange?.(false)}
        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label="Expand card bar"
        title="Expand card bar"
      >
        {position === 'bottom' && <ChevronUp className="w-3.5 h-3.5" aria-hidden />}
        {isLeft && <ChevronRight className="w-3.5 h-3.5" aria-hidden />}
        {isRight && <ChevronLeft className="w-3.5 h-3.5" aria-hidden />}
        {position === 'bottom' && <span>Expand</span>}
      </button>
      {typeof onBarLockExpandedChange === 'function' && (
        <button
          type="button"
          onClick={() => {
            onBarLockExpandedChange(true);
            onBarMinimizedChange?.(false);
          }}
          className="flex items-center justify-center p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          aria-label="Lock bar open"
          title="Lock bar open"
        >
          <Pin className="w-3.5 h-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
  // Selector strip: Rows (bottom) or Columns (left/right), position toggles (Rows vs Left/Right), plus minimize
  const selectorStrip = (showSelector || showPositionToggles) && (
    <div
      className={`flex items-center gap-1 shrink-0 border-border/60 bg-card/90 ${
        isVertical ? 'flex-wrap justify-center px-1.5 py-1' : 'justify-center'
      }`}
      style={
        position === 'bottom'
          ? {
              minHeight: BOTTOM_NAV_BAR_ROW_SELECTOR_STRIP_PX,
              borderBottomWidth: '1px',
              padding: '0 8px',
            }
          : {
              minHeight: CARD_BAR_SIDE_SELECTOR_STRIP_PX,
              borderBottomWidth: '1px',
              padding: '4px 6px',
            }
      }
      role="group"
      aria-label={isVertical ? 'Card bar columns and position' : 'Card bar rows'}
    >
      {isVertical ? (
        <>
          {showColumnSelector && (
            <div className="flex w-full items-center justify-center gap-1">
              <span className="text-[10px] text-muted-foreground">Cols</span>
              {ROW_COL_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onCardBarColumnsChange?.(clampCardBarColumns(value))}
                  className={`min-w-[1.2rem] py-0.5 px-0.5 rounded text-[9px] leading-none font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                    cardBarColumns === value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  }`}
                  aria-pressed={cardBarColumns === value}
                  aria-label={value === 0 ? 'Auto columns' : `${value} column${value === 1 ? '' : 's'}`}
                >
                  {value === 0 ? 'A' : label}
                </button>
              ))}
            </div>
          )}
          {showPositionToggles && (
            <div className="flex w-full items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => onCardBarPositionChange?.('bottom')}
                className={`${compactIconButtonClass} ${
                  position === 'bottom' ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
                aria-label="Rows at bottom"
                title="Show card bar at bottom"
                aria-pressed={position === 'bottom'}
              >
                <Rows2 className="w-3 h-3" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onCardBarPositionChange?.('left')}
                className={`${compactIconButtonClass} ${
                  position === 'left' ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
                aria-label="Cards on left"
                title="Show cards on left"
                aria-pressed={position === 'left'}
              >
                <PanelLeft className="w-3 h-3" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onCardBarPositionChange?.('right')}
                className={`${compactIconButtonClass} ${
                  position === 'right' ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
                aria-label="Cards on right"
                title="Show cards on right"
                aria-pressed={position === 'right'}
              >
                <PanelRight className="w-3 h-3" aria-hidden />
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {showRowSelector && (
            <>
              <span className="text-[10px] text-muted-foreground mr-1">Rows</span>
              {ROW_COL_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onCardBarRowsChange?.(clampCardBarRows(value))}
                  className={`min-w-[2rem] py-1 px-1.5 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                    cardBarRows === value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  }`}
                  aria-pressed={cardBarRows === value}
                  aria-label={value === 0 ? 'Auto rows' : `${value} row${value === 1 ? '' : 's'}`}
                >
                  {label}
                </button>
              ))}
            </>
          )}
          {showPositionToggles && (
            <>
              {showRowSelector && <span className="text-[10px] text-muted-foreground mx-0.5">|</span>}
              <button
                type="button"
                onClick={() => onCardBarPositionChange?.('left')}
                className={`flex items-center gap-0.5 py-0.5 px-1 rounded text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                  (position as CardBarPosition) === 'left' ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
                aria-label="Cards on left"
                title="Show cards on left"
                aria-pressed={(position as CardBarPosition) === 'left'}
              >
                <PanelLeft className="w-3 h-3" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onCardBarPositionChange?.('right')}
                className={`flex items-center gap-0.5 py-0.5 px-1 rounded text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
                  (position as CardBarPosition) === 'right' ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-muted-foreground hover:bg-muted'
                }`}
                aria-label="Cards on right"
                title="Show cards on right"
                aria-pressed={(position as CardBarPosition) === 'right'}
              >
                <PanelRight className="w-3 h-3" aria-hidden />
              </button>
            </>
          )}
        </>
      )}
      <div className={isVertical ? 'flex w-full items-center justify-center gap-1' : 'flex items-center'}>
        {typeof onBarLockExpandedChange === 'function' && (
          <button
            type="button"
            onClick={() => onBarLockExpandedChange?.(!barLockExpanded)}
            className={`flex items-center justify-center p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
              barLockExpanded ? 'text-primary bg-primary/15' : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
            aria-label={barLockExpanded ? 'Unlock bar (allow collapse)' : 'Lock bar open'}
            title={barLockExpanded ? 'Unlock bar (allow collapse)' : 'Lock bar open'}
            aria-pressed={barLockExpanded}
          >
            {barLockExpanded ? <PinOff className="w-3.5 h-3.5" aria-hidden /> : <Pin className="w-3.5 h-3.5" aria-hidden />}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            onBarMinimizedChange?.(true);
            onBarLockExpandedChange?.(false);
          }}
          className={`${isVertical ? '' : 'ml-0.5 '}p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset`}
          aria-label="Minimize card bar"
          title="Minimize card bar"
        >
          {position === 'bottom' && <ChevronDown className="w-3.5 h-3.5" aria-hidden />}
          {position === 'left' && <ChevronLeft className="w-3.5 h-3.5" aria-hidden />}
          {position === 'right' && <ChevronRight className="w-3.5 h-3.5" aria-hidden />}
        </button>
      </div>
    </div>
  );

  const nav = (
    <nav
      role="tablist"
      aria-label="Sections"
      onKeyDown={handleKeyDown}
      className="grid gap-0 shrink-0"
      style={
        position === 'bottom'
          ? {
              gridTemplateRows: `repeat(${rowCount}, minmax(${BOTTOM_NAV_BAR_ROW_HEIGHT_PX}px, auto))`,
              gridTemplateColumns: `repeat(${bottomColumnCount}, minmax(0, 1fr))`,
              gridAutoFlow: 'row',
              minHeight: rowCount * BOTTOM_NAV_BAR_ROW_HEIGHT_PX,
            }
          : {
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${sideRowCount}, minmax(${sideCellHeightPx}px, auto))`,
              gridAutoFlow: 'column',
              width: columnCount * sideCellWidthPx,
              minHeight: sideRowCount * sideCellHeightPx,
            }
      }
    >
      {sections.map((sec, i) => renderSectionButton(sec, i))}
    </nav>
  );

  const wrapperStyle =
    position === 'bottom'
      ? {
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }
      : position === 'left'
        ? { left: 0, top: 0, bottom: 0 }
        : { right: 0, top: 0, bottom: 0 };

  const stripOnlyStyle = {
    ...(position === 'bottom'
      ? { minHeight: CARD_BAR_MINIMIZED_STRIP_PX }
      : { width: CARD_BAR_MINIMIZED_STRIP_PX }),
    borderTopWidth: position === 'bottom' ? 1 : 0,
    borderLeftWidth: position === 'left' ? 1 : 0,
    borderRightWidth: position === 'right' ? 1 : 0,
  };

  const fullBarStyle = {
    borderTopWidth: position === 'bottom' ? 1 : 0,
    borderLeftWidth: position === 'left' ? 1 : 0,
    borderRightWidth: position === 'right' ? 1 : 0,
    ...(position === 'bottom'
      ? { flexDirection: 'column' as const }
      : { flexDirection: 'column' as const, width: columnCount * sideCellWidthPx }),
  };

  const bottomMaxWidthPct = position === 'bottom' ? Math.min(100, sectionWidthPercent) : undefined;

  /** Left/right bar: section grid can be taller than the viewport; scroll inside the bar so controls stay reachable. */
  const sectionNavScrollable = (
    <div
      className={`min-h-0 flex-1 overflow-x-hidden ${isVertical ? 'overflow-y-hidden' : 'overflow-y-auto'} overscroll-y-contain`}
      role="presentation"
    >
      {nav}
    </div>
  );

  const fullBarContent =
    position === 'bottom' && bottomMaxWidthPct != null ? (
      <div className="mx-auto flex min-w-0 w-full max-w-full flex-col" style={{ maxWidth: `${bottomMaxWidthPct}%` }}>
        {(showSelector || showPositionToggles) ? selectorStrip : null}
        {nav}
      </div>
    ) : (
      <>
        {(showSelector || showPositionToggles) ? selectorStrip : null}
        {sectionNavScrollable}
      </>
    );

  return (
    <div
      className={`fixed z-[100] flex min-h-0 max-w-full min-w-0 shrink-0 border-border bg-card shadow-lg ${
        isVertical ? 'flex-col overflow-x-hidden overflow-y-hidden' : 'overflow-x-auto overflow-y-hidden'
      }`}
      style={{
        ...wrapperStyle,
        ...(showExpanded ? fullBarStyle : stripOnlyStyle),
        backgroundColor: 'var(--card)',
      }}
      onMouseEnter={barMinimized ? () => setHoverExpanded(true) : undefined}
      onMouseLeave={barMinimized ? () => { if (!barLockExpanded) setHoverExpanded(false); } : undefined}
    >
      {showExpanded ? fullBarContent : minimizedStrip}
    </div>
  );
}

export const BottomNavBar = memo(BottomNavBarComponent);
