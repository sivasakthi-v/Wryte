"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface InfoTooltipProps {
  /** The explanation shown inside the tooltip. Keep it short — 1-2 sentences. */
  children: React.ReactNode;
  /** Accessible label for the trigger. */
  label?: string;
  className?: string;
  iconClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

/**
 * Small inline info icon that reveals a tooltip on hover / focus.
 * Use this next to every metric, bucket name, and technical term so
 * users who don't know what "Flesch-Kincaid" means can learn in one step.
 */
export function InfoTooltip({
  children,
  label = "More info",
  className,
  iconClassName,
  side = "top",
  align = "center",
}: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <Info className={cn("h-3.5 w-3.5", iconClassName)} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} align={align}>
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
