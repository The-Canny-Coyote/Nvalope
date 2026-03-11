'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { useHint } from '@/app/contexts/HintContext';

export interface HintIconProps {
  /** Unique id; used when the user dismisses this info. */
  id: string;
  /** Popover content (plain text or JSX). */
  children: React.ReactNode;
  /** Optional class for the ? trigger. */
  className?: string;
  /** Where the popover opens relative to the trigger. */
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Optional info icon that opens a popover. User can dismiss so it disappears.
 * Renders nothing when the global toggle is off or this one was dismissed.
 */
export function HintIcon({ id, children, className = '', side = 'top' }: HintIconProps) {
  const { masterEnabled, isDisabled, disableHint } = useHint();
  const [open, setOpen] = useState(false);

  if (!masterEnabled || isDisabled(id)) return null;

  const handleDismiss = () => {
    disableHint(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full bg-transparent border-0 p-0 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 cursor-pointer ${className}`}
        aria-label="More information"
      >
        <Info className="w-3.5 h-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent side={side} align="start" className="max-w-[280px] p-3 text-sm">
        <div className="text-foreground mb-2">{children}</div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-muted-foreground hover:text-foreground underline"
          aria-label="Don't show again"
        >
          Don&apos;t show again
        </button>
      </PopoverContent>
    </Popover>
  );
}
