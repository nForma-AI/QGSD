# Requirements: QGSD

**Defined:** 2026-03-04
**Core Value:** Planning decisions are multi-model verified by structural enforcement, not instruction-following

## Baseline Requirements

*Included from QGSD baseline defaults (profile: cli). Cross-cutting quality gates.*

### UX Heuristics
- [x] **UX-01**: Every user-initiated action produces immediate feedback (loading/disabled state) and completion feedback (result message, navigation change, or visible state update)
- [x] **UX-02**: Destructive actions (delete, reset, remove, overwrite) require explicit confirmation or provide undo within a reasonable window
- [x] **UX-03**: Error messages are human-readable, explain what went wrong, and suggest a next step or recovery action

### Security
- [x] **SEC-01**: Pre-commit hook runs secret scanning (e.g., Gitleaks) to block commits containing API keys, tokens, passwords, or credentials
- [x] **SEC-02**: CI pipeline runs deep secret scanning (e.g., TruffleHog) across full repo history on every PR
- [x] **SEC-03**: All external input (user input, API request bodies, query parameters, file uploads) is validated and sanitized at system boundaries before processing
- [x] **SEC-04**: Dependencies are scanned for known vulnerabilities in CI

### Reliability
- [x] **REL-01**: Failures in external services (APIs, databases, third-party SDKs) are caught and handled gracefully
- [x] **REL-02**: Long-running operations show progress and can be interrupted

### Observability
- [x] **OBS-05**: CLI tools exit with appropriate codes (0 = success, non-zero = failure) and write structured output

### CI/CD
- [x] **CI-01**: Automated test suite runs on every pull request and merge to main is blocked when tests fail
- [x] **CI-02**: Linting and formatting checks run in CI and block merge on violations
- [x] **CI-03**: Type checking runs in CI and blocks merge on type errors

## Milestone v0.27 Requirements

### Observe Skill

- [ ] **OBS-01**: `/qgsd:observe` fetches issues from all configured sources (GitHub, Sentry, Sentry feedback, bash) in parallel and renders a severity-sorted triage table — same behavior as current `/qgsd:triage`
- [ ] **OBS-02**: Source types are pluggable — adding a new source type requires only a new fetch handler function and config entry, not changes to the observe orchestrator
- [ ] **OBS-03**: `/qgsd:observe` supports `prometheus` source type that executes a PromQL query against a configured endpoint and maps results to the standard issue schema
- [ ] **OBS-04**: `/qgsd:observe` supports `grafana` source type that fetches active alerts from a configured Grafana instance
- [ ] **OBS-05**: `/qgsd:observe` supports `logstash` source type that runs an Elasticsearch query against a configured endpoint and maps hits to the standard issue schema
- [ ] **OBS-06**: `/qgsd:observe` presents two output tables: **Issues** (discrete events — errors, bugs, feedback) and **Drifts** (quantitative divergences — formal parameter vs production measurement)
- [ ] **OBS-07**: Observe config lives in `.planning/observe-sources.md` YAML frontmatter (replacing `triage-sources.md`), backward-compatible with existing triage config format
- [ ] **OBS-08**: Each source fetch handler has a configurable timeout and fail-open behavior — one failing source does not block the others

### Debt Ledger

- [ ] **DEBT-01**: `.formal/debt.json` stores debt entries with schema: id, fingerprint, title, occurrences, first_seen, last_seen, environments[], status, formal_ref, source_entries[]
- [ ] **DEBT-02**: Debt entries are deduplicated by fingerprint — new observations with matching fingerprints increment occurrence count and update last_seen instead of creating duplicates
- [ ] **DEBT-03**: Debt status follows a state machine: `open` → `acknowledged` → `resolving` → `resolved`, with only forward transitions allowed (no reopening resolved debt)
- [ ] **DEBT-04**: A retention policy limits debt.json growth: entries older than a configurable max_age (default 90 days) with status `resolved` are archived to `.formal/debt-archive.jsonl`
- [ ] **DEBT-05**: Each debt entry can link to a formal reference (model file, parameter key, requirement ID) via the `formal_ref` field
- [ ] **DEBT-06**: `/qgsd:observe` writes new or updated debt entries after each run; the human triage step sets status to `acknowledged` for entries the user selects to work on

### Fingerprinting

- [ ] **FP-01**: Issues are fingerprinted using a hierarchical strategy: exception type → function name → message pattern hash, producing a stable fingerprint string
- [ ] **FP-02**: Drifts are fingerprinted by formal parameter key (e.g., `MCsafety.cfg:MaxDeliberation`) — identical parameter keys always map to the same fingerprint
- [ ] **FP-03**: Cross-source deduplication uses fingerprint matching first, then Levenshtein similarity (configurable threshold, default 0.85) on titles for near-duplicates from different sources
- [ ] **FP-04**: When two debt entries are merged by fingerprint, source_entries[] from both are preserved and the entry with higher occurrence count is kept as primary

### Solve P→F Integration

- [ ] **PF-01**: `bin/qgsd-solve.cjs` includes a P→F (Production → Formal) residual layer that reads `.formal/debt.json` and compares acknowledged drift entries against formal model thresholds
- [ ] **PF-02**: The P→F residual count equals the number of acknowledged debt entries where production measurements diverge from formal parameter values
- [ ] **PF-03**: Solve operates only on debt entries with status `acknowledged` — `open` entries are ignored until a human triages them
- [ ] **PF-04**: During a solve cycle, observations are frozen — new observe runs do not modify debt entries that are in `resolving` status
- [ ] **PF-05**: P→F remediation dispatches `/qgsd:quick` tasks to update formal model parameters when production reality has legitimately changed, or flags investigation when production has regressed

## Future Requirements

### v0.28+ Production Source Wiring

- **WIRE-01**: Real Prometheus endpoint auth (bearer token, mTLS) with credential management integration
- **WIRE-02**: Grafana OAuth2 authentication flow for dashboard API access
- **WIRE-03**: Elasticsearch index pattern configuration with field mapping
- **WIRE-04**: Confidence-based auto-suggest for triage (high-confidence issues pre-classified)
- **WIRE-05**: Poisson binomial re-run of PRISM on production drift parameters

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-promotion of issues to requirements | Human gate is a core design principle — observe surfaces signal, humans decide |
| Real-time streaming from sources | Batch pull model sufficient; streaming adds complexity with minimal value for CLI |
| Dashboard UI for debt visualization | Existing blessed TUI can display debt table; dedicated dashboard deferred |
| Alerting/notification system | QGSD is a CLI tool, not a monitoring service — users run observe when they want |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| OBS-01 | — | Pending |
| OBS-02 | — | Pending |
| OBS-03 | — | Pending |
| OBS-04 | — | Pending |
| OBS-05 | — | Pending |
| OBS-06 | — | Pending |
| OBS-07 | — | Pending |
| OBS-08 | — | Pending |
| DEBT-01 | — | Pending |
| DEBT-02 | — | Pending |
| DEBT-03 | — | Pending |
| DEBT-04 | — | Pending |
| DEBT-05 | — | Pending |
| DEBT-06 | — | Pending |
| FP-01 | — | Pending |
| FP-02 | — | Pending |
| FP-03 | — | Pending |
| FP-04 | — | Pending |
| PF-01 | — | Pending |
| PF-02 | — | Pending |
| PF-03 | — | Pending |
| PF-04 | — | Pending |
| PF-05 | — | Pending |

**Coverage:**
- v0.27 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 ⚠️

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after initial definition*
