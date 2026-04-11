# Project Research Summary

**Project:** nForma v0.42 — Repowise Intelligence Integration
**Domain:** CLI plugin — repository context optimization for multi-agent quorum workflows
**Researched:** 2026-04-11
**Confidence:** HIGH

## Executive Summary

nForma v0.42 adds a "Repowise Intelligence" layer that gives AI coding agents structural understanding of repositories at a fraction of the token cost of reading full source files. This is the same problem Aider solved with its tree-sitter repo map (production-proven since 2023), but nForma goes further by enriching structural skeletons with behavioral intelligence — hotspot detection (Churn × Complexity) and co-change prediction (implicit coupling from git history). The core insight: structure alone is table stakes; structure + behavior is the differentiator.

The recommended approach is a standalone intelligence layer (`bin/repowise/`) with a single orchestration entry point (`context-packer.cjs`) that existing workflows call at the same points they currently call `design-impact.cjs` and `formal-scope-scan.cjs`. No existing components are replaced — only extended. The only new runtime dependency is `web-tree-sitter` (WASM bindings), added as an `optionalDependency` matching the existing `@huggingface/transformers` pattern. Everything else — XML packing, churn extraction, complexity computation, co-change mining — is implemented with stdlib (`child_process`, string templates) or builds on the same AST used for skeleton views.

The key risks are: (1) tree-sitter WASM/grammar ABI mismatches causing cryptic runtime failures, (2) git log operations overwhelming memory on large repos if not bounded and streamed, and (3) XML context packing increasing token count rather than reducing it if tag design is verbose. All three are preventable with upfront discipline: pin grammar versions with a startup ABI validation gate, use bounded git log windows with streaming parsers, and design a token-minimal XML schema validated by measurement before build.

## Key Findings

### Recommended Stack

The stack is deliberately lean — only one new dependency (`web-tree-sitter`), added as an optionalDependency. Everything else uses Node.js stdlib or custom code. The research strongly argues against adding `simple-git`, `escomplex`, `apriori`, or any XML library — each either duplicates existing capability, is unmaintained, or is overkill for nForma's needs.

**Core technologies:**
- **`web-tree-sitter` (WASM) ^0.26.8**: AST-based skeleton views — WASM over native bindings because nForma must install via `npm install` without C++ compilation
- **`tree-sitter-javascript` ^0.25.0, `tree-sitter-python` ^0.25.0, `tree-sitter-typescript` ^0.23.2, `tree-sitter-bash` ^0.25.1**: Grammar packages (all optionalDependency) — Tier 1 languages for skeleton extraction
- **`child_process.spawnSync` (stdlib)**: Git churn + co-change mining — nForma already uses raw spawnSync at 185+ call sites; no wrapper library needed
- **String template literals**: XML context packing — generating `<file path="...">content</file>` strings, not parsing XML; zero dependencies
- **Custom co-occurrence counter (~100 lines)**: Co-change prediction — simpler than full Apriori algorithm; pair-level co-occurrence is all that's needed

**Critical version requirement:** Grammar packages must be ABI 14+ compatible with `web-tree-sitter` version. Pin exact versions — never use `^` ranges for grammar packages.

### Expected Features

The feature landscape has clear dependency chains. XML context packing is the delivery layer for everything else. Skeleton views enable hotspot complexity computation. Co-change prediction is independent of AST and can be built in parallel.

**Must have (table stakes):**
- **XML-style context packing** — structured markup for context sections; every production LLM tool uses this; trivial format but essential delivery mechanism
- **Skeleton-style file summaries** — structural code views via tree-sitter AST; Aider proved this gives 80% comprehension at 5% token cost
- **Change frequency awareness** — `git log --numstat` churn extraction; simplest meaningful question you can ask of git history

**Should have (competitive differentiators):**
- **Hotspot detection (Churn × Complexity)** — identifies high-risk code from behavioral code analysis research (Tornhill); unique among AI coding assistants
- **Co-change prediction** — implicit coupling from git history; forensic evidence of dependencies that static analysis cannot detect
- **Budget-aware skeleton compression** — dynamically adjusts skeleton detail based on context budget, task risk, and hotspot scores

**Defer (v2+):**
- Tier 2/3 language support (Go, Rust, C/C++, Java, Ruby) — ship with JS/TS/Python/Bash only
- Real-time co-change updates — weekly cache refresh is sufficient
- Per-language complexity metrics — uniform cyclomatic complexity via tree-sitter AST is enough
- Skeleton view diff tracking — useful but not v0.42 scope

### Architecture Approach

Four new capabilities integrate as a standalone intelligence layer (`bin/repowise/`) with a single entry point that existing workflows call. No existing components are modified — only extended with new call sites. The fail-open philosophy (if Repowise fails, workflows continue without it) matches nForma's existing pattern for `design-impact.cjs`, `formal-scope-scan.cjs`, and `task-classifier.cjs`.

**Major components:**
1. **`context-packer.cjs`** — orchestration entry point; assembles skeleton + hotspot + cochange → XML; called from plan-phase (step 4.7), quick (step 2.8), debug (step A.3)
2. **`skeleton-view.cjs`** — tree-sitter AST → structural code skeleton with regex fallback
3. **`hotspot-detector.cjs`** — git churn + cyclomatic complexity → risk scores; integrates into `nf-prompt.js` risk escalation and `task-classifier.cjs` complexity adjustment
4. **`cochange-miner.cjs`** — git history → file co-occurrence coupling map; integrates into debug bundles and researcher context
5. **`xml-packer.cjs`** — assembles structured XML context from components with token-minimal tag design

**Key patterns:** Fail-open intelligence injection, cache-first with git-SHA invalidation, two-pass context loading (skeleton first, full source on demand), XML-style context packing, hook-level risk level enrichment.

### Critical Pitfalls

1. **Tree-sitter grammar ABI mismatch** — pin exact grammar versions, add startup validation gate (`parser.setLanguage()` in try/catch with clear error message), add CI gate that validates all grammars load successfully
2. **Git log memory explosion on large repos** — never run unbounded `git log` from hooks; use `--since` bounded window; stream output line-by-line instead of buffering; implement incremental caching by git SHA
3. **XML packing that increases tokens** — design token-minimal schema first (`<fn>` not `<function>`); measure packed/unpacked ratio; target ≤60% of original tokens; skip skeleton for files ≤50 lines
4. **Hotspot false positives from unnormalized churn** — exclude generated/test/lockfile patterns by default; normalize churn by file age (commits/month); use complexity-per-function not total; report confidence tiers not raw scores
5. **Co-change spurious coupling from mass-edits** — filter boilerplate commit messages; use inverse file-count weighting; require ≥3 shared commits minimum; separate structural from temporal coupling

## Implications for Roadmap

Based on research, suggested phase structure follows the dependency chain: format layer first, then git-only features (which need no new deps), then tree-sitter (the complex new dependency) last.

### Phase 1: XML Context Packer + Infrastructure
**Rationale:** Pure string formatting — no tree-sitter, no git mining. Establishes the output format all other components feed into. Can be tested immediately with hand-crafted data. Zero new dependencies.
**Delivers:** `xml-packer.cjs`, `context-packer.cjs` (initially returns empty), `.planning/repowise/` cache directory, integration into plan-phase step 4.7, context-retriever repowise domain
**Addresses:** XML-style context packing (P0 feature)
**Avoids:** Pitfall #3 (token bloat) — schema is designed first with measurement before any content goes in; Pitfall #8 (per-hook re-runs) — packing is wired as workflow step, not hook

### Phase 2: Hotspot Detection (Git-Log Only)
**Rationale:** Uses only `git log` — no tree-sitter, no new dependencies. Delivers immediate value for risk escalation in `nf-prompt.js` and `task-classifier.cjs`. Churn-only hotspot is still useful; complexity can start as line-count heuristic and upgrade to AST-based later.
**Delivers:** `hotspot-detector.cjs`, cache layer, risk escalation in `nf-prompt.js`, hotspot-aware complexity in `task-classifier.cjs`
**Addresses:** Change frequency awareness (P1), partial hotspot detection (P2 — churn half)
**Avoids:** Pitfall #2 (memory explosion) — bounded window, streaming parser, caching from day one; Pitfall #4 (false positives) — exclusion patterns, normalization, confidence tiers are core algorithm not post-processing

### Phase 3: Co-Change Prediction (Git-Log Only)
**Rationale:** Also uses only git history — no tree-sitter. Independent of skeleton views. Delivers value for debug bundles (auto-include co-change partners) and researcher context. Can be built in parallel with Phase 2 if resources allow.
**Delivers:** `cochange-miner.cjs`, cache layer, debug bundle integration, context-packer cochange section
**Addresses:** Co-change prediction (P2)
**Avoids:** Pitfall #5 (spurious coupling) — commit filtering and inverse file-count weighting are core algorithm; Pitfall #12 (timezone dates) — use `--date=unix`

### Phase 4: Skeleton Views via Tree-Sitter (New Dependency)
**Rationale:** Tree-sitter introduces the only new dependency and is the most complex integration. Deferring to last means Phases 1-3 deliver value independently. If tree-sitter installation fails on any platform, all other features still work. Skeleton views provide the biggest token savings (60-80%) but build on the infrastructure from Phases 1-3.
**Delivers:** `web-tree-sitter` + grammar packages as optionalDependencies, `skeleton-view.cjs` with regex fallback, cache layer, two-pass context loading in workflows
**Addresses:** Skeleton-style file summaries (P1), completes hotspot detection with AST-based complexity (P2)
**Avoids:** Pitfall #1 (ABI mismatch) — startup validation gate, pinned versions, CI gate; Pitfall #6 (grammar unavailable) — graceful regex fallback; Pitfall #13 (parser crashes) — `hasError` check, ERROR node skip, try/catch

### Phase 5: Budget-Aware Compression (Refinement)
**Rationale:** Requires all of Phases 2-4 to be working. Dynamically adjusts skeleton detail based on context budget, task risk, and hotspot importance. This is the "nice to have" that makes the system adaptive rather than static.
**Delivers:** Adaptive skeleton detail based on `nf-context-monitor` budget, task-classifier risk, and hotspot scores
**Addresses:** Budget-aware skeleton compression (P3)
**Avoids:** Competing with quorum instructions for budget — context packing goes through workflow steps, not hook `additionalContext`

### Phase Ordering Rationale

- **Phase 1 first** because XML packing is the delivery format for everything else — without it, no other feature can inject output. It's also zero-dependency and low-risk.
- **Phases 2-3 before Phase 4** because git-only features need no new dependencies and work even if tree-sitter fails to install. This minimizes blast radius of the one new dependency.
- **Phase 4 last of the "core" phases** because tree-sitter is the most complex integration and the most likely to cause install issues. Phases 1-3 deliver standalone value if Phase 4 hits problems.
- **Phase 5 is refinement** because it requires all three signals (skeleton, hotspot, budget) to be working. It's a multiplier, not a base feature.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Tree-Sitter):** Complex dependency integration — need to validate WASM binding performance, grammar ABI compatibility matrix across platforms, and `.wasm` file resolution from npm packages. The `require.resolve('tree-sitter-javascript/tree-sitter-javascript.wasm')` pattern needs verification.
- **Phase 5 (Budget-Aware Compression):** Integration across three subsystems (context monitor, task classifier, hotspot detector) — need to validate the adaptive algorithm and measure real token savings.

Phases with standard patterns (skip research-phase):
- **Phase 1 (XML Packer):** Pure string formatting, well-understood XML-tag patterns from Anthropic's own prompt engineering docs
- **Phase 2 (Hotspot Detection):** Standard `git log --numstat` parsing, well-documented in Code Maat and Tornhill's research
- **Phase 3 (Co-Change Prediction):** Standard co-occurrence mining, well-documented algorithm from Code Maat

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new dependency (web-tree-sitter), verified on npm. All alternatives thoroughly evaluated and rejected with clear rationale. |
| Features | HIGH | Aider's repo map is production-proven since 2023. Hotspot/co-change algorithms from Tornhill's published research. MEDIUM on co-change threshold tuning (empirical, needs validation on real repos). |
| Architecture | HIGH | Based on direct codebase analysis. Integration points (plan-phase step 4.7, quick step 2.8, debug step A.3) are specific and verifiable. Existing fail-open patterns are well-documented. |
| Pitfalls | HIGH | Tree-sitter ABI issues verified from GitHub issues/releases. Git log performance from nForma's own spawnSync patterns. Context budget from nf-prompt.js line 862. MEDIUM on token overhead estimates (heuristic, not empirically measured). |

**Overall confidence:** HIGH

### Gaps to Address

- **Token overhead measurement:** Research estimates XML packing at ~4 chars/token and recommends ≤60% ratio, but this needs empirical validation with Claude's actual tokenizer during Phase 1. Add `--dry-run` mode that reports token counts before/after.
- **Co-change threshold tuning:** Default thresholds (min_shared_revs=5, min_degree=30%, max_changeset_size=30) are from Code Maat's defaults. nForma's repo may need different values. Plan for tuning during Phase 3.
- **Grammar .wasm resolution from npm packages:** The `require.resolve('tree-sitter-javascript/tree-sitter-javascript.wasm')` pattern is documented but needs verification that grammar npm packages actually ship `.wasm` files at the expected paths. Validate during Phase 4 before building skeleton-view.cjs.
- **Scaling to monorepos:** Architecture notes O(N²) co-change mining. The `--max-files 500` default limits scope, but actual performance at 100K files needs benchmarking. Address during Phase 3 if nForma is used in monorepos.

## Sources

### Primary (HIGH confidence)
- Tree-sitter official docs (tree-sitter.github.io) — WASM binding API, grammar ABI versions
- Tree-sitter GitHub (github.com/tree-sitter/tree-sitter) — 24.7k stars, official project, v0.26.8
- Node-tree-sitter GitHub (github.com/tree-sitter/node-tree-sitter) — 841 stars, NAPI migration in v0.21
- Aider Blog — "Building a better repository map with tree-sitter" (aider.chat/2023/10/22/repomap.html) — production reference for skeleton views
- Code Maat (github.com/adamtornhill/code-maat) — 2.6k stars, reference for churn/coupling algorithms
- Adam Tornhill — "Your Code as a Crime Scene" (Pragmatic Bookshelf) — foundational hotspot detection research
- Anthropic Prompt Engineering Guide — XML tags recommendation (docs.anthropic.com)
- nForma codebase — direct grep of child_process usage, context-retriever.cjs, budget-tracker.cjs, nf-prompt.js

### Secondary (MEDIUM confidence)
- RepoWise GitHub organization — confirms pattern (AI repo analysis) but different focus (RAG over docs)
- Git log performance — community knowledge on large-repo scaling, not nForma-specific benchmarks
- Token overhead estimates — heuristic (4 chars/token), not empirically measured for Claude's tokenizer

### Tertiary (LOW confidence)
- Co-change prediction thresholds — default values from Code Maat; need empirical tuning on nForma's repo
- Monorepo scaling at 100K files — estimated, not benchmarked

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*
