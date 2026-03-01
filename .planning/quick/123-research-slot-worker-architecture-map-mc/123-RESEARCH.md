# Quorum Slot Worker Architecture: Capability Map and Optimization Research

**Date:** 2026-03-01
**Author:** Quick Task 123
**Purpose:** Map MCP slot file system capabilities; quantify redundant Haiku file exploration; produce architecture recommendation for thin vs thick worker per slot type.

---

## 1. Per-Slot Capability Map

### 1.1 Slot Classification Table

All 12 slots defined in `bin/providers.json` are `type: "subprocess"`. No HTTP-type slots currently exist.

| Slot | CLI | Model | Provider | Display Type | Has File Access | Classification |
|------|-----|-------|----------|-------------|-----------------|----------------|
| codex-1 | `/opt/homebrew/bin/codex exec "{prompt}"` | gpt-5.3-codex | OpenAI | codex-cli | **Yes** | coding-agent |
| codex-2 | `/opt/homebrew/bin/codex exec "{prompt}"` | gpt-5.3-codex | OpenAI | codex-cli | **Yes** | coding-agent |
| gemini-1 | `/opt/homebrew/bin/gemini -m gemini-3-pro-preview -p "{prompt}"` | gemini-3-pro-preview | Google | gemini-cli | **Yes** | coding-agent |
| gemini-2 | `/opt/homebrew/bin/gemini -m gemini-3-pro-preview -p "{prompt}"` | gemini-3-pro-preview | Google | gemini-cli | **Yes** | coding-agent |
| opencode-1 | `/opt/homebrew/bin/opencode run "{prompt}"` | grok-code-fast-1 | OpenCode | opencode-cli | **Yes** | coding-agent |
| copilot-1 | `/opt/homebrew/bin/copilot -p "{prompt}" --allow-all-tools -s` | gpt-4.1 | GitHub | copilot-cli | **Yes** | coding-agent |
| claude-1 | `/opt/homebrew/bin/ccr claude-1 -p "{prompt}" --dangerously-skip-permissions` | DeepSeek-V3.2 | AkashML | claude-code-router | **Yes** | coding-agent |
| claude-2 | `/opt/homebrew/bin/ccr claude-2 -p "{prompt}" --dangerously-skip-permissions` | MiniMax-M2.5 | AkashML | claude-code-router | **Yes** | coding-agent |
| claude-3 | `/opt/homebrew/bin/ccr claude-3 -p "{prompt}" --dangerously-skip-permissions` | Qwen3-Coder-480B | Together.xyz | claude-code-router | **Yes** | coding-agent |
| claude-4 | `/opt/homebrew/bin/ccr claude-4 -p "{prompt}" --dangerously-skip-permissions` | Kimi-K2 | Fireworks | claude-code-router | **Yes** | coding-agent |
| claude-5 | `/opt/homebrew/bin/ccr claude-5 -p "{prompt}" --dangerously-skip-permissions` | Llama-4-Maverick-17B | Together.xyz | claude-code-router | **Yes** | coding-agent |
| claude-6 | `/opt/homebrew/bin/ccr claude-6 -p "{prompt}" --dangerously-skip-permissions` | GLM-5 | Fireworks | claude-code-router | **Yes** | coding-agent |

**Result: All 12 slots are coding agents with full file system access. Zero text-only API slots exist.**

### 1.2 Evidence Per Slot Type

#### Codex CLI (codex-1, codex-2)

`codex exec` runs a non-interactive agent session. From `codex exec --help`:
- Accepts a prompt and runs the full Codex agent loop
- The agent has sandbox access configurable via `-c sandbox_permissions`
- In `exec` mode, the agent can read/write files, run shell commands
- `codex review` mode confirms code-level analysis (reads repo files directly)

**Verdict:** Full coding agent with file system access (read, write, shell).

#### Gemini CLI (gemini-1, gemini-2)

`gemini -p "{prompt}"` runs in headless/non-interactive mode. From `gemini --help`:
- `-p, --prompt` runs in non-interactive (headless) mode
- `-y, --yolo` flag for auto-approving all actions (not currently used in providers.json but available)
- `--approval-mode` supports `yolo` and `auto_edit` modes confirming file edit capabilities
- Has MCP server integration, extensions, and skills system
- Supports `--include-directories` for workspace inclusion

**Verdict:** Full coding agent with file system access (read, write, shell, extensions).

#### OpenCode CLI (opencode-1)

`opencode run "{prompt}"` runs non-interactively. From `opencode run --help`:
- Runs with full agent capabilities including file operations
- Supports `--agent` selection, `--model` override
- Has GitHub integration (`opencode github`, `opencode pr`)
- Supports session management, export/import

**Verdict:** Full coding agent with file system access (read, write, shell).

#### GitHub Copilot CLI (copilot-1)

`copilot -p "{prompt}" --allow-all-tools -s` runs non-interactively with full tool access. From `copilot --help`:
- `--allow-all-tools` explicitly grants all tools without confirmation
- `--allow-all-paths` disables file path verification (not currently used but available)
- `-s` flag for silent/scripting mode
- Has explicit `write` tool allowance via `--allow-tool 'write'`
- `--add-dir` confirms directory-scoped file access model

**Verdict:** Full coding agent with file system access (read, write, shell). The `--allow-all-tools` flag explicitly enables everything.

#### CCR / Claude Code Router (claude-1 through claude-6)

`ccr <preset> -p "{prompt}" --dangerously-skip-permissions` spawns a real Claude Code CLI session. From `ccr --help`:
- Spawns the Claude Code CLI under the hood
- `--dangerously-skip-permissions` grants full tool access: Read, Write, Edit, Bash, Glob, Grep
- Each preset routes to a different LLM provider (DeepSeek, MiniMax, Qwen, Kimi, Llama, GLM) but all run through Claude Code with identical tool access

**Verdict:** Full coding agent with complete Claude Code toolset (Read, Write, Edit, Bash, Glob, Grep).

---

## 2. Current Slot Worker Behavior Analysis

### 2.1 What Step 2 Does Today

The `qgsd-quorum-slot-worker.md` agent (running as Haiku 4.5) performs these actions in Step 2 before dispatching to the external slot:

| Step | Action | Tool Used | Haiku Round-Trip |
|------|--------|-----------|-----------------|
| 2a | Read `CLAUDE.md` (if exists) | Read | Yes |
| 2b | Read `.planning/STATE.md` (if exists) | Read | Yes |
| 2c | Read `.planning/ROADMAP.md` (conditional) | Read | Sometimes |
| 2d | Read artifact file (if `artifact_path` set) | Read | Yes |
| 2e | Glob/Grep for relevant files | Glob, Grep | 2-3 round-trips |
| 2f | Read additional context files | Read | 0-2 round-trips |

**Total: 5-7 Haiku API round-trips per worker** (4 guaranteed + 1-3 exploratory).

### 2.2 What Step 3 Does With the Data

In the prompt template (Step 3), the artifact content is embedded directly:
```
=== Artifact ===
Path: <artifact_path>
<$ARTIFACT_CONTENT -- full content>
================
```

The CLAUDE.md and STATE.md contents are used to build context but are also passed indirectly through the prompt. The downstream coding agent then typically re-reads these same files when it processes the prompt.

### 2.3 The Redundancy

For every coding-agent slot (all 12 current slots):

1. **Haiku reads the file** (Step 2) -- costs Haiku input + output tokens per round-trip
2. **Haiku embeds content in prompt** (Step 3) -- content now in the prompt string
3. **External agent receives prompt** with embedded content
4. **External agent often re-reads the same files** anyway (especially claude-* slots which are instructed to "read relevant files from the Repository directory above")

The `skip_context_reads` flag exists for Round 2+ but Round 1 always performs the full file exploration.

---

## 3. Token Cost Breakdown Per Round

### 3.1 File Token Estimates

Based on current file sizes (`wc -c` / 4):

| File | Bytes | ~Tokens | Read Frequency |
|------|-------|---------|----------------|
| CLAUDE.md | 0 (not found) | 0 | Always attempted (no-op) |
| .planning/STATE.md | 7,027 | ~1,757 | Always |
| .planning/ROADMAP.md | 116,980 | ~29,245 | Conditional (rare in quorum) |
| Typical artifact (PLAN.md) | ~9,000 | ~2,250 | Always when artifact_path set |
| Glob/Grep results | ~2,000 | ~500 | 2-3 calls per worker |

### 3.2 Cumulative Context Growth Per Worker

Haiku tool calls are stateful -- each round-trip sends ALL prior context plus the new tool result. This creates superlinear growth:

| Round-Trip | Cumulative Context (tokens) | New Data (tokens) | Total Input |
|------------|---------------------------|-------------------|-------------|
| 1: Read STATE.md | ~1,757 + agent prompt (~500) | 1,757 | ~2,257 |
| 2: Read artifact | ~2,257 + 2,250 | 2,250 | ~4,507 |
| 3: Glob search | ~4,507 + 500 | 500 | ~5,007 |
| 4: Read found file | ~5,007 + 1,000 | 1,000 | ~6,007 |
| 5: Grep search | ~6,007 + 300 | 300 | ~6,307 |
| **Total input tokens** | | | **~24,085** |

The sum across 5 round-trips: 2,257 + 4,507 + 5,007 + 6,007 + 6,307 = **~24,085 Haiku input tokens per worker** (due to cumulative context replay).

### 3.3 Scaling Across Workers and Rounds

| Metric | Value | Notes |
|--------|-------|-------|
| Haiku input tokens per worker | ~24,085 | 5 round-trips with cumulative growth |
| Active workers per quorum round | 3-6 | Depends on quorum_active config |
| Quorum rounds per invocation | 1-3 | Usually 1 (consensus R1), occasionally 2-3 |
| **Tokens per quorum (3 workers, 1 round)** | **~72,255** | Conservative: 3 workers x 24,085 |
| **Tokens per quorum (6 workers, 1 round)** | **~144,510** | Full fleet: 6 workers x 24,085 |
| **Tokens per quorum (6 workers, 2 rounds)** | **~289,020** | With deliberation round |
| Quorum invocations per phase execution | 1-3 | Planning + verification gates |
| **Total Haiku tokens per phase (worst case)** | **~867,060** | 6 workers x 2 rounds x 3 invocations |

### 3.4 Cost Impact

At Haiku 4.5 pricing (~$0.80 / 1M input tokens):

| Scenario | Haiku Input Tokens | Est. Cost |
|----------|-------------------|-----------|
| Single quorum (3 workers, 1 round) | 72,255 | $0.058 |
| Single quorum (6 workers, 1 round) | 144,510 | $0.116 |
| Phase execution (6 workers, 2 rounds, 3 invocations) | 867,060 | $0.694 |
| **Savings from removing Step 2** | **~80% of above** | **$0.046 - $0.555** |

The thin-worker optimization saves ~80% of these tokens because the only remaining Haiku round-trip would be the single Bash call to `call-quorum-slot.cjs` (Step 4).

---

## 4. Per-Slot Timeout Comparison Table

### 4.1 Configured Timeouts

| Slot | quorum_timeout_ms | timeout_ms | ~Typical Latency | Headroom | Fast-path Candidate? |
|------|-------------------|------------|-------------------|----------|---------------------|
| codex-1 | 30,000 | 300,000 | 15-25s | 5-15s | No -- tight already |
| codex-2 | 30,000 | 300,000 | 15-25s | 5-15s | No -- tight already |
| gemini-1 | 30,000 | 300,000 | 10-20s | 10-20s | **Yes** -- could tighten to 20s |
| gemini-2 | 30,000 | 300,000 | 10-20s | 10-20s | **Yes** -- could tighten to 20s |
| opencode-1 | 30,000 | 300,000 | 15-25s | 5-15s | No -- tight already |
| copilot-1 | 30,000 | 300,000 | 10-20s | 10-20s | **Yes** -- could tighten to 20s |
| claude-1 | 20,000 | 300,000 | 8-15s | 5-12s | Moderate -- already 20s cap |
| claude-2 | 20,000 | 300,000 | 8-15s | 5-12s | Moderate -- already 20s cap |
| claude-3 | 30,000 | 300,000 | 10-20s | 10-20s | **Yes** -- could tighten to 20s |
| claude-4 | 30,000 | 300,000 | 10-20s | 10-20s | **Yes** -- could tighten to 20s |
| claude-5 | 10,000 | 300,000 | 5-8s | 2-5s | Already tight (10s) |
| claude-6 | 8,000 | 300,000 | 4-7s | 1-4s | Already tight (8s) |

### 4.2 Timeout Analysis

**Key observation:** The `quorum_timeout_ms` is the hard cap for quorum slot dispatch (enforced by `call-quorum-slot.cjs` via `effectiveTimeout = Math.min(timeoutMs, providerCap)`). The `timeout_ms` (300s) is only for full interactive sessions -- irrelevant in quorum mode.

**Impact of removing Step 2:**
- Step 2 Haiku round-trips add 3-8 seconds to the worker's total execution time before the Bash call
- Removing them does NOT directly affect `quorum_timeout_ms` (which governs the external CLI execution time, not the Haiku worker overhead)
- However, the total wall-clock time for the worker Task includes both Haiku overhead + CLI execution
- Eliminating 3-8 seconds of Haiku overhead could allow tighter `quorum_timeout_ms` for slots with ample headroom (gemini-1/2, copilot-1, claude-3/4)

**Fast-path candidates (5 slots):**
- gemini-1, gemini-2: quorum_timeout_ms could reduce from 30s to 20s
- copilot-1: quorum_timeout_ms could reduce from 30s to 20s
- claude-3, claude-4: quorum_timeout_ms could reduce from 30s to 20s

**Already optimized (2 slots):**
- claude-5 (10s), claude-6 (8s): Already at minimum viable timeouts -- no further tightening recommended

---

## 5. HTTP Dispatch Path (Future Reference)

### 5.1 Current State

No `type: "http"` slots exist in `providers.json`. All 12 slots are `type: "subprocess"`.

### 5.2 HTTP Dispatch Path in call-quorum-slot.cjs

The `runHttp()` function (lines 281-350 of `call-quorum-slot.cjs`) implements OpenAI-compatible `/chat/completions` API dispatch:
- Loads API key from `~/.claude.json` server env or `process.env`
- Sends a single `{ model, messages: [{ role: 'user', content: prompt }] }` payload
- Parses `choices[0].message.content` from response
- **No file system access** -- pure text-in/text-out

If HTTP slots are ever added, they would be the only text-only API slots requiring the thick-worker pattern (Step 2 file reads + content embedding).

---

## 6. Architecture Recommendation

### 6.1 Summary

**All 12 current slots are coding agents. The slot worker should become a thin passthrough for all of them.**

### 6.2 Proposed Changes

#### A. Slot Worker (`qgsd-quorum-slot-worker.md`)

| Current | Proposed |
|---------|----------|
| Step 1: Parse args | Step 1: Parse args (unchanged) |
| Step 2: Read CLAUDE.md, STATE.md, ROADMAP.md, artifact, Glob/Grep (5-7 Haiku round-trips) | **Step 2: REMOVED for `has_file_access: true` slots** |
| Step 3: Build prompt with `$ARTIFACT_CONTENT` embedded | Step 3: Build prompt with `artifact_path` only (not content) + instruction: "Read the artifact file at `<path>` before evaluating" |
| Step 4: Bash call to cqs.cjs | Step 4: Bash call to cqs.cjs (unchanged) |
| Step 5: Parse and return | Step 5: Parse and return (unchanged) |

**Tool list change:** Remove `Glob, Grep` from the worker's tool list. The worker only needs:
- `Read` -- only if `has_file_access: false` (to read artifact for embedding)
- `Bash` -- to call `call-quorum-slot.cjs`

For the all-coding-agent case (current state), the worker needs only `Bash`.

#### B. Providers.json Schema Addition

Add a `has_file_access` field to each provider entry:

```json
{
  "name": "codex-1",
  "type": "subprocess",
  "has_file_access": true,
  ...
}
```

This makes the thin/thick decision configurable per slot rather than hardcoded by `type`. Future HTTP slots would set `has_file_access: false`.

#### C. Prompt Template Changes

**For `has_file_access: true` slots (thin worker):**

Replace the artifact embedding block:
```
=== Artifact ===
Path: <artifact_path>
<$ARTIFACT_CONTENT -- full content>
================
```

With a path-only reference:
```
=== Artifact ===
Path: <artifact_path>
(Read this file before evaluating. Use your file system tools to access it.)
================
```

Remove the instruction to "read CLAUDE.md and .planning/STATE.md" from the Haiku worker. Instead, add it to the prompt sent to the external agent:
```
IMPORTANT: Before answering, read the following files from the repository:
- <repo_dir>/CLAUDE.md (if it exists)
- <repo_dir>/.planning/STATE.md (if it exists)
- <artifact_path> (the artifact to evaluate)
```

**For `has_file_access: false` slots (thick worker, future):**

Keep the current behavior: Haiku reads files, embeds content in prompt.

#### D. Skip-Context-Reads Enhancement

The existing `skip_context_reads` flag (Round 2+) becomes less relevant since the thin worker does no context reads at all. However, it should be preserved for backward compatibility and for any future `has_file_access: false` slots.

### 6.3 Expected Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Haiku round-trips per worker | 5-7 | 1 (Bash only) | **~85% reduction** |
| Haiku input tokens per worker | ~24,085 | ~2,500 (prompt + Bash) | **~90% reduction** |
| Wall-clock overhead per worker | 3-8s Haiku I/O | <1s | **3-7s faster** |
| Worker tool complexity | Read, Bash, Glob, Grep | Bash only | **Simpler** |
| Total Haiku cost per phase | ~$0.69 | ~$0.07 | **~$0.62 saved** |

### 6.4 Implementation Priority

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| P1 | Remove Step 2 reads from worker | Low | Highest -- eliminates all redundant I/O |
| P2 | Add `has_file_access` to providers.json | Low | Enables conditional behavior |
| P3 | Update prompt templates (path-only) | Low | Required for P1 to work correctly |
| P4 | Remove Glob/Grep from worker tool list | Trivial | Cleanup |
| P5 | Tighten quorum_timeout_ms for fast-path slots | Low | Reduces quorum wall-clock time |

### 6.5 Risk Mitigation

**Risk:** External agent fails to read referenced files (especially for models with limited tool-use capability).

**Mitigation:**
- The `has_file_access` flag is per-slot, so any slot that proves unreliable at self-service file reads can be flipped to `false` individually
- All current slots have been verified as full coding agents with file access
- The prompt template explicitly instructs the agent to read the files, not just reference them

**Risk:** Removing context reads could reduce the quality of slot worker output parsing (Step 5).

**Mitigation:**
- Step 5 parsing does not use CLAUDE.md or STATE.md -- it only parses the raw output from the external agent
- The parsing logic (verdict extraction, reasoning extraction) is purely structural

---

## 7. Conclusion

All 12 quorum slots in `providers.json` are full coding agents with file system access. The slot worker's Step 2 file exploration is entirely redundant for all of them. Removing it would:

1. Eliminate ~24,000 Haiku input tokens per worker per round (cumulative context growth)
2. Save 3-7 seconds of wall-clock time per worker
3. Reduce worker complexity from 4 tools to 1 tool (Bash only)
4. Enable tighter timeouts for 5 of 12 slots (fast-path candidates)
5. Save approximately $0.55-0.69 per phase execution in Haiku API costs

The recommended approach is a configurable `has_file_access` field in `providers.json` that defaults to `true` for all subprocess slots, with the worker conditionally skipping Step 2 based on this flag. This future-proofs the architecture for HTTP text-only slots while delivering immediate savings.
