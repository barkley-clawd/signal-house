"use client";

import { useMemo, useState, useCallback } from "react";
import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { rankModelUsage } from "@/lib/rank-models";
import type { RankedModelEntry } from "@/lib/rank-models";
import { UsageBar } from "@/components/UsageBar";
import { cn } from "@/lib/utils";
import { averageCostPerMessage, hasDetailData, totalTokens } from "./model-usage-utils";
import type { DashboardWindowSessionUsageSummary } from "@/types";

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export interface ModelUsageRankListProps {
  sessionUsage: DashboardWindowSessionUsageSummary | null;
}

function ModelRow({
  entry,
  expanded,
  maxMessages,
  maxTokens,
  maxCost,
  onToggle,
}: {
  entry: RankedModelEntry;
  expanded: boolean;
  maxMessages: number;
  maxTokens: number;
  maxCost: number;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-card-border bg-card-bg p-3 transition-colors hover:bg-card-hover">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${entry.modelName}: ${entry.messages} messages`}
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-text-muted" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
          {entry.modelName}
        </span>
        <span className="shrink-0 text-xs text-text-muted tabular-nums">
          {Math.round(entry.proportion * 100)}%
        </span>
        <span className="shrink-0 text-xs text-text-muted tabular-nums">
          {formatNumber(entry.messages)} msgs
        </span>
      </button>

      <UsageBar
        value={entry.messages}
        max={maxMessages}
        color="bg-accent-primary"
        label={`${entry.modelName}: ${Math.round(entry.proportion * 100)} percent of messages`}
        className="mt-2"
      />

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-3 border-t border-card-border pt-2">
              {!hasDetailData(entry) ? (
                <p className="text-xs text-text-muted">No token data available</p>
              ) : (
                <div className="grid grid-cols-7 gap-1 text-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-text-muted">Messages</span>
                    <span className="text-xs font-mono tabular-nums text-text-secondary">{formatNumber(entry.messages)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-text-muted">In</span>
                    <span className="text-xs font-mono tabular-nums text-text-secondary">{formatNumber(entry.inputTokens)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-text-muted">Out</span>
                    <span className="text-xs font-mono tabular-nums text-text-secondary">{formatNumber(entry.outputTokens)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-text-muted">Cache R</span>
                    <span className="text-xs font-mono tabular-nums text-text-secondary">{formatNumber(entry.cacheReadTokens)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-text-muted">Cache W</span>
                    <span className="text-xs font-mono tabular-nums text-text-secondary">{formatNumber(entry.cacheWriteTokens)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-text-muted">Total</span>
                    <span className="text-xs font-mono tabular-nums text-text-secondary">{formatNumber(totalTokens(entry as any))}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-[0.06em] text-text-muted">Cost</span>
                    <span className={cn("text-xs font-mono tabular-nums", entry.cost != null && entry.cost > 0 ? "text-accent-primary" : "text-text-secondary")}>{formatCurrency(entry.cost)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.06em] text-text-muted">
                    <span>Token share</span>
                    <span>{Math.round((maxTokens > 0 && totalTokens(entry as any) != null ? (totalTokens(entry as any)! / maxTokens) : 0) * 100)}%</span>
                  </div>
                  <UsageBar value={totalTokens(entry as any) ?? 0} max={maxTokens} size="md" color="bg-chart-1" label={`${entry.modelName}: token share`} animated={false} />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.06em] text-text-muted">
                    <span>Cost share</span>
                    <span>{Math.round((maxCost > 0 && entry.cost != null ? entry.cost / maxCost : 0) * 100)}%</span>
                  </div>
                  <UsageBar value={entry.cost ?? 0} max={maxCost} size="md" color="bg-chart-2" label={`${entry.modelName}: cost share`} animated={false} />
                </div>
                <p className="text-[10px] text-text-muted">
                  Avg cost / message: {formatCurrency(averageCostPerMessage(entry))}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ModelUsageRankList({ sessionUsage }: ModelUsageRankListProps) {
  const modelUsage = useMemo(() => sessionUsage?.modelUsage ?? [], [sessionUsage?.modelUsage]);
  const ranked = useMemo(() => rankModelUsage(modelUsage), [modelUsage]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandAllMode, setExpandAllMode] = useState(false);

  const toggle = useCallback((name: string) => {
    if (expandAllMode) {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    } else {
      setExpanded((prev) => (prev.has(name) ? new Set() : new Set([name])));
    }
  }, [expandAllMode]);

  const expandAll = useCallback(() => {
    setExpandAllMode(true);
    setExpanded(new Set(ranked.map((e) => e.modelName)));
  }, [ranked]);

  const collapseAll = useCallback(() => {
    setExpandAllMode(false);
    setExpanded(new Set());
  }, []);

  if (modelUsage.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        <BarChart3 className="size-6 text-text-muted" aria-hidden="true" />
        <p className="text-sm font-medium text-text-secondary">No model usage recorded</p>
        <p className="text-xs text-text-muted">
          Model data appears once OpenCode provider calls are made
        </p>
      </div>
    );
  }

  const maxMessages = useMemo(
    () => (ranked.length > 0 ? Math.max(...ranked.map((e) => e.messages)) : 0),
    [ranked],
  );
  const maxTokens = useMemo(() => Math.max(0, ...ranked.map((e) => totalTokens(e) ?? 0)), [ranked]);
  const maxCost = useMemo(() => Math.max(0, ...ranked.map((e) => e.cost ?? 0)), [ranked]);

  const allExpanded = expandAllMode;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm">
        <span className="text-text-muted">
          Sessions{" "}
          <span className="font-semibold text-text-primary tabular-nums">
            {sessionUsage!.totalSessions}
          </span>
        </span>
        <span className="text-text-muted">
          Messages{" "}
          <span className="font-semibold text-text-primary tabular-nums">
            {formatNumber(sessionUsage!.messages)}
          </span>
        </span>
        <span className="text-text-muted">
          Tokens{" "}
          <span className="font-semibold text-text-primary tabular-nums">
            {formatNumber(totalTokens(sessionUsage!))}
          </span>
        </span>
        <span className="text-text-muted">
          Cost{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              sessionUsage!.totalCost != null && sessionUsage!.totalCost > 0
                ? "text-accent-primary"
                : "text-text-primary",
            )}
          >
            {formatCurrency(sessionUsage!.totalCost)}
          </span>
        </span>
      </div>

      {ranked.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            className="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={allExpanded ? collapseAll : expandAll}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {ranked.map((entry) => (
          <ModelRow
            key={entry.modelName}
            entry={entry}
            expanded={expanded.has(entry.modelName)}
            maxMessages={maxMessages}
            maxTokens={maxTokens}
            maxCost={maxCost}
            onToggle={() => toggle(entry.modelName)}
          />
        ))}
      </div>
    </div>
  );
}
