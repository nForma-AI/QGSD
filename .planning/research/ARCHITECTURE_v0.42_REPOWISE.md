# Architecture Patterns: Repowise Intelligence Integration

**Domain:** CLI plugin — context optimization for multi-agent quorum workflows
**Researched:** 2026-04-11
**Confidence:** HIGH (existing architecture well-understood from codebase analysis; Tree-Sitter bindings verified via official docs)

## Recommended Architecture

Four new capabilities integrate as a **standalone intelligence layer** (`bin/repowise/`) with a single entry point (`context-packer.cjs`) that all existing workflows call at the same point they currently call `design-impact.cjs` and `formal-scope-scan.cjs`. No existing components are modified — only extended with new call sites.

```
┌──────────────────────────────────────────────────────────────────────┐
│                     EXISTING ARCHITECTURE                           │
│                                                                      │
│  hooks/nf-prompt.js ─────── quorum injection                       │
│  hooks/nf-stop.js ────────── quorum verification                    │
│  hooks/nf-circuit-breaker ── oscillation detection                  │
│  hooks/nf-session-start ──── state injection                        │
│                                                                      │
│  core/workflows/                                                     │
│    plan-phase.md ── step 4.5 ── design-impact.cjs                   │
│                    step 4.6 ── formal-scope-scan.cjs                │
│    quick.md ── step 2.7 ─── task-classifier.cjs                     │
│    debug.md ── step A.5 ──── formal model consultation               │
│    execute-phase.md ── plan execution subagents                      │
│                                                                      │
│  bin/ ── 100+ .cjs scripts (solve, quorum, formal, observe, etc.)   │
│  .planning/ ── STATE.md, ROADMAP.md, phases/, quick/, etc.          │
│  .formal/ ── model-registry.json, tla/, alloy/, prism/              │
│                                                                      │
│  commands/nf/ ── quorum.md, solve.md, debug.md, etc.               │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ NEW: context-packer.cjs (entry point)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  NEW REPOWISE INTELLIGENCE LAYER                     │
│                                                                      │
│  bin/repowise/                                                       │
│    context-packer.cjs ──── orchestration entry point                │
│    skeleton-view.cjs ──── Tree-Sitter AST → structural skeleton     │
│    hotspot-detector.cjs ── churn + complexity analysis               │
│    cochange-miner.cjs ──── git history → implicit coupling map      │
│    xml-packer.cjs ──────── pack contexts as structured XML          │
│                                                                      │
│  .planning/repowise/  (cache directory)                              │
│    skeleton-cache.json ── AST skeletons by file + git SHA            │
│    hotspot-cache.json ─── churn/complexity scores                   │
│    cochange-cache.json ── co-change graph data                      │
│                                                                      │
│  Grammar packages (optionalDependencies):                            │
│    tree-sitter-javascript  (JS/CJS/MJS)                             │
│    tree-sitter-typescript   (TS/TSX)                                │
│    tree-sitter-python      (PY)                                     │
│    tree-sitter-bash        (SH)                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | New/Modified |
|-----------|---------------|-------------------|--------------|
| `context-packer.cjs` | Orchestrates skeleton + hotspot + cochange → XML pack | Called by plan-phase, quick, debug, quorum worker | **NEW** |
| `skeleton-view.cjs` | Tree-Sitter AST → structural code skeleton | Called by context-packer; reads source files | **NEW** |
| `hotspot-detector.cjs` | Git churn + cyclomatic complexity → risk scores | Called by context-packer; reads git log + source | **NEW** |
| `cochange-miner.cjs` | Git history → file co-occurrence graph | Called by context-packer; reads git log | **NEW** |
| `xml-packer.cjs` | Assembles structured XML context from components | Called by context-packer | **NEW** |
| `plan-phase.md` | Research → Plan → Verify workflow | Calls context-packer at step 4.7 (new) | **MODIFIED** |
| `quick.md` | Ad-hoc task execution | Calls context-packer at step 2.8 (new) | **MODIFIED** |
| `debug.md` | Debug loop with quorum | Calls context-packer at step A.3 (new) | **MODIFIED** |
| `nf-prompt.js` | Quorum injection hook | Reads hotspot scores for risk_level fallback | **MODIFIED** |
| `context-retriever.cjs` | Domain-aware context fetcher | New domain: `repowise` | **MODIFIED** |
| `task-classifier.cjs` | Task complexity classifier | Reads hotspot scores for risk_level adjustment | **MODIFIED** |

### Data Flow

**Current flow (plan-phase):**
```
1. gsd-tools init → phase info
2. design-impact.cjs → L1/L2/L3 layer impact
3. formal-scope-scan.cjs → matching formal specs
4. [researcher subagent reads files directly — full file content]
5. [planner subagent reads files directly — full file content]
6. quorum dispatch → workers read files directly
```

**New flow (plan-phase with Repowise):**
```
1. gsd-tools init → phase info
2. design-impact.cjs → L1/L2/L3 layer impact
3. formal-scope-scan.cjs → matching formal specs
4. context-packer.cjs → XML-packed skeleton + hotspots + cochanges
   ├─ skeleton-view.cjs → structural skeletons (AST, not full source)
   ├─ hotspot-detector.cjs → churn × complexity risk scores
   └─ cochange-miner.cjs → implicit coupling map
5. [researcher subagent gets XML-packed context — skeleton views, not full files]
6. [researcher subagent can request specific full files for deep-dive]
7. [planner subagent gets same XML-packed context]
8. quorum dispatch → workers get skeleton context in review_context
```

**Key insight:** The XML-packed context replaces the current pattern of "read every relevant file in full." Researchers and planners first see skeleton views (structural outline, ~5-10% of original tokens). They can request full files for specific hotspots or areas they need to dive into. This is a **two-pass context loading** pattern — skeleton first, full source on demand.

## Patterns to Follow

### Pattern 1: Fail-Open Intelligence Injection (matches existing nForma philosophy)

**What:** Every Repowise component must fail open — if Tree-Sitter isn't installed, git history is shallow, or any computation fails, the workflow continues with empty/default context rather than blocking.

**When:** Every call site where Repowise data is consumed.

**Example:**
```javascript
// context-packer.cjs — entry point
function packContext(cwd, options = {}) {
  const skeleton = (() => {
    try { return require('./skeleton-view.cjs').generate(cwd, options); }
    catch (e) { process.stderr.write('[repowise] skeleton failed: ' + e.message + '\n'); return ''; }
  })();

  const hotspots = (() => {
    try { return require('./hotspot-detector.cjs').detect(cwd, options); }
    catch (e) { process.stderr.write('[repowise] hotspot failed: ' + e.message + '\n'); return []; }
  })();

  const cochanges = (() => {
    try { return require('./cochange-miner.cjs').mine(cwd, options); }
    catch (e) { process.stderr.write('[repowise] cochange failed: ' + e.message + '\n'); return []; }
  })();

  if (!skeleton && hotspots.length === 0 && cochanges.length === 0) {
    return ''; // Nothing to pack — caller proceeds without context
  }

  return require('./xml-packer.cjs').pack({ skeleton, hotspots, cochanges });
}
```

This matches the existing pattern in `design-impact.cjs` (fail-open on missing `.formal/`), `formal-scope-scan.cjs` (fail-open on missing specs), and `task-classifier.cjs` (fail-open to `moderate` complexity).

### Pattern 2: Cache-First with Git-SHA Invalidation

**What:** Repowise computations are expensive (AST parsing, git log mining). Cache results in `.planning/repowise/` keyed by file path + git SHA. Reuse across plan-phase, quick, debug, and quorum calls within the same session.

**When:** Every Repowise component that reads from disk or git.

**Example:**
```javascript
// skeleton-view.cjs — cache layer
function getSkeleton(filePath, gitSha, options) {
  const cacheKey = `${filePath}:${gitSha}`;
  const cacheDir = path.join(options.cwd || process.cwd(), '.planning', 'repowise');
  const cachePath = path.join(cacheDir, 'skeleton-cache.json');

  // Read cache
  try {
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cache[cacheKey] && cache[cacheKey].sha === gitSha) {
      return cache[cacheKey].skeleton;
    }
  } catch { /* cache miss — compute */ }

  // Compute
  const skeleton = computeSkeleton(filePath, options);

  // Write cache (best-effort)
  try {
    let cache = {};
    try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch {}
    cache[cacheKey] = { sha: gitSha, skeleton, computedAt: new Date().toISOString() };
    // Evict entries older than 7 days
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const k of Object.keys(cache)) {
      if (cache[k].computedAt && new Date(cache[k].computedAt).getTime() < weekAgo) {
        delete cache[k];
      }
    }
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
  } catch { /* non-fatal */ }

  return skeleton;
}
```

This matches the existing `.quorum-cache/` pattern (SHA-256 keyed, TTL-evicted) in `nf-prompt.js` and `quorum-cache.cjs`.

### Pattern 3: Two-Pass Context Loading (Skeleton First, Full Source on Demand)

**What:** Researchers and planners receive skeleton views initially (5-10% token cost). They can request specific full files for areas that need deep analysis. This is controlled via a `<files_to_read>` vs `<skeleton_only>` distinction in workflow prompts.

**When:** plan-phase researcher step, quick planner step, debug bundle assembly.

**Example workflow modification (plan-phase step 7 — researcher subagent):**
```
Current:
  Read all files referenced by <files_to_read> block

New:
  Phase 1: Read skeleton views from <skeleton_context> block (XML-packed)
  Phase 2: For files where deeper analysis is needed, request full content
  The <files_to_read> block now lists files available for Phase 2 deep-dive
```

### Pattern 4: XML-Style Context Packing

**What:** Structured XML format for context that is both machine-parseable and LLM-readable. Replaces ad-hoc `--- filepath ---` delimiters with semantic tags.

**When:** All context injection into subagents, quorum workers, and planner.

**Example:**
```xml
<repo_context project="nforma" branch="feature-issue-86" sha="abc1234">
  <skeleton_view file="hooks/nf-prompt.js" lang="javascript">
    <function name="isBreakerActive" line="436-448" complexity="2">
      Checks if circuit breaker is active for a given git root.
    </function>
    <function name="consumePendingTask" line="83-110" complexity="4">
      Atomically claims and reads a pending-task file.
    </function>
  </skeleton_view>

  <skeleton_view file="bin/task-classifier.cjs" lang="javascript">
    <function name="classifyTask" line="28-57" complexity="3">
      Classifies task envelope into complexity level.
    </function>
  </skeleton_view>

  <hotspots>
    <file path="hooks/nf-prompt.js" churn="12" complexity="high" risk="0.89">
      High churn (12 commits in 30 days) + high cyclomatic complexity
    </file>
    <file path="bin/solve-wave-dag.cjs" churn="8" complexity="medium" risk="0.65">
      Moderate churn with DAG dispatch logic
    </file>
  </hotspots>

  <cochanges>
    <group confidence="0.92">
      <file>hooks/nf-prompt.js</file>
      <file>hooks/nf-stop.js</file>
      <file>bin/quorum-cache.cjs</file>
    </group>
  </cochanges>
</repo_context>
```

This format is:
- **Parseable** by `context-packer.cjs` itself (for cache comparison)
- **Readable** by LLMs without additional instructions (self-documenting tags)
- **Token-efficient** — function signatures + docstrings instead of full bodies
- **Incrementally expandable** — a `<detail_request>` tag can request full source for specific functions

### Pattern 5: Hook-Level Risk Level Enrichment

**What:** The `nf-prompt.js` hook already injects `risk_level` from task-classifier. Repowise hotspots provide an additional signal: if the task touches hotspot files, risk_level escalates.

**When:** `nf-prompt.js` quorum dispatch (step 3 — risk-driven fan-out).

**Example modification to nf-prompt.js:**
```javascript
// After existing risk_level extraction from context_yaml:
let effectiveRiskLevel = riskLevelFromContext;

// Repowise hotspot enrichment (fail-open)
try {
  const hotspotPath = path.join(cwd, '.planning', 'repowise', 'hotspot-cache.json');
  if (fs.existsSync(hotspotPath)) {
    const hotspots = JSON.parse(fs.readFileSync(hotspotPath, 'utf8'));
    // If task touches any high-risk files, escalate risk
    const taskFiles = extractFileReferences(prompt); // from prompt text
    const maxRisk = Math.max(...taskFiles
      .map(f => hotspots[f]?.risk || 0), 0);
    if (maxRisk > 0.7 && effectiveRiskLevel !== 'high') {
      effectiveRiskLevel = 'high';
      process.stderr.write(`[nf-dispatch] RISK ESCALATION: hotspot risk ${maxRisk.toFixed(2)} → high\n`);
    } else if (maxRisk > 0.4 && effectiveRiskLevel === 'low') {
      effectiveRiskLevel = 'medium';
    }
  }
} catch { /* fail-open */ }
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Full-Source-First Context Loading

**What:** The current pattern where subagents read entire files first, then filter. With Repowise, this defeats the purpose — skeleton views should be the *first* thing agents see, with full source loaded only when needed.

**Why bad:** Reversing the order means skeleton views provide no token savings — agents already have full source in context.

**Instead:** Modify workflow prompts to show skeleton context in Phase 1, with `<files_to_read>` listed for Phase 2 deep-dive only. The `<skeleton_context>` block replaces the current "read all referenced files" pattern for initial research.

### Anti-Pattern 2: Synchronous Tree-Sitter in Hooks

**What:** Calling Tree-Sitter parsing inside `nf-prompt.js` or `nf-stop.js` hook handlers.

**Why bad:** Hook handlers must be fast (<100ms). Tree-Sitter native bindings + file I/O can take 50-500ms per file. Calling synchronously in a hook would block Claude Code's input pipeline.

**Instead:** Pre-compute and cache in `.planning/repowise/` during workflow steps (plan-phase, quick). Hooks only read the cache — never compute. The `context-packer.cjs` is called from workflows, not from hooks.

### Anti-Pattern 3: Coupling Repowise to Formal Verification

**What:** Trying to use Tree-Sitter AST output to auto-generate TLA+ specs or directly feed formal models.

**Why bad:** Repowise is a context optimization layer, not a formal verification input. AST skeletons inform humans and LLMs about code structure — they don't have the semantic information needed for formal spec generation. The existing `formal-scope-scan.cjs` + `xstate-to-tla.cjs` pipeline is the correct path for FV.

**Instead:** Keep Repowise and FV as parallel pipelines that both feed into plan-phase at different steps (4.5 = FV impact, 4.6 = FV scope, 4.7 = Repowise context). They're complementary, not coupled.

### Anti-Pattern 4: Bundling All Tree-Sitter Grammars as Required Dependencies

**What:** Adding `tree-sitter-javascript`, `tree-sitter-typescript`, `tree-sitter-python`, etc. as production dependencies.

**Why bad:** Each grammar package is 2-10MB of native binary. nForma installs into `~/.claude/` — we can't ship 50MB+ of grammar binaries for every user, especially when most users only work in 2-3 languages.

**Instead:** Use `optionalDependencies` for grammar packages. `skeleton-view.cjs` gracefully degrades when a language grammar isn't installed — it falls back to regex-based line-count + function-signature extraction (similar to what `design-impact.cjs` does today). The existing `@huggingface/transformers` is already an optional dependency in nForma — same pattern.

### Anti-Pattern 5: Modifying Quorum Protocol for Context Type

**What:** Adding a "context type" field to quorum dispatch that changes how workers process based on whether they received skeleton or full source.

**Why bad:** Quorum workers must be content-agnostic — they reason about whatever context they receive. Adding context-type awareness to the quorum protocol would couple the verification layer to the optimization layer, violating separation of concerns.

**Instead:** Quorum workers receive whatever context the orchestrator sends. If the orchestrator packs skeleton context, workers work with skeletons. If full source is needed for a specific decision, the orchestrator includes full source. Workers don't know or care about the format — they just reason about what they receive.

## Integration Points — Detailed

### 1. plan-phase.md — Step 4.7 (NEW)

**Current steps 4.5-4.6:** design-impact.cjs, formal-scope-scan.cjs

**New step 4.7:** After formal scope scan, before researcher spawn:
```bash
REPOWISE_CONTEXT=""
if command -v node >/dev/null 2>&1; then
  REPOWISE_CONTEXT=$(node ~/.claude/nf-bin/context-packer.cjs --project-root="$(pwd)" --format=xml --max-tokens=8000 2>/dev/null || echo "")
fi
```

The researcher subagent receives `$REPOWISE_CONTEXT` as initial context instead of reading all target files. The `<files_to_read>` block still lists files for Phase 2 deep-dive.

### 2. quick.md — Step 2.8 (NEW)

**Current step 2.7:** Task classification via `task-classifier.cjs`

**New step 2.8:** After classification, before planner spawn:
```bash
REPOWISE_CONTEXT=$(node ~/.claude/nf-bin/context-packer.cjs --project-root="$(pwd)" --format=xml --max-tokens=4000 2>/dev/null || echo "")
```

The planner subagent receives skeleton context first. This reduces the ~80k tokens that quick planners currently consume reading full files down to ~8-15k tokens for skeleton views.

### 3. debug.md — Step A.3 (NEW)

**Current step A.5:** Formal model consultation

**New step A.3 (before A.5):** After collecting failure context, before bundle assembly:
```bash
REPOWISE_CONTEXT=$(node ~/.claude/nf-bin/context-packer.cjs --project-root="$(pwd)" --format=xml --focus="$ARGUMENTS" --max-tokens=6000 2>/dev/null || echo "")
```

The `--focus` flag filters skeleton views to files mentioned in the failure context + their co-change partners. This gives quorum debug workers structural context about the failure area without loading entire files.

### 4. nf-prompt.js — Risk Level Enrichment (MODIFIED)

**Current:** Reads `risk_level` from context YAML and task envelope.

**New:** After extracting `riskLevelFromContext`, checks `.planning/repowise/hotspot-cache.json` for any file mentioned in the prompt. If a hotspot file is detected, escalates risk_level, which increases quorum fan-out count.

This is a minimal change — 10-15 lines of fail-open code after the existing `riskLevelFromContext` extraction.

### 5. context-retriever.cjs — New Domain (MODIFIED)

**Current:** Domains: `test`, `architecture`, `formal`

**New:** Add `repowise` domain:
```javascript
repowise: {
  files: ['.planning/repowise/hotspot-cache.json'],
  searchPatterns: [/\.xml$/],
  searchDirs: ['.planning/repowise/'],
  maxFilesToScan: 5,
},
```

And keyword mapping:
```javascript
repowise: ['hotspot', 'churn', 'cochange', 'skeleton', 'repowise', 'risk'],
```

### 6. task-classifier.cjs — Hotspot-Aware Risk (MODIFIED)

**Current:** Classifies based on objective text, file count, and envelope risk_level.

**New:** After classification, check hotspot cache. If the task touches high-churn or high-complexity files, adjust complexity upward (e.g., `simple` → `moderate` if touching a hotspot file). This is 5-8 lines of fail-open code.

### 7. quorum.md Worker Dispatch — review_context Enrichment (MODIFIED)

**Current:** Quorum workers receive `review_context` containing FV hypotheses, sensitivity context, and task envelope.

**New:** If available, `review_context` includes a `<repo_context>` XML block with skeleton views of relevant files and hotspot indicators. Workers can reason about code structure without reading full files — reducing per-worker token consumption from 22-25k to 15-18k.

## Scalability Considerations

| Concern | At 100 files | At 10K files | At 100K files (monorepo) |
|---------|-------------|--------------|--------------------------|
| Skeleton generation | <1s (parallelizable) | ~10s (cached by SHA) | ~2min initial; incremental via `tree.edit()` |
| Hotspot detection | <0.5s (git log is fast) | ~3s (git log depth-limited) | ~15s (needs `--max-count` limit) |
| Co-change mining | <1s (small git history) | ~5s (pairwise comparison) | ~30s (needs sampling + threshold) |
| Cache size | ~50KB | ~2MB | ~20MB (7-day eviction keeps it bounded) |
| Token savings | 30-40% (small codebase) | 60-70% (many files irrelevant) | 80-90% (most files not in scope) |

**Critical scaling constraint:** Co-change mining is O(N²) in file count for naive pairwise comparison. At 10K+ files, must use sampling (top-K by churn) + minimum co-occurrence threshold (default: 3 shared commits). The `--max-files` flag (default: 500) limits the file universe.

## Suggested Build Order

The build order respects dependency chains and delivers incremental value:

### Phase 1: XML Context Packer + Infrastructure (zero new deps)
**Why first:** XML packing is pure string formatting — no Tree-Sitter, no git mining. It establishes the output format that all other components feed into. Can be tested immediately with hand-crafted skeleton data.

**Components:**
- `xml-packer.cjs` — XML formatting engine
- `context-packer.cjs` — orchestration entry point (initially returns empty context)
- `.planning/repowise/` cache directory structure
- Integration into `plan-phase.md` step 4.7 (fail-open, returns empty)
- Integration into `context-retriever.cjs` repowise domain

**Value delivered:** Integration skeleton is wired. Workflows call context-packer at the right time. XML format is established and can be reviewed.

### Phase 2: Hotspot Detection (git-log only, no Tree-Sitter)
**Why second:** Hotspot detection uses only `git log` — already available in nForma's environment (circuit-breaker already calls git). No new dependencies. Delivers immediate value for risk escalation in nf-prompt.js.

**Components:**
- `hotspot-detector.cjs` — churn computation + complexity estimation (line-count based initially)
- Cache layer in `.planning/repowise/hotspot-cache.json`
- Integration into `nf-prompt.js` for risk_level escalation
- Integration into `task-classifier.cjs` for hotspot-aware complexity

**Value delivered:** High-churn files automatically escalate quorum fan-out. Task classifier knows about code risk. This is useful even without skeleton views.

### Phase 3: Co-Change Prediction (git-log only, no Tree-Sitter)
**Why third:** Co-change mining also uses only git history. No new dependencies. Delivers value for debug bundles (automatically include co-change partners) and for researcher context (implicitly coupled files are included).

**Components:**
- `cochange-miner.cjs` — git log → file co-occurrence pairs
- Cache layer in `.planning/repowise/cochange-cache.json`
- Integration into `debug.md` bundle assembly (include co-change partners)
- Integration into `context-packer.cjs` cochange section

**Value delivered:** Debug workers automatically receive context about files that change together with the failing file. Researchers see implicit coupling that they'd otherwise miss.

### Phase 4: Skeleton Views via Tree-Sitter (new dependency)
**Why last:** Tree-Sitter introduces a native dependency (N-API binary). This is the most complex integration and the most likely to cause install issues. Deferring it to last means Phases 1-3 deliver value independently, and Tree-Sitter can be an optional enhancement.

**Components:**
- `tree-sitter` + `tree-sitter-javascript` as optionalDependencies
- `skeleton-view.cjs` — AST → structural skeleton (with regex fallback)
- Cache layer in `.planning/repowise/skeleton-cache.json`
- Integration into `context-packer.cjs` skeleton section
- Two-pass context loading modification to plan-phase, quick, debug workflows

**Value delivered:** 60-80% token reduction for initial research. Researchers see code structure without reading full files. The biggest token savings come last but build on the infrastructure from Phases 1-3.

## Data Formats

### Hotspot Cache Schema (`.planning/repowise/hotspot-cache.json`)
```json
{
  "_meta": { "generated_at": "2026-04-11T...", "git_sha": "abc1234", "depth_days": 30 },
  "files": {
    "hooks/nf-prompt.js": {
      "churn": 12,
      "complexity_lines": 986,
      "risk_score": 0.89,
      "last_modified": "2026-04-10T..."
    }
  }
}
```

### Co-Change Cache Schema (`.planning/repowise/cochange-cache.json`)
```json
{
  "_meta": { "generated_at": "2026-04-11T...", "git_sha": "abc1234", "depth_commits": 200 },
  "pairs": [
    {
      "files": ["hooks/nf-prompt.js", "hooks/nf-stop.js"],
      "co_occurrences": 15,
      "confidence": 0.92,
      "avg_commits_apart": 1.2
    }
  ]
}
```

### Skeleton Cache Schema (`.planning/repowise/skeleton-cache.json`)
```json
{
  "hooks/nf-prompt.js:abc1234": {
    "sha": "abc1234",
    "lang": "javascript",
    "skeleton": "<skeleton_view>...</skeleton_view>",
    "computed_at": "2026-04-11T..."
  }
}
```

## Sources

- Tree-Sitter Node.js bindings: https://tree-sitter.github.io/node-tree-sitter/ (v0.25.1, official docs) — **HIGH confidence**
- Tree-Sitter grammar list: https://github.com/tree-sitter/tree-sitter/wiki/List-of-Parsers — **HIGH confidence**
- nForma architecture: direct codebase analysis (hooks, workflows, bin scripts) — **HIGH confidence**
- Context packing patterns: Repowise project concepts from PROJECT.md — **HIGH confidence** (well-specified)
- Hotspot detection algorithms: git-log based churn + line-count complexity (standard approach) — **HIGH confidence**
- Co-change mining: standard git-log co-occurrence analysis — **MEDIUM confidence** (approach is standard; scaling to monorepos needs validation)
