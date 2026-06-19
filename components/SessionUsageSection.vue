<template>
  <UiCard title="Session Usage" :badge="badgeText">
    <template v-if="sessionUsage">
      <div v-if="isActive" class="session-usage">
        <div class="session-usage__group">
          <h4 class="session-usage__group-label">Summary</h4>
          <div class="session-usage__summary">
            <MetricCard label="Sessions" :value="sessionUsage.totalSessions" />
            <MetricCard label="Started" :value="sessionUsage.startedSessions ?? '—'" />
            <MetricCard label="Completed" :value="sessionUsage.completedSessions ?? '—'" />
            <MetricCard label="Messages" :value="sessionUsage.messages" />
            <MetricCard label="Active days" :value="sessionUsage.activeDays" />
            <MetricCard label="Total cost" :value="sessionUsage.totalCost" />
            <MetricCard label="Errors" :value="sessionUsage.erroredSessions ?? '—'" />
            <MetricCard label="Last activity" :value="formatTimestamp(sessionUsage.lastActivityAt)" />
          </div>
        </div>

        <div class="session-usage__group">
          <h4 class="session-usage__group-label">Tokens</h4>
          <div class="session-usage__token-grid">
            <MetricCard label="Input" :value="sessionUsage.inputTokens" />
            <MetricCard label="Output" :value="sessionUsage.outputTokens" />
            <MetricCard label="Cache read" :value="sessionUsage.cacheReadTokens" />
            <MetricCard label="Cache write" :value="sessionUsage.cacheWriteTokens" />
          </div>
          <div v-if="hasTokenMeta" class="session-usage__token-meta">
            <span v-if="sessionUsage.averageTokensPerSession != null">Avg/session: {{ formatNumber(sessionUsage.averageTokensPerSession) }}</span>
            <span v-if="sessionUsage.medianTokensPerSession != null">Median/session: {{ formatNumber(sessionUsage.medianTokensPerSession) }}</span>
            <span v-if="sessionUsage.averageCostPerDay != null">Avg/day: {{ formatCurrency(sessionUsage.averageCostPerDay) }}</span>
          </div>
        </div>

        <div class="session-usage__group">
          <h4 class="session-usage__group-label">Tools</h4>
          <div v-if="sessionUsage.toolUsage.length" class="session-usage__tools">
            <div v-for="tool in sessionUsage.toolUsage" :key="tool.toolName" class="session-usage__tool">
              <div class="session-usage__tool-head">
                <span class="session-usage__tool-name">{{ tool.toolName }}</span>
                <span class="session-usage__tool-count">{{ formatNumber(tool.count) }}<template v-if="tool.percentage != null"> · {{ formatPercent(tool.percentage) }}</template></span>
              </div>
              <div class="session-usage__tool-bar">
                <div class="session-usage__tool-fill" :style="{ width: `${tool.percentage ?? 0}%` }" />
              </div>
            </div>
          </div>
          <EmptyState v-else message="No tool usage recorded" hint="Tool data appears when OpenCode sessions use tools" />
        </div>

        <div class="session-usage__group">
          <h4 class="session-usage__group-label">Models</h4>
          <div v-if="sessionUsage.modelUsage.length" class="session-usage__models">
            <div v-for="model in sessionUsage.modelUsage" :key="model.modelName" class="session-usage__model">
              <div class="session-usage__model-head">
                <span class="session-usage__model-name">{{ model.modelName }}</span>
                <span class="session-usage__model-count">{{ formatNumber(model.messages) }} messages</span>
              </div>
              <div class="session-usage__model-grid">
                <MetricCard label="Input" :value="model.inputTokens ?? '—'" />
                <MetricCard label="Output" :value="model.outputTokens ?? '—'" />
                <MetricCard label="Cache read" :value="model.cacheReadTokens ?? '—'" />
                <MetricCard label="Cache write" :value="model.cacheWriteTokens ?? '—'" />
                <MetricCard label="Cost" :value="formatCurrency(model.cost)" />
              </div>
            </div>
          </div>
          <div v-else class="session-usage__empty-model">
            <EmptyState message="No model usage recorded" hint="Model data appears once OpenCode provider calls are made" />
          </div>
        </div>

        <p v-if="sessionUsage.message" class="session-usage__note">{{ sessionUsage.message }}</p>
      </div>

      <EmptyState
        v-else
        :message="fallbackMessage"
        :hint="fallbackHint"
      />
    </template>
    <EmptyState
      v-else
      message="Session usage unavailable"
      hint="Configure OpenCode stats collection to show this panel"
    />
  </UiCard>
</template>

<script setup lang="ts">
import type { DashboardWindowSessionUsageSummary } from '../types/snapshot'
import { formatCompactNumber } from '../utils/format'

const props = defineProps<{
  sessionUsage: DashboardWindowSessionUsageSummary | null
}>()

const badgeText = computed(() => props.sessionUsage?.periodStart && props.sessionUsage?.periodEnd
  ? `${props.sessionUsage.periodStart} to ${props.sessionUsage.periodEnd}`
  : undefined)

const isActive = computed(() => {
  const status = props.sessionUsage?.status
  return status === 'available' || status === 'partial' || status === 'stale'
})

const hasTokenMeta = computed(() =>
  props.sessionUsage?.averageTokensPerSession != null ||
  props.sessionUsage?.medianTokensPerSession != null ||
  props.sessionUsage?.averageCostPerDay != null
)

const fallbackMessage = computed(() => {
  const status = props.sessionUsage?.status
  if (status === 'unconfigured') return 'Session usage is not configured'
  if (status === 'unavailable') return 'Session usage unavailable'
  if (status === 'empty') return 'No session activity in this window'
  if (status === 'error') return 'Session usage collection failed'
  return props.sessionUsage?.message ?? 'Session usage unavailable'
})

const fallbackHint = computed(() => {
  const status = props.sessionUsage?.status
  if (status === 'unconfigured') return 'Configure OPENCODE_BIN or OPENCODE_COMMAND and rerun refresh'
  if (status === 'unavailable') return 'OpenCode stats could not be collected for this window'
  if (status === 'empty') return 'OpenCode is wired up, but there were no sessions to show'
  if (status === 'error') return 'Check the OpenCode stats collector and the refresh logs'
  return 'OpenCode stats are configured, but no session activity was collected in this window'
})

function formatNumber(value: number | null | undefined): string {
  return formatCompactNumber(value)
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(0)}%`
}
</script>

<style scoped>
.session-usage {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.session-usage__group-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.625rem;
}

.session-usage__panel-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: baseline;
}

.session-usage__panel-meta {
  font-size: 0.78rem;
  color: #94a3b8;
}

.session-usage__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem 1rem;
}

.session-usage__token-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem 1rem;
}

.session-usage__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.session-usage__panel {
  padding: 1rem;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  background: #0f172a;
}

.session-usage__panel--summary {
  margin-bottom: 0.25rem;
}

.session-usage__token-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem 1rem;
  margin-top: 0.5rem;
  font-size: 0.78rem;
  color: #64748b;
}

.session-usage__tools {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.session-usage__models {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.session-usage__model {
  padding: 0.75rem;
  border: 1px solid #1e293b;
  border-radius: 0.5rem;
  background: #020617;
}

.session-usage__model-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.625rem;
}

.session-usage__model-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #e2e8f0;
}

.session-usage__model-count {
  font-size: 0.78rem;
  color: #94a3b8;
}

.session-usage__model-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.5rem 0.75rem;
}

.session-usage__tool-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.8rem;
  color: #cbd5e1;
  margin-bottom: 0.3rem;
}

.session-usage__tool-name {
  font-weight: 500;
}

.session-usage__tool-count {
  color: #94a3b8;
  white-space: nowrap;
}

.session-usage__tool-bar {
  height: 0.4rem;
  background: #1e293b;
  border-radius: 999px;
  overflow: hidden;
}

.session-usage__tool-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #4ade80);
  border-radius: inherit;
}

.session-usage__note {
  font-size: 0.78rem;
  color: #94a3b8;
}

.session-usage__empty-model :deep(.empty-state) {
  padding: 1rem;
}

@media (max-width: 900px) {
  .session-usage__grid,
  .session-usage__summary,
  .session-usage__token-grid,
  .session-usage__model-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .session-usage__grid,
  .session-usage__summary,
  .session-usage__token-grid,
  .session-usage__model-grid {
    grid-template-columns: 1fr;
  }
}
</style>
