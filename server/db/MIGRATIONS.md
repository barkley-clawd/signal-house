# Database Migration History

Signal House applies database migrations from `server/db/schema.ts` at startup through the
`migrate()` function in `server/db/client.ts`. Each migration is a versioned SQL block keyed
to a specific `SCHEMA_VERSION` bump.

The current schema version is `SCHEMA_VERSION = 18`. When `migrate()` detects an older schema
version in `latest_state`, it runs the applicable blocks sequentially. Below SCHEMA_VERSION 10
the path is destructive (`DROP` + recreate). From version 10 onward, blocks apply conditionally
with column-existence guards (`PRAGMA table_info(...)`).

## Versioned migration blocks

| # | Block | Version | Commit | PR | Tables | Self-destruct? | Why | Still needed? |
|---|-------|---------|--------|-----|--------|---------------|-----|---------------|
| 1 | `migrateSourcePullRequestsV14` | v13 → v14 | [`715b8b5`](https://github.com/barkley-assistant/signal-house/commit/715b8b5) | [#316](https://github.com/barkley-assistant/signal-house/pull/316) | `source_pull_requests` | Yes — creates `_v2`, copy, DROP, RENAME | Composite PK `(repo_key, id)` to match issue schema and avoid FK duplication | Yes — any pre-v14 database needs it |
| 2 | `createDailyMetricsV3` | v3 | [`1e23672`](https://github.com/barkley-assistant/signal-house/commit/1e23672) | — | `daily_metrics` | No | Initial metrics scaffold with columns for issues, PRs, CI, sessions, cycle time, warnings | Yes — still needed in the destructive < v10 path |
| 3 | `createDailyTokenUsageTable` | v10 | [`1c4d42d`](https://github.com/barkley-assistant/signal-house/commit/1c4d42d) | [#232](https://github.com/barkley-assistant/signal-house/pull/232) | `daily_token_usage` | No | Token usage collection (sessions, messages, cost, model breakdown) | Yes — base table for all token usage data |
| 4 | `migrateDailyTokenUsageV15` | v14 → v15 | [`8804e67`](https://github.com/barkley-assistant/signal-house/commit/8804e67) | [#317](https://github.com/barkley-assistant/signal-house/pull/317) | `daily_token_usage` | No — simple `DROP COLUMN` | Remove redundant `total_tokens` column after adding `tokensReasoning` | No — no-op on fresh install, guarded by `PRAGMA table_info` |
| 5 | `migrateDailyTokenUsageV16` | v15 → v16 | [`624327c`](https://github.com/barkley-assistant/signal-house/commit/624327c) | [#331](https://github.com/barkley-assistant/signal-house/pull/331) | `daily_token_usage` | Yes — creates `_v16`, copy, DROP, RENAME | Add `source` discriminator column and PK `(date, source)` for Hermes Agent | Yes — any pre-v16 database needs it |
| 6 | `migrateRepositoryPresenceV17` | v16 → v17 | [`3075d8f`](https://github.com/barkley-assistant/signal-house/commit/3075d8f) | [#341](https://github.com/barkley-assistant/signal-house/pull/341) | `source_repositories`, `source_local_git` | No — `ALTER TABLE ADD COLUMN` | Track `present`/`last_seen_at` to hide removed repos from Discovered Repositories | No — no-op on fresh install, guarded by `PRAGMA table_info` |
| 7 | `updateDailyTokenUsageModelUsageV18` | v17 → v18 | [`b2b7ac7`](https://github.com/barkley-assistant/signal-house/commit/b2b7ac7) | — | `daily_token_usage` | No — in-code transformation (JS in `client.ts`) | Normalize LLM model names across ingestion, storage, and display | No — no-op on fresh install |

### Self-destruct blocks

Blocks marked **Yes** use a shadow-table pattern: create `_vN` table, copy data, DROP original,
RENAME shadow to original. A fresh install runs the migration once and ends with the same shape
as the live table. These blocks **cannot be deleted** from `schema.ts` without a version guard,
because any pre-v13 or pre-v15 database in the wild still needs them.

### Adding future entries

When adding a new migration block to `schema.ts`:

1. Bump `SCHEMA_VERSION` by 1.
2. Add a new row to the table above in this file.
3. In the `migrate()` function in `client.ts`, add a guarded block: `if (current < N) { ... }`.
4. If the migration is destructive (shadow table), set Self-destruct to **Yes**.
5. For non-destructive `ALTER TABLE` additions, use `PRAGMA table_info(...)` to guard against re-execution.