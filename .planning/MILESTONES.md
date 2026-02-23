# Milestones

## v0.1 — Quorum Hook Enforcement

**Completed:** 2026-02-21
**Phases:** 1–5 (Phase 5 = gap closure)
**Last phase number:** 5

### What Shipped

- Stop hook hard gate — Claude cannot deliver a GSD planning response without quorum evidence in transcript
- UserPromptSubmit injection — quorum instructions fire at command time, not session start
- Config system — two-layer merge (global ~/.claude/qgsd.json + project .claude/qgsd.json), MCP auto-detection
- Decision scope narrowing — GUARD 5 restricts quorum to actual project decision turns (hasArtifactCommit + hasDecisionMarker)
- npm installer — `npx qgsd@latest` writes hooks to `~/.claude/settings.json`, idempotent, warns on missing MCP servers
- Phase 5 gap closure — GUARD 5 marker path propagated to buildQuorumInstructions() and templates/qgsd.json

### Requirements Satisfied

39/39 v1 requirements (STOP-01–09, UPS-01–05, META-01–03, CONF-01–05, MCP-01–06, INST-01–07, SYNC-01–04)
Phase 4 scope requirements: SCOPE-01–07 (7/7)

### Key Decisions Carried Forward

- Hook installation writes to ~/.claude/settings.json directly (never plugin hooks.json — bug #10225)
- Fail-open: unavailable models pass through, not block
- Global install only; no per-project install in v0.x
- GUARD 5: decision turn = hasArtifactCommit OR hasDecisionMarker (both must be false to skip quorum)

---

*Archive committed: 2026-02-21*

## v0.2 Gap Closure — Activity Resume Routing (Shipped: 2026-02-21)

**Phases completed:** 17 phases, 40 plans, 13 tasks

**Key accomplishments:**
- (none recorded)

---


## v0.6 Agent Slots & Quorum Composition (Shipped: 2026-02-23)

**Phases completed:** Phase 39 (+ Phases 37–38 as v0.5 gap closure), 5 plans
**Git range:** 1e84b15..dae3af6 (23 commits, 43 files changed, +3243/-231 lines)

**Delivered:** Renamed all 10 quorum agents to slot-based `<family>-<N>` names everywhere in QGSD, shipped a non-destructive idempotent migration script, and eliminated all old model-based names from every source file.

**Key accomplishments:**
- Shipped `bin/migrate-to-slots.cjs` — idempotent migration script with `--dry-run`; renames 10 `~/.claude.json` mcpServers keys and patches `qgsd.json` required_models tool_prefix values (SLOT-02)
- Updated all runtime hooks (`qgsd-prompt.js`, `config-loader.js`, `qgsd-stop.js`) and `templates/qgsd.json` to slot-based tool prefixes — zero old names in hook layer (SLOT-03)
- Updated all 8 command `.md` files and the quorum orchestrator agent to slot names in allowed-tools, validation lists, KNOWN_AGENTS arrays — zero old names in command layer (SLOT-01, SLOT-03, SLOT-04)
- Fixed `mcp-setup.md` distribution defects: replaced 9 hardcoded `secrets.cjs` absolute paths with dynamic resolution, added missing `syncToClaudeJson` to provider swap flow (Phase 37)
- Established `requirements:` frontmatter as the canonical traceability link in SUMMARY.md files (Phase 38)

**Known gaps (deferred to v0.7):** COMP-01..04, MULTI-01..03, WIZ-08..10, SCBD-01..03

---


## v0.7 Composition Config & Multi-Slot (Shipped: 2026-02-23)

**Phases completed:** 4 phases (v0.7-01..v0.7-04), 10 plans
**Git range:** 03fffb3..36ad405 (61 files changed, +5,555/-219 lines)

**Delivered:** Shipped `quorum_active` composition config so which slots participate in quorum is a config decision not a code change, extended to N-slot-per-family multi-slot support, added a Composition Screen to the mcp-setup wizard, and fixed scoreboard slot tracking on all quorum paths.

**Key accomplishments:**
- `quorum_active` config field added — users define slot composition via `qgsd.json`; auto-populated at install/migrate time via `buildActiveSlots()` / `populateActiveSlots()` (COMP-01..04)
- Scoreboard slot tracking — `update-scoreboard.cjs` extended with `slots{}` schema and `--slot`/`--model-id` CLI args; composite key `<slot>:<model-id>` for per-slot-per-model stats (SCBD-01..03)
- Dynamic quorum wiring — quorum.md and orchestrator provider pre-flight read `quorum_active`; no more hardcoded agent lists (COMP-02)
- Multi-slot support — multiple claude/copilot/opencode/codex-cli/gemini-cli slots; mcp-setup `Add new agent` expanded with native CLI second-slot options 6–9 (MULTI-01..03)
- Wizard Composition Screen — `/qgsd:mcp-setup` re-run gains "Edit Quorum Composition" with on/off slot toggle, apply-to-disk, and add-from-composition routing (WIZ-08..10)
- Orchestrator scoreboard slot fix — quorum.md + orchestrator Mode A use `--slot`/`--model-id`; Escalate sections expanded to inline dual-variant blocks; closes SCBD-01..03 audit gap (Phase v0.7-04)

---

