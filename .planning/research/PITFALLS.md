# Domain Pitfalls: Repowise Intelligence Integration (v0.42)

**Domain:** Adding XML-style context packing, Tree-Sitter AST skeleton views, hotspot detection (Churn + Complexity), and co-change prediction to an existing Node.js CLI tool (nForma)
**Researched:** 2026-04-11
**Confidence:** HIGH (Tree-Sitter binding issues verified from GitHub issues/releases; Git performance from nForma's own `spawnSync` patterns; context packing from LLM token engineering community knowledge; hotspot/co-change from static analysis literature and nForma's existing circuit-breaker patterns)

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Tree-Sitter NAPI Binding / Grammar ABI Mismatch After Install

**What goes wrong:**
After `npm install tree-sitter tree-sitter-javascript tree-sitter-typescript`, calling `parser.setLanguage(JavaScript)` throws `TypeError: Invalid language object` at runtime. The grammar `.node` binaries were compiled against a different Tree-Sitter ABI version than the installed `tree-sitter` core binding.

**Why it happens:**
Tree-Sitter v0.21 migrated from NAN (Native Abstractions for Node.js) to N-API (Node-API). This was a **breaking change** — all grammar packages must regenerate their `binding.cc` via `tree-sitter generate` with tree-sitter CLI ≥0.22.0. If you install `tree-sitter@0.25.x` (current, NAPI-based) but a grammar package still ships a NAN-based `binding.gyp`, the native module either fails to build or builds successfully but produces an invalid language object at `setLanguage()` time.

Additionally, Tree-Sitter has an ABI version (`TREE_SITTER_LANGUAGE_VERSION`). Grammars compiled for ABI 14 won't load under a core that expects ABI 15. npm does not enforce this constraint — you can install incompatible versions side-by-side with no warning.

**Consequences:**
- `npm install` succeeds, tests pass on developer's machine (matching Node version + platform), but CI or another developer gets SIGSEGV or `Invalid language object`.
- The error message gives zero indication that the problem is an ABI mismatch — it looks like the language module is simply broken.
- Fix requires regenerating all grammar bindings, which in turn requires the `tree-sitter` CLI binary (a Rust toolchain dependency).

**Prevention:**
- Pin exact versions for `tree-sitter` AND every grammar package in `package.json`. Never use `^` or `~` ranges.
- Add a startup validation step: on first use, try `parser.setLanguage(grammar)` in a try/catch with a clear error message: `"tree-sitter-<lang> ABI <found> does not match tree-sitter core ABI <expected>. Regenerate grammar with tree-sitter CLI >= 0.22.0"`.
- Ship pre-compiled `.node` binaries for the supported platforms (darwin-arm64, linux-x64, win32-x64) using `prebuildify` (the same approach node-tree-sitter uses since v0.21). Do NOT require users to have a C++ compiler.
- Include a CI gate: `node -e "const P=require('tree-sitter');const J=require('tree-sitter-javascript');const p=new P();p.setLanguage(J);console.log('OK')"` — this catches ABI mismatches before merge.
- Document the grammar regeneration process in the codebase: `npx tree-sitter generate` after any grammar update.

**Detection:**
- `npm ci` succeeds but first `parser.setLanguage()` call throws.
- CI fails on one platform but passes on another (prebuilt binary not available for that platform).
- SIGSEGV in Node.js process when parsing any file.

**Phase to address:**
Tree-Sitter integration phase — add ABI validation as the FIRST thing the skeleton view module does, before any parsing.

---

### Pitfall 2: Git Log Parsing Overwhelms Memory on Large Repos (10K+ Commits)

**What goes wrong:**
Running `git log --numstat --format=...` on a repository with 50K+ commits produces potentially megabytes of output. Parsing this with `String.split('\n')` and accumulating per-file churn maps in a single pass creates a multi-hundred-MB in-memory object. The CLI invocation becomes the bottleneck: `spawnSync('git', ['log', '--numstat', ...])` blocks the Node.js event loop for 10-30 seconds on large monorepos.

**Why it happens:**
nForma's existing git operations are all O(1) or O(small): `git rev-parse HEAD`, `git diff HEAD~3 -- <paths>`, `git rev-list --count HEAD --since=10m`. These complete in <100ms. Churn analysis requires `git log --numstat --format="%H"` across the ENTIRE history, which is O(N) in commit count and O(M) in file count.

The existing `spawnSync` pattern in `nf-circuit-breaker.js` (which reads 6 commits) and `escalation-classifier.cjs` (which reads a bounded diff) works because the output is bounded. Unbounded `git log` on large repos is a fundamentally different operation — it's streaming megabytes of data.

**Consequences:**
- nForma's hook pipeline has a 10s timeout (configured in `install.js`). If churn analysis is called from a hook, it WILL time out on large repos.
- Memory usage spikes 200-500MB, causing Node.js heap pressure and potential OOM on constrained environments.
- The first invocation is slow (full git log); subsequent invocations are also slow unless results are cached.

**Prevention:**
- **Never run full git log from a hook.** Hotspot detection is a bin/ command, not a hook. It runs on demand, not on every prompt.
- Use `git log --numstat --format="%H" --since="<date>"` with a bounded window (e.g., last 90 days). For most risk analysis, recent churn is far more relevant than total history.
- Stream the output: use `child_process.spawn` (async) instead of `spawnSync`, and process line-by-line. Don't buffer the entire output into a single string.
- Implement incremental caching: write churn results to `.nforma/cache/churn-<git-hash>.json`. On subsequent runs, only process commits after the cached hash. This is the same caching pattern nForma uses in `quorum-cache.cjs` (SHA-256 keyed cache with TTL).
- Add a `--max-commits N` flag (default 5000) that caps the git log. For repos with >5K commits, this is the responsible default — the top 5K recent commits capture most churn signal.
- For co-change prediction, use `git log --name-only --format="%H"` (no numstat — just file names per commit). This is ~5x smaller output than `--numstat` and sufficient for co-change analysis.

**Detection:**
- `time nforma hotspot` takes >10s on first run.
- Node.js process RSS exceeds 500MB during analysis.
- Hook timeout errors when hotspot analysis is accidentally invoked from a hook context.

**Phase to address:**
Hotspot detection implementation phase — architecture must specify: bin/ command (not hook), bounded window, streaming parser, cache layer.

---

### Pitfall 3: XML Context Packing That Increases Token Count Instead of Reducing It

**What goes wrong:**
The XML-style context packing is supposed to reduce token consumption by replacing verbose natural language descriptions with structured XML tags. But poorly designed XML schemas ADD tokens: opening/closing tags, attribute syntax, and namespace prefixes all consume tokens. A skeleton view wrapped in `<file name="foo.js"><function name="bar" start="10" end="50">...</function></file>` can use MORE tokens than the concise `// foo.js:10-50 function bar()` representation.

**Why it happens:**
LLM tokenizers (Claude's, GPT's) tokenize XML tags predictably — `<file>` is typically 1-2 tokens, but `<file name="src/hooks/nf-prompt.js" language="javascript">` is 8-12 tokens. Multiply by hundreds of symbols and the XML overhead dominates. The "structured format" benefit (easier for LLMs to parse) is real, but only if the schema is token-efficient.

The Repowise approach works because it packs ONLY the structural skeleton (signatures, not bodies) and uses minimal attribute names. If nForma naively wraps existing context in XML without trimming content, the result is strictly worse than the original.

Additionally, nForma's existing context injection points (`nf-prompt.js`, `nf-session-start.js`) have a tight character budget (800-char cap on context-stack injection noted at line 862 of nf-prompt.js). XML packing that exceeds this budget silently truncates or crowds out other injections.

**Consequences:**
- Context packing increases per-turn token cost by 20-40% instead of decreasing it.
- Other context injections (quorum instructions, state reminders) get crowded out.
- Claude's context window fills faster, triggering earlier compaction and losing planning state.
- The packing is "working" structurally but the ROI is negative.

**Prevention:**
- Measure before and after: implement a `--dry-run` mode that reports token count before/after packing for a given file set. Token count can be approximated by `text.length / 4` (4 chars per token is a rough heuristic for mixed code/English).
- Use the absolute minimum XML tag names: `<f>` not `<function>`, `<c>` not `<class>`, `<fn>` as a compromise. Every character in a tag name is a token.
- Pack ONLY skeleton information (signatures, function names, line ranges) — never pack function bodies or comments. The whole point is to replace body content with structural metadata.
- Use self-closing tags where possible: `<fn n="bar" s="10" e="50"/>` instead of `<fn n="bar" s="10" e="50">...</fn>`.
- Validate the packing ratio: packed output should be ≤60% of the original token count. If it's >80%, the packing isn't worth doing — just truncate instead.
- Do NOT inject packed context from hooks (character budget is too tight). Pack context only in bin/ commands and workflow steps that have ample context budget.

**Detection:**
- Token usage reports (from nForma's existing `token-dashboard.cjs` or `/nf:tokens`) show increased cost after packing is enabled.
- Packed XML representation is longer than the original content it replaces.
- Context window compaction happens earlier in sessions using packed context.

**Phase to address:**
Context packing implementation phase — define token-efficient schema FIRST, validate with measurement, then build packing logic.

---

### Pitfall 4: Hotspot False Positives from Churn Without Normalization

**What goes wrong:**
Hotspot detection combines churn (commit frequency) and complexity (cyclomatic or LOC) to identify risk files. Without normalization, files that are large AND frequently changed always top the hotspot list — but many of these are "known safe" files like configuration files, generated code, or test fixtures that have high churn and high LOC but zero bug risk. The analysis becomes a noise generator that users learn to ignore.

**Why it happens:**
Raw churn × complexity produces an absolute score. A 5000-line generated file that gets regenerated every release has extremely high churn AND high complexity — it dominates every hotspot report. Similarly, test files that are updated with every feature have high churn but low bug risk.

The issue is specifically about ADDING this to an existing system where users already have noise fatigue from circuit-breaker false positives (nForma's oscillation detector already has a precision challenge). Adding another noisy signal erodes trust in ALL nForma signals.

**Consequences:**
- Hotspot reports are ignored after first few uses because 80% of "hotspots" are false positives.
- Users add per-file overrides that grow without bound, creating maintenance debt.
- The analysis output competes for context budget with more useful signals (quorum instructions, formal verification results).

**Prevention:**
- **Exclude by default:** generated files (`*.generated.*`, `*.min.*`, `dist/`, `build/`), test files (`*.test.*`, `*.spec.*`, `__tests__/`), and lockfiles. These are the top 3 false-positive categories.
- **Normalize churn:** divide churn count by file age (commits/month) rather than using absolute commit count. A 5-year-old file with 100 commits (20/year) is less hot than a 6-month-old file with 50 commits (100/year).
- **Normalize complexity:** use complexity-per-function (average cyclomatic per function) rather than total complexity. A 500-line file with 50 simple functions (avg CC=1.2) is less risky than a 50-line file with one CC=15 function.
- **Weight recent churn higher:** commits in the last 90 days should weight 3x vs. older commits. Stale churn is a much weaker signal.
- **Add a per-project `.nforma/hotspot-ignore` file** (like `.gitignore` syntax) so users can suppress known false positives. This is cleaner than per-file overrides and self-documents exceptions.
- **Report confidence tiers:** Tier 1 (high churn + high complexity + recent), Tier 2 (high churn + moderate complexity OR recent churn + high complexity), Tier 3 (moderate both). Only Tier 1 warrants attention.

**Detection:**
- First hotspot report on nForma's own codebase shows `dist/` files or test files as top hotspots.
- Users immediately ask "how do I exclude X?" and there's no mechanism.
- Hotspot analysis takes >5 seconds on nForma's own mid-size repo.

**Phase to address:**
Hotspot detection implementation phase — normalization and exclusion logic are not "nice to have" — they are the core algorithm, not a post-processing step.

---

### Pitfall 5: Co-Change Prediction Produces Spurious Coupling for "Boilerplate" Commits

**What goes wrong:**
Co-change prediction mines git history for files that frequently change together (implicit coupling). But many co-changes are spurious: they happen because a developer ran a refactoring tool that touched 30 files, or because a code generator updates all its outputs, or because a linter auto-fixed formatting across the entire codebase. These "boilerplate commits" create massive spurious coupling that drowns out the real signal.

**Why it happens:**
`git log --name-only` treats all commits equally. A mass-rename commit that touches 200 files creates 200×199/2 = 19,900 co-change pairs — all spurious. A dependency bump that updates 15 lockfiles creates 105 spurious pairs. These dominate the co-change matrix because they inflate pair counts for files that have no real semantic relationship.

This is the same class of problem as nForma's oscillation detector: real signal buried in noise from mechanical changes. The circuit-breaker already filters git-log noise by ignoring read-only operations. Co-change prediction needs an analogous filter.

**Consequences:**
- Co-change suggestions like "when you change `package.json`, also review `yarn.lock`" are technically correct but useless noise.
- Real coupling signals ("`nf-prompt.js` and `nf-stop.js` always change together") get buried.
- Users lose trust in the prediction system.

**Prevention:**
- **Filter commits before analysis:** exclude commits whose message matches common boilerplate patterns (`/^(chore|style|lint|format|bump|dep|merge|revert|auto)/i`). These are the top sources of spurious co-change.
- **Weight commits by file count:** a commit that touches 2 files is a much stronger co-change signal than a commit that touches 50 files. Use inverse file-count weighting: `weight = 1 / (1 + log(touched_file_count))`. A 2-file commit gets weight 0.77; a 50-file commit gets weight 0.15.
- **Set a minimum co-occurrence threshold:** require files to co-occur in ≥3 commits before reporting as coupled. Single co-occurrence is almost always noise.
- **Report coupling strength, not just coupling existence:** use a confidence metric (e.g., Jaccard similarity or lift) and only surface pairs above a threshold (≥0.3 Jaccard or ≥2.0 lift).
- **Separate "structural coupling" (always changes together) from "temporal coupling" (changed in same time window):** structural coupling is far more actionable.

**Detection:**
- Co-change report lists `package.json` ↔ `package-lock.json` as the #1 coupled pair.
- Top 10 co-change pairs are all trivial (lockfiles, generated files, linter mass-edits).
- No actionable coupling suggestions appear (all signal drowned by noise).

**Phase to address:**
Co-change prediction implementation phase — commit filtering and weighting logic are core algorithm, not post-processing.

---

## Moderate Pitfalls

### Pitfall 6: Tree-Sitter Grammar Package Not Available for Target Language

**What goes wrong:**
A user runs skeleton view on a `.tsx` file but `tree-sitter-tsx` isn't installed. The command either crashes with `Cannot find module 'tree-sitter-tsx'` or silently produces no output.

**Prevention:**
- Implement graceful degradation: if the grammar module isn't available, fall back to a regex-based skeleton extraction (function signatures via pattern matching). This is less accurate but always works.
- Detect language from file extension and check for grammar availability before parsing. Emit a clear message: `"tree-sitter-tsx not installed. Falling back to regex skeleton. Install with: npm install tree-sitter-tsx"`.
- Bundle the top 5 grammars nForma needs (JavaScript, TypeScript, Python, Bash, JSON) as direct dependencies. All others are optional.

---

### Pitfall 7: Skeleton View Outputs Full File Content on Small Files

**What goes wrong:**
For a 20-line file, the skeleton view produces a representation that's LONGER than the original file (because of XML tags, line ranges, metadata). This defeats the purpose of skeleton views and wastes context budget.

**Prevention:**
- Set a threshold: if the file is ≤50 lines OR ≤1500 chars, skip skeleton view and include the original content verbatim. The overhead of skeleton metadata exceeds the savings for small files.
- Always include a "skeleton ratio" check: if packed size > 0.8 × original size, include original instead.

---

### Pitfall 8: Context Packing Re-Runs on Every Hook Invocation

**What goes wrong:**
Context packing (XML formatting) is invoked from a hook or a per-turn context injection point. It runs on every prompt, re-packing the same files that haven't changed. This adds 50-100ms latency to every UserPromptSubmit hook.

**Prevention:**
- Context packing must be a bin/ command or a workflow step, NOT a hook. It runs once at task start, not per-turn.
- Cache the packed output: `.nforma/cache/packed-<git-hash>.json`. Reuse until the git HEAD changes.
- The packed context should be injected via a one-time mechanism (like the session-start state injection pattern from nf-session-start.js), not per-prompt.

---

### Pitfall 9: SpawnSync Blocks Event Loop During Churn Analysis

**What goes wrong:**
Using `spawnSync('git', ['log', '--numstat', ...])` blocks the Node.js event loop for the entire duration of the git command. On a repo with 50K commits, this is 5-30 seconds where nForma is completely unresponsive. If this is called from a hook with a 10s timeout, it times out.

**Prevention:**
- Use `child_process.spawn` (async) with line-by-line stream processing for any git command that may produce >10KB of output.
- For bin/ commands (where blocking is acceptable), still use spawnSync but add a progress indicator (stderr dots) for runs >2s.
- Never use `execSync` for git log (it buffers all output in memory). Use spawnSync with `{ maxBuffer: 10 * 1024 * 1024 }` at most, or better: streaming.

---

### Pitfall 10: Complexity Metric That Doesn't Match nForma's Existing Solve Layer Definitions

**What goes wrong:**
nForma's solve system already has 18 classification layers (LAYER_KEYS in `layer-constants.cjs`) with per-layer risk scoring. Adding a separate cyclomatic complexity metric creates two competing "complexity" definitions. The hotspot report says a file is "high complexity" for one reason, the solve layer says it's low complexity for another.

**Prevention:**
- Align the complexity metric with nForma's existing layer classification. Use the same dimension names.
- Map hotspot output INTO the existing solve layer framework rather than creating a parallel one. Hotspot data should enrich existing layers, not define new ones.
- The integration point should be: hotspot analysis → `.nforma/cache/hotspot-scores.json` → solve layers read this as supplementary risk context.

---

## Minor Pitfalls

### Pitfall 11: XML Tag Names That Clash with HTML in Claude's Context

**What goes wrong:**
XML tags like `<file>` or `<class>` can confuse Claude when the same context contains HTML content. Claude may interpret the XML skeleton as HTML markup rather than structured metadata.

**Prevention:**
- Use namespace-prefixed tags: `<rw:file>`, `<rw:fn>` (rw = Repowise). This disambiguates from HTML.
- Alternatively, use a non-XML delimiter format for skeleton views: `### file: foo.js\n  fn bar():10-50\n  fn baz():55-80`. Markdown headers are already native to Claude's context and don't clash.

---

### Pitfall 12: Git Log Date Parsing Across Timezones

**What goes wrong:**
`git log --format="%ai"` outputs author dates in the committer's local timezone. A `--since=90 days ago` filter works in UTC, but the date strings in the log are in local time. Comparing these produces off-by-one-day errors.

**Prevention:**
- Always use `--date=iso-strict` or `--date=unix` for machine-parseable output. Never parse human-readable dates.
- Use `--since` with absolute dates computed in UTC from `Date.now()`.

---

### Pitfall 13: Tree-Sitter Parser Crashes on Invalid Syntax

**What goes wrong:**
Tree-sitter is error-recovery-capable (it produces partial ASTs for invalid syntax), but some grammar edge cases produce parse trees where `rootNode.toString()` is unexpectedly empty or where iterating children hits an ERROR node that breaks the skeleton extraction logic.

**Prevention:**
- Check for `tree.rootNode.hasError` before extracting skeletons. If the tree has errors, fall back to regex-based extraction.
- Skip ERROR nodes during traversal: `for (const child of node.children) { if (child.type === 'ERROR') continue; ... }`.
- Always wrap Tree-Sitter operations in try/catch — never assume the tree is well-formed.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Tree-Sitter integration | NAPI/ABI mismatch (#1) | Startup validation gate; pin versions; CI gate |
| Tree-Sitter integration | Grammar not available (#6) | Graceful fallback to regex; bundle top-5 grammars |
| Tree-Sitter integration | Parser crash on invalid syntax (#13) | Check `hasError`; skip ERROR nodes; try/catch |
| Git history mining | Memory explosion on large repos (#2) | Bounded window; streaming; caching; bin/ only |
| Git history mining | SpawnSync blocks event loop (#9) | Use async spawn for >10KB output; progress indicator |
| Git history mining | Timezone date parsing (#12) | Use `--date=unix`; compute in UTC |
| Context packing | XML increases token count (#3) | Measure first; minimal tag names; ≤60% ratio target |
| Context packing | Re-runs every hook invocation (#8) | Cache by git-hash; bin/ command only; one-time injection |
| Context packing | Small files produce longer output (#7) | Skip skeleton for files ≤50 lines; ratio check |
| Context packing | XML/HTML tag confusion (#11) | Namespace-prefixed tags or markdown format |
| Hotspot detection | False positives from generated/test files (#4) | Exclude patterns; normalize churn; confidence tiers |
| Hotspot detection | Complexity metric clashes with solve layers (#10) | Align with existing LAYER_KEYS; supplementary context |
| Co-change prediction | Spurious coupling from boilerplate commits (#5) | Filter commit messages; inverse file-count weighting; ≥3 threshold |
| Integration | Competing context budget with quorum instructions | Context packing is bin/ command output, NOT hook injection |
| Integration | Cache invalidation on branch switch | Key cache by git HEAD hash (same as quorum-cache.cjs pattern) |

---

## Integration-Specific Pitfalls

### Pitfall: Context Packing Competes with Quorum Instructions for Budget

**What goes wrong:**
nForma's `nf-prompt.js` has an 800-char context-stack injection cap (line 862). If context packing is injected via the same `additionalContext` path, it competes with quorum instructions, session state, root cause templates, and thinking budget directives. The quorum instructions MUST win this budget competition — they are the core enforcement mechanism.

**Prevention:**
- Context packing output should NEVER go through hook injection. It goes into workflow step context (plan-phase, execute-phase) where the budget is larger.
- Skeleton views and hotspot reports are injected as `<files_to_read>` or `<formal_context>` blocks in workflow steps, not as `additionalContext` in hooks.
- The packed context is consumed by the planner/executor subagents, not by the orchestrator hook pipeline.

---

### Pitfall: Tree-Sitter Native Module Conflicts in npm Package

**What goes wrong:**
nForma is published as an npm package (`@nforma.ai/nforma`). Adding `tree-sitter` as a dependency introduces a native `.node` binary. npm's package layout can conflict if the user's project also depends on `tree-sitter` (different version). Node.js loads the first `.node` it finds in the require path, not necessarily the version nForma needs.

**Prevention:**
- Use `optionalDependencies` for tree-sitter grammars, not `dependencies`. If the native module fails to install (no C++ compiler, wrong platform), nForma still works with degraded functionality.
- Implement the graceful degradation pattern from Pitfall #6: try `require('tree-sitter')` in a try/catch; if it fails, set a flag and use regex fallback.
- Consider WASM-based tree-sitter as a future option (the `tree-sitter` crate can compile to WASM). This eliminates native binding issues entirely but is slower.

---

## "Looks Done But Isn't" Checklist

- [ ] **Tree-Sitter integration:** ABI validation gate passes — `parser.setLanguage(grammar)` succeeds on all supported platforms (darwin-arm64, linux-x64, win32-x64)
- [ ] **Tree-Sitter integration:** `hasError` check present — skeleton extraction skips ERROR nodes and falls back gracefully
- [ ] **Tree-Sitter integration:** Top-5 grammars installed and tested — JavaScript, TypeScript, Python, Bash, JSON all parse successfully
- [ ] **Git history mining:** Bounded window used — never runs unbounded `git log --numstat` on entire history
- [ ] **Git history mining:** Streaming parser — output processed line-by-line, not buffered into single string
- [ ] **Git history mining:** Cache layer present — `.nforma/cache/churn-<hash>.json` exists and is used on second run
- [ ] **Context packing:** Token ratio measured — packed output is ≤60% of original token count
- [ ] **Context packing:** Small file threshold — files ≤50 lines include original content, not skeleton
- [ ] **Context packing:** NOT injected from hooks — packing output goes through workflow step context, not `additionalContext`
- [ ] **Hotspot detection:** Exclusion patterns present — generated files, test files, lockfiles excluded by default
- [ ] **Hotspot detection:** Churn normalized by file age — commits/month, not absolute count
- [ ] **Hotspot detection:** Confidence tiers reported — Tier 1/2/3 classification, not raw score list
- [ ] **Co-change prediction:** Commit filtering active — boilerplate commits excluded by message pattern
- [ ] **Co-change prediction:** Inverse file-count weighting — mass-edit commits contribute less weight
- [ ] **Co-change prediction:** Minimum co-occurrence threshold — pairs require ≥3 shared commits

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Tree-Sitter ABI mismatch | MEDIUM | Pin versions, add validation gate, add CI gate; requires all grammar packages to be updated |
| Git log memory explosion | LOW | Add bounded window and streaming; backward-compatible change |
| XML packing increases tokens | MEDIUM | Redesign schema with minimal tag names; re-validate token ratio |
| Hotspot false positives | LOW | Add exclusion patterns and normalization; backward-compatible |
| Co-change spurious coupling | LOW | Add commit filters and weighting; backward-compatible |
| Tree-Sitter grammar unavailable | LOW | Add regex fallback; graceful degradation |
| Context packing in hooks | MEDIUM | Move to workflow step context; requires architecture change |

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `spawnSync` for git log (blocking) | Faster to implement | Blocks event loop; OOM on large repos | Never for unbounded git log |
| Skip grammar ABI validation | Less startup code | Cryptic `Invalid language object` errors in production | Never — 10 lines of validation prevents hours of debugging |
| Use full XML tag names `<function>` | More readable | Wastes 5-8 tokens per tag vs `<fn>` | Prototyping only, replace before ship |
| Include all files in hotspot analysis | Simpler code | Noise reports users ignore | Never — exclusion is core logic, not optional |
| Treat all commits equally in co-change | Simpler code | Spurious coupling from mass-edits | Never — weighting is core logic |
| Bundle all 50+ Tree-Sitter grammars | Broader language support | Massive install size; ABI explosion | Never — bundle top 5, optional for rest |
| Run context packing per-turn | Always fresh data | Latency and token waste on every prompt | Never — cache by git hash, run on demand |

---

## Sources

- **Tree-Sitter NAPI migration:** GitHub issue #193 (tree-sitter/node-tree-sitter), verified from release notes v0.21.0 — breaking change from NAN to N-API, requires grammar regeneration. HIGH confidence.
- **Tree-Sitter ABI versioning:** Tree-Sitter List of Parsers wiki — ABI column (currently 13-15), grammar.json column, external scanner column. HIGH confidence.
- **Tree-Sitter prebuilt binaries:** Release notes v0.21.0 — "switch to prebuildify instead of prebuild-install (now binaries are stored on npm instead of GitHub Releases)". HIGH confidence.
- **nForma spawnSync patterns:** Direct codebase inspection of `nf-circuit-breaker.js`, `escalation-classifier.cjs`, `design-impact.cjs`, `quorum-cache.cjs`, `security-sweep.cjs` — all use `spawnSync` for bounded git operations. HIGH confidence.
- **nForma context budget:** `nf-prompt.js` line 862 comment on 800-char hook-level cap for context-stack injection. HIGH confidence.
- **nForma caching patterns:** `quorum-cache.cjs` uses SHA-256 keyed cache with git HEAD invalidation. HIGH confidence.
- **Git log performance:** Well-known limitation — `git log --numstat` on large repos produces megabytes of output. MEDIUM confidence (based on Git documentation and community knowledge, not nForma-specific benchmarking).
- **Context packing token overhead:** LLM token engineering community knowledge — XML tags consume 1-3 tokens each; verbose attribute syntax wastes tokens. MEDIUM confidence (heuristic, not empirically measured for Claude's specific tokenizer).
- **Hotspot false positive patterns:** Static analysis literature (Nagappan/Ball/Zeller "churn + complexity" studies) — generated files and test files are well-documented false-positive categories. HIGH confidence.
- **Co-change spurious coupling:** Mining Software Repositories literature — mass-edit commits create spurious coupling; inverse file-count weighting is standard practice. HIGH confidence.

---

*Pitfalls research for: Repowise Intelligence Integration (v0.42) — XML context packing, Tree-Sitter AST skeleton views, hotspot detection, co-change prediction added to nForma CLI*
*Researched: 2026-04-11*
