"use client";

import { cn } from "@/lib/utils";
import { getUsageBarWidth } from "./usage-bar-utils";

interface UsageBarProps {
  value: number;
  max: number;
  color?: string;
  size?: "sm" | "md";
  label?: string;
  animated?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-1.5",
  md: "h-2",
} as const;

export function UsageBar({
  value,
  max,
  color = "bg-accent-primary",
  size = "sm",
  label,
  animated = true,
  className,
}: UsageBarProps) {
  const widthStyle = getUsageBarWidth(value, max);
  if (widthStyle == null) return null;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-card-hover",
        sizeMap[size],
        className,
      )}
      role="img"
      aria-label={label}
    >
      <div
        className={cn(
          "h-full rounded-full",
          color,
          animated && "transition-all duration-300 ease-out",
        )}
        style={{ width: widthStyle }}
      />
    </div>
  );
}
