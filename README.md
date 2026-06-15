# Signal House

Signal House is the internal dashboard I’m building to tell me whether Clawd is actually healthy or just looking busy.

It is deliberately not a generic analytics toy. It is meant for the person running the system day to day, so the questions are blunt:

- Is work flowing?
- Where is it getting stuck?
- Are PRs moving?
- Is CI behaving?
- Are we collecting useful signal or just accumulating noise?

If the app cannot answer those questions quickly, it is not doing its job.

## Why this exists

I wanted a dashboard that does one thing well: surface the health of the workstream without making me dig through GitHub tabs, logs, or terminal history every time.

The reason for the name is the same reason for the build. I wanted something that feels like a place where useful signal lives, not another sterile metrics box.

## What V1 should do

V1 should stay tight and honest:

- a top-level health summary
- a few useful trend charts
- a compact table of blocked or stale work
- recent CI / check outcomes
- recent tool or session usage
- obvious empty, loading, and error states

It should not try to become a full observability platform. That is how projects get bloated and useless.

## Why this stack

Signal House uses:

- **Nuxt 3**
- **Vue 3**
- **TypeScript**
- **Nuxt UI**
- **Pinia**
- **ECharts**
- **SQLite**

I picked this stack because it gives me the shortest path to something shippable without painting myself into a corner.

Nuxt gives me a clean full-stack structure and keeps the server and UI in one place. Vue is a good fit for dashboard UI. TypeScript keeps the moving parts honest. SQLite is boring in the best possible way for local cached snapshots. ECharts is good enough for the charts without forcing me to build a charting system from scratch.

Nuxt UI is the real trade here: it lets the app feel like a proper operator tool quickly, instead of spending a week hand-assembling cards and tables just to rediscover why frameworks exist.

## Likely data sources

The dashboard should use data that actually exists:

- GitHub issues
- GitHub pull requests
- GitHub Actions / check runs
- local git history from repos on disk
- local OpenCode / OpenClaw session metadata when available
- local logs if they are easy to ingest

If a metric is not available yet, the right move is to add instrumentation or file an issue, not fake the number.

## Architecture

The shape is intentionally simple:

- Nuxt server routes collect and cache metrics
- SQLite stores snapshots and latest aggregates locally
- the frontend reads from local API routes only
- refresh logic is explicit and predictable
- data collection can be triggered manually and later scheduled

That keeps the system inspectable and easy to run on the machine that hosts Clawd.

## Local Development

### Prerequisites

- **Node.js 18+** and **npm** (or **pnpm** if preferred)
- **OpenCode CLI** (for session usage metrics — optional, falls back gracefully)

### Install and run

```bash
# Install dependencies
npm install

# Start the dev server (bound to 0.0.0.0 for LAN access)
npm run dev
```

The `--host 0.0.0.0` flag is set in `package.json` so the dev server is reachable from other devices on the same network.

### Expected URLs

| Location | URL |
|----------|-----|
| Local machine | `http://localhost:3000` |
| LAN (other device) | `http://<host-lan-ip>:3000` |

Find the host LAN IP with:

```bash
# Linux
hostname -I | awk '{print $1}'

# macOS
ipconfig getifaddr en0
```

### Configuring data sources

Set these environment variables before starting the dev server:

```bash
# Preferred env names for Signal House
export SECRET_HOUSE_GITHUB_TOKEN=ghp_your_token_here
export SECRET_HOUSE_GITHUB_OWNER=your-org-or-user
export SECRET_HOUSE_GITHUB_REPO=your-repo
export SECRET_HOUSE_GIT_REPOS=/path/to/repo1,/path/to/repo2
export SECRET_HOUSE_OPENCODE_BIN=
export SECRET_HOUSE_OPENCODE_COMMAND=opencode
export SECRET_HOUSE_SESSIONS_PERIOD_DAYS=30
export SECRET_HOUSE_POLLER_ENABLED=true
export SECRET_HOUSE_POLL_INTERVAL_SECONDS=300
export SECRET_HOUSE_POLL_STARTUP_DELAY_SECONDS=5
export SECRET_HOUSE_RUN_ON_STARTUP=true

# Legacy compatibility names still work for now:
# GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GIT_REPOS, OPENCODE_BIN,
# OPENCODE_COMMAND, SESSIONS_PERIOD_DAYS, METRICS_POLLER_ENABLED,
# METRICS_POLL_INTERVAL_SECONDS, METRICS_POLL_STARTUP_DELAY_SECONDS,
# METRICS_RUN_ON_STARTUP

# Optional: Session / OpenCode CLI metrics
# Resolved in order: config.opencodeBin > SECRET_HOUSE_OPENCODE_BIN > $PATH 'opencode' > $HOME/.opencode/bin/opencode > fallback path > config.opencodeCommand > SECRET_HOUSE_OPENCODE_COMMAND
# OPENCODE_COMMAND and config.opencodeCommand are compatibility-only fallbacks.
# The collector runs `opencode stats --days <period>` and parses the overview + tool usage tables.
export SECRET_HOUSE_OPENCODE_BIN=
export SECRET_HOUSE_OPENCODE_COMMAND=opencode
export SECRET_HOUSE_SESSIONS_PERIOD_DAYS=30
```

Create a `.env` file in the project root to persist these:

```bash
SECRET_HOUSE_GITHUB_TOKEN=ghp_your_token_here
SECRET_HOUSE_GITHUB_OWNER=your-org-or-user
SECRET_HOUSE_GITHUB_REPO=your-repo
SECRET_HOUSE_GIT_REPOS=/path/to/repo1,/path/to/repo2
SECRET_HOUSE_OPENCODE_BIN=
SECRET_HOUSE_OPENCODE_COMMAND=opencode # compatibility fallback only
SECRET_HOUSE_SESSIONS_PERIOD_DAYS=30
SECRET_HOUSE_POLLER_ENABLED=true
SECRET_HOUSE_POLL_INTERVAL_SECONDS=300
SECRET_HOUSE_POLL_STARTUP_DELAY_SECONDS=5
SECRET_HOUSE_RUN_ON_STARTUP=true
```

### Manual Data Refresh

Once the dashboard is running, click the **Refresh** button in the top-right corner to trigger data collection from all configured sources. The dashboard continues showing cached data while the refresh runs in the background. If a refresh is already in progress, subsequent requests are rejected until it completes.

GitHub rate limits apply. Cached data is kept and displayed even when GitHub is slow or unreachable, with a "stale data" indicator when the cache is older than 15 minutes.

### Firewall Note

If the OS firewall blocks port `3000`, allow LAN access for that port:

```bash
# Linux (iptables)
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT

# Linux (firewalld)
sudo firewall-cmd --add-port=3000/tcp
```

### Local Verification

Run the same commands the CI workflow uses:

```bash
# Install dependencies from the lockfile
npm ci

# Generate Nuxt build and tsconfig artifacts
npm exec nuxi prepare

# Run the test suite
npm test

# TypeScript type check
npm run typecheck

# Production build
npm run build
```

## Daily metrics persistence

When a refresh completes, the orchestrator computes per-day metric rollups from the raw source data and persists them into the `daily_metrics` table.

### Schema

Each row is keyed by a single calendar day (`YYYY-MM-DD` UTC) and stores aggregate-level numeric rollups:

| Column | Type | Description |
|--------|------|-------------|
| `day` | TEXT PK | Calendar day in `YYYY-MM-DD` UTC |
| `captured_at` | TEXT | ISO 8601 timestamp of the refresh that produced this row |
| `source` | TEXT | Data source identifier (e.g. `orchestrated`) |
| `version` | INTEGER | Schema version for future migrations |
| `reflects_complete_data` | INTEGER | `1` if no collector errors occurred |
| `issues_opened` / `issues_closed` | INTEGER | Per-day issue throughput |
| `prs_created` / `prs_merged` | INTEGER | Per-day PR throughput |
| `total_commits` | INTEGER | Sum of recent commits across all local git repos |
| `avg_cycle_time_days` / `median_cycle_time_days` / `p95_cycle_time_days` | REAL | Cycle time statistics |
| `cycle_time_sample_size` | INTEGER | Sample size for cycle time stats |
| `ci_total_runs` / `ci_pass_count` / `ci_fail_count` | INTEGER | Per-day CI outcome counts |
| `ci_pass_rate` | REAL | `pass / total` |
| `ci_avg_duration_ms` | REAL | Average CI run duration |
| `total_sessions` / `session_error_count` | INTEGER | Per-day session counts |
| `stale_issues` / `stale_prs` | INTEGER | Stale work snapshot |
| `warnings` | TEXT | JSON array of warning strings |

### Behaviour

- **Same-day overwrite**: Inserting a row for an existing day replaces the previous record (upsert-by-day).
- **Historical preservation**: Days from earlier calendar dates are never modified by a new refresh.
- **Missing days**: Days with no data are omitted from results — no zero-filled rows are returned.
- **Range query**: `getDailyMetricsRange(fromDay, toDay)` returns rows in descending day order.

### Local verification

```bash
# Run the full test suite (includes daily metrics tests)
npm test

# TypeScript type check
npm run typecheck

# Production build
npm run build
```


### `/api/state` 28-day contract

`GET /api/state` keeps the existing snapshot and refresh metadata, and now adds `dashboardWindow` for the rolling 28-day dashboard view.

- `dashboardWindow.startDay` and `dashboardWindow.endDay` are UTC `YYYY-MM-DD` keys.
- `dashboardWindow.days` is normalized for chart consumption in ascending day order.
- Missing days stay explicit with `isGap: true` and `metrics: null`.
- `dashboardWindow.cards` contains the 28-day card-ready summaries for throughput, cycle time, CI, stale work, and session usage.
- `dashboardWindow.coverage` exposes gap and warning status so the UI can stay honest about partial data.
- `dashboardWindow.warnings` merges source warnings with a concise missing-day warning when gaps exist.

### 28-day regression coverage expectations

The 28-day dashboard work should keep these regressions covered as the data model, API, and UI evolve:

- daily window responses must keep their 28-day shape stable
- missing days must stay explicit instead of being silently filled in
- same-day refresh reruns must upsert today's data without rewriting earlier days
- refresh-in-progress and refresh failure states must still clear cleanly
- charts and summary cards must keep reading the 28-day period honestly on wider and narrower screens

## Data sync and ingestion

For V1, keep ingestion local and simple:

- refresh from GitHub on demand
- optionally add a timer later for periodic refresh
- cache responses locally so the UI still works when GitHub is slow or rate-limited
- keep the latest fetched snapshot available even if a refresh fails

No Docker Compose is needed for V1 unless a local SQLite helper or sidecar becomes necessary later. That would add complexity without enough payoff right now.

## Known limitations

V1 will not be a complete engineering analytics platform.

It will not yet do:

- alerting
- multi-team access control
- forecasting
- deployment tracking
- deep drill-down pages
- perfect cross-repo instrumentation

Some useful metrics will stay approximate until the underlying tooling emits better events.

## Suggested first implementation issue

Start with the project scaffold and metric model:

- Nuxt app skeleton
- basic layout and shell
- shared metric types
- local cached data shape
- placeholder data sources
- README-backed run instructions

That gives us a stable base before wiring in GitHub ingestion.
