# Feature Landscape

**Domain:** Repository intelligence for AI coding agents — context optimization, structural code views, risk detection, and change coupling
**Milestone:** v0.42 — Repowise Intelligence Integration
**Researched:** 2026-04-11
**Confidence:** HIGH (well-established patterns from Aider, Code Maat, tree-sitter ecosystem; MEDIUM on specific implementation details for co-change prediction thresholds)

---

## Context: What Already Exists

nForma already ships context management infrastructure that the v0.42 features must integrate with:

- **`nf-context-monitor.js`** (PostToolUse hook): Tracks context window usage, budget thresholds, smart compact suggestions at workflow boundaries
- **`context-retriever.cjs`** (bin/): Domain-aware context fetching (test, architecture, formal) with keyword/segment matching and character budgets
- **`context-stack.cjs`** (bin/): JSONL-based cross-phase context accumulation with per-phase caps and injection formatting
- **`budget-tracker.cjs`** (bin/): Token budget computation, model downgrade chains, cooldown enforcement
- **`quorum-formal-context.cjs`** (bin/): Structured evidence block generation for quorum slot-worker prompts
- **Smart compaction**: Workflow boundary detection with `/compact` suggestions and survive/lost content listing

All v0.42 features extend this existing context pipeline. They are additive — no existing infrastructure is replaced.

---

## Table Stakes

Features users expect from any serious AI coding assistant working on real repositories. Missing = the tool feels naive about the codebase it operates in.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Structured context format (XML-style packing) | Every production LLM tool in 2026 uses structured markup for context sections. Raw file dumps are wasteful — they force the LLM to infer structure from content. Claude's own documentation uses `<files_to_read>` blocks. Aider uses structured repo maps. Anthropic's prompt engineering guide recommends XML tags for delineation. Not having this is like sending unstructured log lines instead of JSON. | LOW | The format itself is trivial. The hard part is deciding WHAT goes inside the tags. This feature is the delivery mechanism for the other three. |
| Skeleton-style file summaries | When an agent needs to understand a codebase, reading every file line-by-line is the most expensive possible approach. Aider proved that structural summaries (class names, function signatures, type annotations) provide 80% of the comprehension value at 5% of the token cost. Any agent operating on a real repo needs this. | MEDIUM | Tree-sitter-based extraction requires language grammars. Aider uses `py-tree-sitter-languages`; nForma needs `tree-sitter` Node.js bindings. The ranking algorithm (which symbols matter most) is the key complexity. |
| Change frequency awareness | An agent that treats a rarely-touched config file the same as the most-edited core module lacks basic codebase intelligence. "Which files change most?" is the simplest meaningful question you can ask of a git history. | LOW | `git log --numstat` parsing is straightforward. Pure churn ranking is a 50-line script. The value comes from integrating it into context selection, not from the metric itself. |

## Differentiators

Features that set nForma apart from basic context injection. Not expected by default, but highly valued — they make the agent's behavior qualitatively smarter.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hotspot detection (Churn × Complexity intersection) | High churn alone means "actively edited." High complexity alone means "hard to understand." Their intersection means "high-risk code that breaks often and is expensive to fix." This is the single most actionable metric from Adam Tornhill's behavioral code analysis research. It tells the agent WHERE to invest review effort, not just WHAT changed. | MEDIUM-HIGH | Requires both git churn extraction AND complexity computation. Cyclomatic complexity via tree-sitter AST is the gold standard; line-count complexity is the fallback. The intersection logic is simple; the complexity measurement is the hard part. |
| Co-change prediction (implicit coupling from git history) | Files that consistently change together share a hidden dependency, even when no import/require link exists. When an agent modifies `auth-middleware.cjs`, it should know that `session-store.cjs` has a 78% historical probability of also needing changes. This is forensic evidence of coupling that static analysis cannot detect. | MEDIUM | Algorithm is well-defined (Code Maat's temporal coupling): count co-occurrences in commits, compute coupling degree, filter by minimum shared revisions. The challenge is tuning thresholds and avoiding noise from mega-commits. |
| Budget-aware skeleton view compression | Aider's repo map uses a fixed `--map-tokens` budget. A smarter approach: dynamically adjust skeleton detail based on the current task's risk level (from `task-classification.json`), the agent's remaining context window (from `nf-context-monitor`), and the file's hotspot score. High-risk files get full signatures; low-risk files get names-only. | MEDIUM | Requires integration across three subsystems: context monitor (budget), task classifier (risk), hotspot detector (importance). The adaptive algorithm is the differentiator; static repo maps are table stakes. |

## Anti-Features

Features to explicitly NOT build. These are common traps that seem useful but degrade the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full-function-body inclusion in skeleton views | Defeats the purpose. If you include function bodies, you're just doing file inclusion with extra steps. The whole point of skeleton views is to give structure WITHOUT implementation details. Including bodies makes the "skeleton" just as expensive as reading the file. | Signatures + type annotations + docstrings only. If the agent needs body text, it requests the specific file (existing `/add` pattern). |
| Real-time co-change updates on every commit | Mining git history for co-change is expensive (O(commits × files_per_commit)). Running it on every commit would add seconds of latency to every hook. The coupling signal changes slowly — weekly is more than sufficient. | Cache co-change predictions in `.planning/repowise/co-change-cache.json`. Refresh on explicit command (`/nf:repowise-refresh`) or weekly via scheduled hook. Agent reads cache, never computes on-demand. |
| Hard hotspot gating (block edits to non-hotspot files) | Using hotspot detection to BLOCK edits to "safe" files is authoritarian and wrong. Hotspots identify RISK, not permission. A low-hotspot file might be exactly the right place to make a change. Structural enforcement of edit scope is a different feature (v0.40's branch scope guard). | Hotspot data is advisory context, injected as `additionalContext` or into the skeleton view's metadata. "This file is a hotspot (churn: 47, complexity: 18)" — not "You may not edit this file." |
| Per-language custom complexity formulas | Some academic approaches define per-language complexity metrics (Weighted Methods per Class for Java, Nesting Depth for Python). This creates an exponential maintenance surface and makes the system fragile to new languages. | Use one universal metric (cyclomatic complexity or lines-of-code-in-functions) computed uniformly via tree-sitter AST. Consistency across languages matters more than per-language precision. |
| Storing entire git log in memory | Code Maat's known limitation: it processes everything in memory and doesn't scale to large repos. nForma should not repeat this mistake. | Stream git log output through line-by-line parsing. Aggregate into per-file and per-pair counters incrementally. Never hold the full log in memory. |

---

## Feature Dependencies

```
XML-style context packing (format layer)
    └──delivers──> Skeleton Views (structure goes INSIDE XML tags)
    └──delivers──> Hotspot metadata (scores go INSIDE XML tags)
    └──delivers──> Co-change predictions (coupling pairs go INSIDE XML tags)

Skeleton Views (tree-sitter)
    └──provides structure──> Hotspot detection (complexity computed FROM AST)
    └──provides structure──> Budget-aware compression (ranking symbols by importance)

Hotspot detection (churn + complexity)
    └──requires──> Skeleton Views (complexity measurement)
    └──requires──> Git churn extraction (independent)

Co-change prediction (git history mining)
    └──independent of──> Skeleton Views (uses git history, not AST)
    └──integrates with──> XML context packing (output format)

Budget-aware skeleton compression
    └──requires──> Skeleton Views (the thing being compressed)
    └──requires──> Hotspot detection (importance signal)
    └──requires──> context-monitor integration (budget signal)
```

### Dependency Notes

- **XML context packing is the delivery layer, not a standalone feature.** It has zero value without content to pack. Build it concurrently with skeleton views, but understand that its value is proportional to the richness of what goes inside the tags.
- **Skeleton views enable hotspot detection.** Cyclomatic complexity (the "complexity" in Churn × Complexity) requires AST traversal. You can approximate with line counts, but tree-sitter AST gives you real cyclomatic complexity. Build skeleton views first, then add complexity computation on top.
- **Co-change prediction is independent of AST.** It mines `git log --numstat` output. It can be built in parallel with skeleton views. Its only dependency is the XML packing format for output.
- **Budget-aware compression is a refinement, not a base feature.** It requires all three other features to be working first (skeleton views, hotspot scores, context monitor integration). Build it last.

---

## Feature Detail: XML-style Context Packing

### What It Is

A structured XML-like format for delivering repository intelligence to the LLM context window. Instead of dumping raw file contents or unstructured markdown, context sections are wrapped in semantic tags:

```xml
<repository-intelligence version="1">
  <skeleton-view budget="4000">
    <file path="bin/nf-solve.cjs" hotspot="true" churn="32" complexity="14">
      <symbol kind="function" name="runSolveCycle" line="47" exported="true">
        runSolveCycle(cwd, config, phaseProgress)
      </symbol>
      <symbol kind="function" name="computeResidual" line="112" exported="true">
        computeResidual(cwd, layerResults, threshold)
      </symbol>
    </file>
    <file path="hooks/nf-context-monitor.js" churn="8" complexity="6">
      <symbol kind="function" name="detectCleanBoundary" line="47">
        detectCleanBoundary(toolName, toolInput)
      </symbol>
    </file>
  </skeleton-view>

  <co-change-prediction confidence="0.78">
    <coupling entity="bin/nf-solve.cjs" coupled="bin/solve-wave-dag.cjs" degree="78" shared-revs="22"/>
    <coupling entity="bin/nf-solve.cjs" coupled="bin/solve-focus-filter.cjs" degree="65" shared-revs="18"/>
  </co-change-prediction>

  <hotspots>
    <hotspot file="bin/nf-solve.cjs" churn="32" complexity="14" risk="high"/>
    <hotspot file="bin/context-retriever.cjs" churn="5" complexity="3" risk="low"/>
  </hotspots>
</repository-intelligence>
```

### Why XML-style

1. **Claude processes XML tags efficiently.** Anthropic's own prompt engineering guide recommends `<tag>` delimiters for structured context. Claude's tokenizer handles XML-like tags without adding significant token overhead.
2. **Self-describing.** Tags carry metadata (`hotspot="true"`, `churn="32"`) that would otherwise require explanatory prose. The format IS the documentation.
3. **Hierarchical compression.** The agent can request different detail levels: `budget="full"` for the skeleton view when context is plentiful, `budget="minimal"` when context is scarce. The XML structure makes this natural.
4. **Skip-friendly.** LLMs can parse `</section>` boundaries to skip irrelevant sections. Raw markdown doesn't have this property.

### Integration Points

- **`nf-prompt.js`**: Inject `<repository-intelligence>` block into `additionalContext` on session start or task dispatch
- **`context-retriever.cjs`**: Replace `--- filepath ---` delimiter format with XML tags
- **`quorum-formal-context.cjs`**: Wrap formal evidence blocks in `<formal-evidence>` tags
- **`nf-context-monitor.js`**: Use `<context-budget>` tags for budget warnings

### Expected Behavior

| Scenario | Before (v0.41) | After (v0.42) |
|----------|----------------|----------------|
| Agent needs to understand codebase structure | Reads full files, consuming 10-50k tokens | Receives skeleton view consuming 1-3k tokens |
| Agent dispatches to quorum | Context is unstructured markdown | Context is structured XML with hotspot and coupling metadata |
| Context budget runs low | Smart compact suggests `/compact` | Skeleton view automatically downgrades to names-only |

---

## Feature Detail: AST-based Skeleton Views via Tree-Sitter

### What It Is

A structural code summary system that parses source files via tree-sitter AST and extracts:
- **Symbol definitions**: function names, class names, method names, variable declarations
- **Type signatures**: parameter names and types, return types (where available)
- **Call graph hints**: exported vs private, reference counts
- **Structural metadata**: line ranges, nesting depth, complexity scores

This is the "repo map" concept from Aider, adapted for nForma's context pipeline.

### How Aider Does It (Reference Implementation)

Aider's proven approach (verified in production since Oct 2023):

1. **Parse**: Use `py-tree-sitter-languages` to parse each source file into an AST
2. **Extract**: Walk the AST with language-specific `tags.scm` queries to find definitions (functions, classes, methods, variables)
3. **Rank**: Build a graph where files are nodes and imports/references are edges. Use a PageRank-like algorithm to rank symbols by importance.
4. **Compress**: Starting with the highest-ranked symbols, include their definition lines (signature + key metadata) until the token budget is exhausted.
5. **Render**: Output in the compact format shown in Aider's docs (file path, `⋮...` for skipped lines, `│` for definition lines).

### nForma Adaptation

Key differences from Aider's approach:

| Aspect | Aider | nForma |
|--------|-------|--------|
| Runtime | Python (`py-tree-sitter-languages`) | Node.js (`tree-sitter` npm package) |
| Trigger | Every message to LLM | Session start + task dispatch + on-demand |
| Budget | Fixed `--map-tokens` (default 1k) | Dynamic based on context window remaining (from `nf-context-monitor`) |
| Importance signal | Pure PageRank from references | PageRank + hotspot score + co-change relevance |
| Output format | Custom ASCII format | XML-style `<skeleton-view>` tags |
| Scope | All tracked files | Target files + proximity graph neighbors (from existing `resolve-proximity-neighbors.cjs`) |

### Language Support Strategy

**Tier 1 (ship immediately):** JavaScript/TypeScript, Python — the languages nForma itself is written in, plus the most common target language.

**Tier 2 (add on demand):** Go, Rust, C/C++, Java, Ruby — well-maintained tree-sitter grammars exist for all.

**Tier 3 (best-effort):** Shell script, JSON, YAML, Markdown — limited structural value but useful for config files.

**Fallback (no grammar available):** Line-count complexity + regex-based function signature extraction. Better than nothing, worse than AST.

### Complexity Assessment

- **Tree-sitter binding**: LOW — `tree-sitter` npm package (v0.22.4) is mature, 841 GitHub stars, native binary wheels
- **Grammar packages**: MEDIUM — each language needs a `tree-sitter-<lang>` package. The ecosystem has 100+ grammars, but binary compatibility varies. `tree-sitter-javascript` and `tree-sitter-typescript` are Tier 1.
- **Tags queries**: MEDIUM — Aider's `tags.scm` files are MIT-licensed and can be adapted. Each language needs a query file.
- **Ranking algorithm**: MEDIUM — PageRank on a reference graph. Aider's implementation is a reference. nForma already has proximity graph infrastructure (`resolve-proximity-neighbors.cjs`).
- **Dynamic budgeting**: LOW — read `remaining_percentage` from context monitor, compute budget allocation.

---

## Feature Detail: Hotspot Detection (Churn + Complexity)

### What It Is

A risk scoring system that identifies code regions where high change frequency intersects with high structural complexity. These "hotspots" are the most defect-prone, expensive-to-maintain parts of a codebase.

### Theoretical Basis

Adam Tornhill's research ("Your Code as a Crime Scene", "Software Design X-Rays") demonstrated:

1. **Churn predicts defects.** Modules with the highest revision counts have the most post-release bugs. This is one of the strongest empirical findings in software engineering research.
2. **Complexity amplifies risk.** High churn in a simple module is manageable. High churn in a complex module is a maintenance emergency.
3. **The intersection is actionable.** Hotspot ranking tells you WHERE to focus refactoring effort, not just WHAT changed.

### Computation

**Churn score** (per file):
```
churn = total_commits_touching_file / analysis_period_months
```
Source: `git log --format="%H" --numstat -- <file>` — count distinct commit hashes.

**Complexity score** (per file):
```
complexity = sum(cyclomatic_complexity(fn) for fn in file_functions)
```
Source: tree-sitter AST — count decision points (if, while, for, case, &&, ||, catch).

**Hotspot score** (per file):
```
hotspot = churn × complexity
```
Files are then ranked by hotspot score. Top N are flagged as hotspots.

### Implementation Approach

| Step | Approach | Complexity |
|------|----------|------------|
| Git churn extraction | Stream `git log --numstat --format="%H"` output, accumulate per-file commit counts | LOW |
| Complexity computation | Tree-sitter AST walk counting decision-point node types | MEDIUM |
| Hotspot ranking | Simple multiplication + sort | LOW |
| Integration with context pipeline | Add `hotspot="true"` attribute to skeleton view `<file>` tags | LOW |
| Caching | Store in `.planning/repowise/hotspot-cache.json` with git-HEAD invalidation | LOW |

### Complexity Fallback

If tree-sitter grammar is unavailable for a language, fall back to:
```
complexity_fallback = lines_of_code_in_functions(file)
```
This is a weaker signal but still correlates with defect density. The system should clearly label which complexity metric was used.

---

## Feature Detail: Co-change Prediction

### What It Is

A coupling detector that mines git history to find files that change together more often than chance would predict. This reveals **implicit dependencies** — files that share no import/require link but consistently co-occur in commits due to shared business logic, data contracts, or undocumented assumptions.

### Algorithm (from Code Maat)

The reference algorithm, well-validated on 50+ open-source projects:

1. **Parse git log**: For each commit, record the set of files changed.
2. **Filter**: Exclude commits with > N files (default 30) — these are mega-commits that create noise.
3. **Count pairs**: For each (file_a, file_b) pair where both appear in the same commit, increment their co-occurrence counter.
4. **Compute coupling degree**: For each pair (a, b), `degree = shared_revs / min(revs_a, revs_b) × 100`. This is the percentage of times that when the less-frequently-changed file changed, the other also changed.
5. **Filter by significance**: Only include pairs with `shared_revs >= min_shared_revs` (default 5) and `degree >= min_degree` (default 30%).

### Example Output

For nForma's own repo, expected couplings:

```xml
<co-change-prediction>
  <coupling entity="bin/nf-solve.cjs" coupled="bin/solve-wave-dag.cjs"
            degree="78" shared-revs="22" confidence="high"/>
  <coupling entity="bin/nf-solve.cjs" coupled="bin/solve-focus-filter.cjs"
            degree="65" shared-revs="18" confidence="high"/>
  <coupling entity="hooks/nf-context-monitor.js" coupled="bin/budget-tracker.cjs"
            degree="45" shared-revs="8" confidence="medium"/>
</co-change-prediction>
```

### Integration Use Cases

1. **Task dispatch**: When the agent is about to modify `nf-solve.cjs`, inject `<co-change-prediction>` context warning that `solve-wave-dag.cjs` has 78% coupling — "also review this file."
2. **Quorum context**: During quorum dispatch, include co-change predictions so workers can assess change ripple.
3. **Skeleton view enrichment**: Annotate file entries with `coupled-to="solve-wave-dag.cjs:78%"` attributes.

### Thresholds

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| `min_shared_revs` | 5 | Below 5 shared revisions, coupling is likely coincidental |
| `min_coupling_degree` | 30% | Below 30%, the coupling signal is too weak to be actionable |
| `max_changeset_size` | 30 | Commits touching >30 files are typically refactors or auto-formatting — noise |
| `analysis_window` | 6 months | Older coupling patterns may no longer be relevant; 6 months is a good balance |

### Caching Strategy

Co-change predictions change slowly. Computing them on every task dispatch would be wasteful.

- **Cache file**: `.planning/repowise/co-change-cache.json`
- **Invalidation**: git HEAD change (if HEAD moved, recompute)
- **On-demand refresh**: `/nf:repowise-refresh` command
- **Computation time**: ~2-5 seconds for a repo with 10k commits (streaming, not in-memory)

---

## MVP Recommendation

### Prioritize (Build First)

1. **XML-style context packing** — Foundation for everything else. Without the delivery format, none of the other features can inject their output. LOW complexity, HIGH leverage.
2. **Skeleton Views (Tier 1 languages only)** — The single highest-value feature. Gives agents structural understanding of the codebase at 5% of the token cost. MEDIUM complexity, VERY HIGH value.
3. **Git churn extraction** — Half of hotspot detection, useful standalone for file prioritization. LOW complexity, MEDIUM value alone.

### Build Second (MVP Requires These)

4. **Hotspot detection** — Churn × Complexity intersection. Requires skeleton views for complexity computation. MEDIUM-HIGH complexity, HIGH value.
5. **Co-change prediction** — Independent of skeleton views, can be built in parallel with #4. MEDIUM complexity, HIGH value for agents modifying coupled files.

### Build Last (Refinement)

6. **Budget-aware skeleton compression** — Requires all of #2-#5 to be working. Adapts skeleton detail to context budget. MEDIUM complexity, MEDIUM value (nice-to-have vs. static budget).

### Defer

- **Tier 2/3 language support**: Ship with JS/TS/Python only. Add Go, Rust, Java based on user demand.
- **Real-time co-change updates**: Weekly cache refresh is sufficient.
- **Per-language complexity metrics**: Use uniform cyclomatic complexity.
- **Skeleton view diff tracking**: Detecting when skeletons change between sessions is useful but not v0.42 scope.

---

## Feature Prioritization Matrix

| Feature | Agent Value | Implementation Cost | Dependencies | Priority |
|---------|-------------|---------------------|--------------|----------|
| XML-style context packing | HIGH (enables all others) | LOW (format definition + injection wiring) | None | P0 |
| Skeleton Views (Tier 1) | VERY HIGH (80% comprehension at 5% tokens) | MEDIUM (tree-sitter + grammars + tags queries + ranking) | XML packing | P1 |
| Git churn extraction | MEDIUM (file prioritization signal) | LOW (git log parsing, ~50 lines) | None | P1 |
| Hotspot detection (Churn × Complexity) | HIGH (risk-aware context selection) | MEDIUM-HIGH (requires skeleton views for complexity) | Skeleton views + churn | P2 |
| Co-change prediction | HIGH (implicit coupling detection) | MEDIUM (git log mining + pair counting) | XML packing | P2 |
| Budget-aware compression | MEDIUM (adaptive detail) | MEDIUM (integration across 3 subsystems) | All above | P3 |

**Priority key:**
- P0: Must build first (enables all others)
- P1: Must have for launch (v0.42)
- P2: Should have (v0.42, build after P1s)
- P3: Nice to have (v0.42, if time permits)

---

## Competitor Feature Analysis

| Feature | Aider | Cursor | Claude Code (native) | Our Approach |
|---------|-------|--------|----------------------|--------------|
| Structured context format | Custom ASCII repo map | Proprietary context system | `<files_to_read>` blocks | XML-style tags with metadata attributes (hotspot scores, coupling degree) |
| Skeleton Views | Tree-sitter repo map (production, since Oct 2023) | Index-based codebase overview | No structural summary | Tree-sitter skeleton + hotspot scores + coupling annotations = richer than Aider's pure-structure map |
| Hotspot detection | None | None (no git history analysis) | None | Churn × Complexity from Tornhill's research — unique to nForma |
| Co-change prediction | None | None | None | Temporal coupling from git history — unique to nForma |
| Budget-aware compression | Fixed `--map-tokens` | Automatic (proprietary) | No budget awareness | Dynamic budget from context monitor + task risk + hotspot importance — more adaptive than Aider's static budget |

**Key insight:** Aider has the most mature skeleton view implementation, but it's purely structural (no risk/coupling metadata). nForma's differentiation is enriching the structural skeleton with behavioral intelligence (hotspots + co-change predictions). This is the "wise" in Repowise — structure + behavior.

---

## Sources

- [Building a better repository map with tree-sitter — Aider Blog](https://aider.chat/2023/10/22/repomap.html) — HIGH confidence (primary reference for skeleton views, verified in production since 2023)
- [Aider Repository Map Documentation](https://aider.chat/docs/repomap.html) — HIGH confidence (official docs, detailed algorithm description)
- [Tree-sitter GitHub](https://github.com/tree-sitter/tree-sitter) — HIGH confidence (24.7k stars, official project, v0.26.8)
- [Node.js Tree-sitter Bindings](https://github.com/tree-sitter/node-tree-sitter) — HIGH confidence (841 stars, official bindings, v0.22.4)
- [Code Maat — Adam Tornhill](https://github.com/adamtornhill/code-maat) — HIGH confidence (2.6k stars, reference implementation for churn/coupling analysis, canonical source for temporal coupling algorithm)
- [Your Code as a Crime Scene — Adam Tornhill (Pragmatic Bookshelf)](https://pragprog.com/titles/atcrime/your-code-as-a-crime-scene/) — HIGH confidence (published book, foundational research for hotspot detection)
- [Software Design X-Rays — Adam Tornhill (Pragmatic Bookshelf)](https://pragprog.com/titles/atevol/software-design-x-rays/) — HIGH confidence (sequel book, refined hotspot and coupling analysis)
- [RepoWise Organization on GitHub](https://github.com/RepoWise) — MEDIUM confidence (related project, AI-powered repository analysis, confirms the pattern but different focus: RAG over docs/issues rather than context optimization for agents)
- [Anthropic Prompt Engineering Guide — XML Tags](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags) — HIGH confidence (official Anthropic documentation recommending XML-style context structuring)
- nForma existing infrastructure: `context-retriever.cjs`, `context-stack.cjs`, `budget-tracker.cjs`, `nf-context-monitor.js`, `quorum-formal-context.cjs` — HIGH confidence (first-party code, read and verified in this research session)

---
*Feature research for: v0.42 Repowise Intelligence Integration (nForma)*
*Researched: 2026-04-11*
