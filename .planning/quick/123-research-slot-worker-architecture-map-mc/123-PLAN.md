---
phase: quick-123
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/123-research-slot-worker-architecture-map-mc/123-RESEARCH.md
autonomous: true
requirements: [RESEARCH-01]

must_haves:
  truths:
    - "Each MCP slot is classified as coding-agent (file system access) or text-only API"
    - "The slot worker's redundant Haiku file exploration is quantified per-round"
    - "An architecture recommendation exists for thin vs thick worker per slot type"
  artifacts:
    - path: ".planning/quick/123-research-slot-worker-architecture-map-mc/123-RESEARCH.md"
      provides: "Complete capability map and architecture recommendation"
      min_lines: 80
  key_links: []
---

<objective>
Research and document the capability map of all quorum MCP slots — specifically which slots
have file system access (coding agents that can read/write files) versus text-only API slots
that cannot. Use this map to produce an architecture recommendation for slimming down the
qgsd-quorum-slot-worker agent by removing redundant Haiku file exploration for coding-agent
slots.

Purpose: The todo "Slim down quorum slot worker" identifies that Haiku burns ~5-7 tool-call
round-trips per worker reading files that the downstream coding agents will read anyway. This
research determines exactly which slots benefit from pre-reading vs which are pure passthrough.

Output: `.planning/quick/123-research-slot-worker-architecture-map-mc/123-RESEARCH.md`
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@bin/providers.json
@bin/call-quorum-slot.cjs
@agents/qgsd-quorum-slot-worker.md
@agents/qgsd-quorum-orchestrator.md
@.planning/todos/pending/2026-03-01-slim-down-quorum-slot-worker-remove-redundant-haiku-file-exploration.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Investigate slot dispatch paths and classify each slot's file system capability</name>
  <files>.planning/quick/123-research-slot-worker-architecture-map-mc/123-RESEARCH.md</files>
  <action>
Investigate every quorum slot defined in `bin/providers.json` and classify each by its
file system access capability. The investigation must cover:

**A. Subprocess CLI slots (type: "subprocess"):**

For each CLI slot, determine whether the downstream agent has full file system access
(Read, Write, Glob, Grep, Bash) or is text-only:

1. **codex-1, codex-2** — Codex CLI (`/opt/homebrew/bin/codex exec "{prompt}"`).
   Check: Does Codex CLI have file read/write tools when run non-interactively with `exec`?
   Run `codex --help` and `codex exec --help` to confirm tool access.

2. **gemini-1, gemini-2** — Gemini CLI (`/opt/homebrew/bin/gemini -m gemini-3-pro-preview -p "{prompt}"`).
   Check: Does Gemini CLI have file system tools when invoked with `-p` (prompt mode)?
   Run `gemini --help` to confirm.

3. **opencode-1** — OpenCode CLI (`/opt/homebrew/bin/opencode run "{prompt}"`).
   Check: Does OpenCode have file system access in `run` mode?
   Run `opencode --help` and `opencode run --help` to confirm.

4. **copilot-1** — GitHub Copilot CLI (`/opt/homebrew/bin/copilot -p "{prompt}" --allow-all-tools -s`).
   Check: The `--allow-all-tools` flag suggests tool access. Confirm what tools are available.
   Run `copilot --help` to confirm.

5. **claude-1 through claude-6** — CCR (Claude Code Router) presets (`/opt/homebrew/bin/ccr <preset> -p "{prompt}" --dangerously-skip-permissions`).
   Check: CCR spawns a real Claude Code CLI session with `--dangerously-skip-permissions`.
   This flag grants full tool access (Read, Write, Edit, Bash, Glob, Grep). Confirm by
   checking `ccr --help` and noting the `--dangerously-skip-permissions` flag in args_template.
   These are full coding agents backed by various LLM providers (DeepSeek, MiniMax, Qwen,
   Kimi, Llama, GLM) but all running through the Claude Code CLI with full tool access.

**B. HTTP slots (type: "http"):**

Check if any providers in `providers.json` use `type: "http"`. HTTP slots are OpenAI-compatible
`/chat/completions` API calls — pure text-only, no file system access. Currently none exist
in providers.json but document the dispatch path from `runHttp()` in call-quorum-slot.cjs.

**C. Current slot worker behavior:**

Document what the slot worker (Haiku 4.5) currently does in Step 2 before dispatching:
- Reads CLAUDE.md (full file)
- Reads .planning/STATE.md (full file)
- Reads .planning/ROADMAP.md (conditionally)
- Reads artifact_path file (full content)
- Runs 2-3 Glob/Grep searches for additional context
- Each of these is a Haiku API round-trip with growing context

Then embeds the artifact content directly into the prompt (`$ARTIFACT_CONTENT`) rather than
just passing the path.

**D. Quantify the waste:**

For N parallel workers in a quorum round:
- Count Haiku tool-call round-trips per worker (currently ~5-7)
- Multiply by N workers (typically 3-6 active slots)
- Note that each round-trip carries the full accumulated context (growing with each read)
- Compare: coding-agent slots will re-read the same files themselves

**E. Architecture recommendation:**

Based on the capability map, produce a concrete recommendation:

1. For coding-agent slots (all subprocess CLIs with file access): Remove Step 2 file reads.
   Pass only `artifact_path` (not content) in the prompt. Let the downstream agent read files.
   Remove Glob/Grep from worker tool list. Worker becomes: parse args -> build prompt -> Bash call -> parse output.

2. For text-only API slots (HTTP type, if any): Keep Step 2 reads or embed content in prompt,
   since these slots cannot read files themselves.

3. Propose a `has_file_access: true|false` field in providers.json to make this configurable
   per-slot, rather than hardcoding by type.

Write all findings to 123-RESEARCH.md with clear tables and the per-slot capability map.
  </action>
  <verify>
    The file `.planning/quick/123-research-slot-worker-architecture-map-mc/123-RESEARCH.md` exists
    and contains:
    - A table mapping every slot from providers.json to its file system capability
    - Classification of each slot as "coding-agent" or "text-only"
    - Quantification of current Haiku round-trips per quorum round
    - Architecture recommendation with specific changes to slot-worker and providers.json
    - At least 80 lines of substantive content
  </verify>
  <done>
    Complete capability map exists for all 12 slots in providers.json. Each slot is classified.
    Architecture recommendation identifies which slots can skip Step 2 file reads (coding agents)
    and which need them (text-only APIs). Quantification shows the Haiku token savings.
  </done>
</task>

</tasks>

<verification>
- 123-RESEARCH.md has a per-slot capability table covering all 12 provider entries
- Each slot has a clear "has file access: yes/no" determination with evidence
- The document includes a concrete architecture recommendation (not just observations)
- Token waste is quantified with specific numbers (round-trips x workers x rounds)
</verification>

<success_criteria>
Research document exists with actionable findings that directly enable the "Slim down quorum
slot worker" todo. A future implementation task can use this document to make targeted changes
to qgsd-quorum-slot-worker.md and providers.json without additional investigation.
</success_criteria>

<output>
After completion, create `.planning/quick/123-research-slot-worker-architecture-map-mc/123-SUMMARY.md`
</output>
