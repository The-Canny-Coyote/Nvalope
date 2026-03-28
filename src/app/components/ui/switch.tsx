"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

/**
 * Theme-aligned pill switch: glass-style track when unchecked (primary tint), theme primary when checked,
 * hover glow matching glass-button. Thumb touches top/bottom of pill. Track styles in src/styles/theme.css (.switch-track).
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "switch-track peer relative inline-flex h-5 w-14 shrink-0 cursor-pointer items-center rounded-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 shrink-0 rounded-full bg-white transition-transform",
          "shadow-[0_2px_4px_rgba(0,0,0,0.2)]",
          "data-[state=unchecked]:translate-x-0.5",
          "data-[state=checked]:translate-x-[2.125rem]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
