"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type PriorityTier =
  | "ci-failing"
  | "ci-blocked"
  | "ci-pending"
  | "stale"

interface AttentionRowProps {
  kind: "issue" | "pr"
  title: string
  number?: number
  repo: string
  url: string
  ageDays: number
  priorityTier: PriorityTier
  statusLabel: string
}

const dotColor: Record<PriorityTier, string> = {
  "ci-failing": "bg-status-error",
  "ci-blocked": "bg-status-warning",
  "ci-pending": "bg-status-info",
  stale: "bg-status-stale",
}

const badgeKind: Record<
  "issue" | "pr",
  { label: string; className: string }
> = {
  issue: {
    label: "IS",
    className: "bg-status-warning/15 text-status-warning",
  },
  pr: {
    label: "PR",
    className: "bg-status-info/15 text-status-info",
  },
}

function AttentionRow({
  kind,
  title,
  number,
  repo,
  url,
  ageDays,
  priorityTier,
  statusLabel,
}: AttentionRowProps) {
  function openLink() {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") openLink()
  }

  return (
    <div
      className={cn(
        "group flex flex-col gap-1 rounded-lg px-3 py-2 text-sm transition-colors",
        "bg-card-bg hover:bg-card-hover cursor-pointer",
        "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:outline-none"
      )}
      tabIndex={0}
      role="link"
      onClick={openLink}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full", dotColor[priorityTier])}
          aria-hidden="true"
        />

        <span
          className={cn(
            "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl px-2 py-0.5 text-xs font-semibold",
            badgeKind[kind].className
          )}
        >
          {badgeKind[kind].label}
        </span>

        {kind === "pr" && number != null && (
          <span className="shrink-0 font-mono text-xs text-text-muted">
            #{number}
          </span>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              className={cn(
                "min-w-0 truncate text-left text-text-primary transition-colors",
                "group-hover:text-accent-primary"
              )}
            >
              {title}
            </TooltipTrigger>
            <TooltipContent>{title}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <span className="hidden shrink-0 font-mono text-xs text-text-muted md:inline">
          {repo}
        </span>

        <span className="hidden shrink-0 font-mono text-xs tabular-nums text-text-muted md:inline">
          {ageDays}d
        </span>

        <span className="hidden md:inline">
          <span
            className={cn(
              "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl border border-divider px-2 py-0.5 text-xs font-medium text-text-muted"
            )}
          >
            {statusLabel}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <span className="font-mono text-xs tabular-nums text-text-muted">
          {ageDays}d
        </span>
        <span
          className={cn(
            "inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl border border-divider px-2 py-0.5 text-xs font-medium text-text-muted"
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

export { AttentionRow }
export type { AttentionRowProps, PriorityTier }
