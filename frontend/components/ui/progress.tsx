"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
}

const toneClasses: Record<NonNullable<ProgressProps["tone"]>, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, tone = "primary", ...props }, ref) => {
    const clamped = Math.max(0, Math.min(max, value));
    const pct = max === 0 ? 0 : (clamped / max) * 100;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        className={cn("relative h-2 w-full overflow-hidden rounded-none bg-muted", className)}
        {...props}
      >
        <div
          className={cn("h-full rounded-none transition-all duration-500 ease-out", toneClasses[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";
