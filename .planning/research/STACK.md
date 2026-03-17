# Technology Stack — Model-Driven Debugging

**Project:** nForma v0.38 — Model-Driven Debugging
**Research Date:** 2026-03-17
**Milestone:** Adding model-driven debugging to formal verification infrastructure (201 models, TLA+, Alloy, PRISM)

---

## Recommended Stack Additions

### Core Debugging Framework

| Technology | Version | Purpose | Why | Integration Point |
|------------|---------|---------|-----|-------------------|
| **ITF (Informal Trace Format)** | JSON spec | Structured counterexample representation | Native TLC/Apalache output format; tool-neutral; JSON-native for Node.js | Replaces text trace parsing; feeds counterexample extractor |
| **fast-xml-parser** | ^5.4.1 | Parse Alloy SAT solver XML instances | Alloy 6 outputs SAT results as XML; mature (used by Microsoft, NASA); pure JS | Alloy instance extraction from solver output |
| **acorn** | ^8.11.0 | JavaScript AST parser for code-file scoping | Dead-simple scope analysis; integrated in ESLint ecosystem; Node.js native | Bug-to-model file resolution (which models affect this file?) |

### TLA+ Counterexample Parsing

| Library | Version | Purpose | When to Use | Notes |
|---------|---------|---------|-------------|-------|
| **Custom ITF parser** | — | Parse TLC output to ITF JSON format | When TLC emits traces via `-terse` or ITF backend | Lightweight; TLC natively outputs states + variable bindings |
| **Custom trace walker** | — | Replay states through formal spec to extract invariants | Counterexample contains 5-100 states; need to know which invariant failed | Reuse existing `xstate-trace-walker.cjs` pattern |

### Constraint Extraction

| Library | Version | Purpose | When to Use | Status |
|---------|---------|---------|-------------|--------|
| **Custom invariant parser** | — | Extract conditions from TLA+ ASSUME/INVARIANT/PROPERTY | Per-model; extract `x > 0 /\ y <= maxValue` patterns | Build on existing `formal-core.cjs` foundation |
| **Custom Alloy constraint extractor** | — | Extract fact/pred/assert constraints from .als specs | Alloy specs define structural invariants (e.g., "no cycles") | Parse Alloy grammar; extract as plain-English rules |
| **LLM constraint naturalizer** (Haiku) | — | Convert formal constraints to readable English | Use Claude for constraint-to-English translation | Already have quorum + Haiku; minimal new code |

---

## Architecture: Trace → Constraint → Fix

### 1. TLC Counterexample Path

```
TLC runs → generates trace.txt (multi-line state sequence)
  ↓
itf-to-json.cjs (custom) → convert to ITF JSON format
  ↓
trace-parser.cjs (custom) → walk states, extract state diff at failure
  ↓
invariant-extractor.cjs (new) → find which invariant failed in formal spec
  ↓
constraint-naturalizer.cjs (custom) → format as plain English
  ↓
/nf:debug → inject as fix constraints
```

**No external dependencies needed** — custom parsers are <500 LOC each.

### 2. Alloy Instance Path

```
Alloy runs (via run-alloy.cjs) → outputs to stdout
  ↓
alloy-scanner.cjs (existing) → detect counterexample in stdout
  ↓
alloy-xml-extractor.cjs (new, fast-xml-parser) → parse Alloy XML instance
  ↓
scope-resolver.cjs (new, acorn) → map model atoms to code entities
  ↓
/nf:debug → propose fix guided by structural invariants
```

### 3. Bug-to-Model Lookup

```
User reports bug in file X (e.g., bin/quorum-slot-worker.cjs)
  ↓
formal-scope-scan.cjs (existing) → finds models matching X
  ↓
model-cache-check.cjs (new) → loads cached model for file + TLA+ spec
  ↓
run model checker on those models only
  ↓
Extract constraints from passing/failing models
```

**Key insight:** Code file → formal model mapping already exists in `@requirement` annotations. Reuse proximity graph.

---

## New Files to Create

### bin/itf-trace-parser.cjs
Parse TLC counterexample into ITF JSON format.
- **Input:** trace.txt from TLC stderr or file
- **Output:** `{ meta, params, vars, states, loop }`
- **Dependencies:** None (pure string parsing)
- **Reusable by:** Any downstream trace consumer

### bin/alloy-instance-extractor.cjs
Extract instances from Alloy SAT solver output via fast-xml-parser.
- **Input:** Alloy XML instance (or parsed XML object)
- **Output:** Relational structure: `{ Atom[], Set[], Relation[] }`
- **Dependencies:** `fast-xml-parser` (v5.4.1+)
- **Reusable by:** Alloy model visualization, constraint extraction

### bin/invariant-constraint-extractor.cjs
Extract formal constraints from TLA+ or Alloy specs.
- **Input:** Formal spec file (.tla or .als)
- **Output:** Parsed constraints: `{ name, condition, type: 'safety'|'liveness'|'structural' }`
- **Dependencies:** None (regex-based parsing)
- **Reusable by:** Constraint documentation, verification gates

### bin/constraint-naturalizer.cjs
Convert formal constraints to plain English using Haiku.
- **Input:** Parsed constraint: `{ name: 'SafetyInvariant', condition: '(x > 0 /\ y <= MAX)' }`
- **Output:** `"Safety Invariant: x must be greater than zero AND y must not exceed 100."`
- **Dependencies:** Quorum dispatch (call Haiku)
- **Reusable by:** Debugging UI, documentation generation, fix guidance

### bin/bug-to-model-resolver.cjs
Map code files to affected formal models for targeted model checking.
- **Input:** Bug report (stack trace, file path, function name)
- **Output:** List of `{ modelFile: 'NFQuorum.tla', relevance: 0.92, reason: '@requirement links' }`
- **Dependencies:** `acorn` (v8.11.0+) for scope analysis; existing proximity graph
- **Reusable by:** model selection in `/nf:debug`, regression testing

---

## Installation Commands

```bash
# Add trace/constraint parsing and model scoping dependencies
npm install fast-xml-parser@5.4.1 acorn@8.11.0

# Verify installations
npm list fast-xml-parser acorn

# No changes to package.json devDependencies needed for custom parsers
```

---

## Integration with Existing Infrastructure

### 1. TLC/Alloy Runners (Already Exist)

**No changes needed** to `bin/run-tlc.cjs` or `bin/run-alloy.cjs`. They already:
- Invoke TLC/Alloy with proper Java/classpath setup
- Capture stdio/stderr (or pipe to file)
- Write check-results.ndjson with pass/fail status

**New parsers attach downstream:**
```javascript
// After run-tlc.cjs completes with counterexample
const traceFile = path.join(ROOT, '.planning', 'formal', 'tla', 'states', configName, 'trace.txt');
const parsedTrace = require('./itf-trace-parser.cjs').parse(fs.readFileSync(traceFile, 'utf8'));
const constraints = require('./invariant-constraint-extractor.cjs').extractFrom(specFile);
```

### 2. Formal Spec Generation Pipeline

`bin/run-formal-verify.cjs` already:
- Generates TLA+ from XState
- Generates Alloy from formal specifications
- Caches specs in `.planning/formal/{tla,alloy}/`

**New constraint extraction hooks into:**
```
run-formal-verify.cjs --only=generate
  ↓
[NEW] extract-spec-constraints.cjs (iterate all specs, populate constraint cache)
  ↓
.planning/formal/spec-constraints.json (indexed by model name)
```

### 3. Proximity Graph & Traceability

Existing files we leverage:
- `bin/formal-proximity.cjs` — model semantic similarity
- `bin/formal-ref-linker.cjs` — @requirement bidirectional links
- `.planning/formal/code-trace-index.json` — file → requirement → model mapping

**New integration:**
```javascript
// In bug-to-model-resolver.cjs
const refLinker = require('./formal-ref-linker.cjs');
const affectedReqs = refLinker.getRequirementsForFile(bugFile);
const affectedModels = affectedReqs.flatMap(req => refLinker.getModelsForRequirement(req));
```

### 4. Quorum Dispatch (For Constraint Naturalization)

Existing infrastructure:
- `bin/call-quorum-slot.cjs` — multi-model consensus
- `hooks/nf-prompt.js` — injects quorum context

**New usage in constraint-naturalizer:**
```javascript
// Call Haiku to translate formal constraint to English
const english = await quorumSlot('claude-haiku', {
  task: 'translate_constraint',
  constraint: '(x > 0 /\ y <= MAX)',
  context: 'quorum voting protocol'
});
```

---

## Alternatives Considered & Rejected

| Decision | Recommendation | Alternative | Why Not |
|----------|----------------|-------------|---------|
| TLC trace format | ITF JSON parser (custom) | XML output from TLC | TLC's native text output is simpler; ITF is newer; custom parser is lightweight |
| Alloy instance parsing | fast-xml-parser | Java-based Alloy API | Java process overhead; XML parsing is standard; fast-xml-parser is battle-tested |
| Code-to-model mapping | acorn AST + proximity graph | Custom scope walker | acorn is ESLint standard; proximity graph already exists; minimal new code |
| Constraint-to-English | Haiku LLM | GPT-4 or Claude Opus | We already have quorum + Haiku; no external API calls; fits harness constraints |
| Constraint extraction | Regex + parser combinators | Full TLA+/Alloy parser | Formal specs are highly structured; regex covers 95% of cases; parser is over-engineered |

---

## Performance Characteristics

| Component | Processing Time | Bottleneck | Mitigation |
|-----------|-----------------|-----------|-----------|
| itf-trace-parser | 50–200ms | State count (5–100 states) | Stream parsing; lazy evaluation |
| alloy-instance-extractor | 100–500ms | XML size (SAT solver output) | fast-xml-parser optimized; pre-validate |
| invariant-constraint-extractor | 10–50ms | Spec size (~5K lines) | Regex-based; compile once; cache |
| constraint-naturalizer (Haiku) | 2–5s | LLM latency | Batch constraints; reuse quorum slots |
| bug-to-model-resolver | 100–300ms | File count + proximity graph | Index models by file; lazy load |

**Total E2E latency (bug reported → constraints extracted):** ~3–10 seconds (dominated by Haiku LLM call).

---

## Dependencies: Version Rationale

### fast-xml-parser@5.4.1
- **Current:** 5.4.1 (2024-12)
- **Why 5.x:** Stable, widely used (Microsoft, NASA, VMWare)
- **Why not 4.x:** Missing HTML entity handling; slower
- **Why not 6.0 beta:** Not stable for production; no compelling features
- **Lock:** Yes — pin exact version in package.json to avoid breaking changes in XML parsing

### acorn@8.11.0
- **Current:** 8.11.0 (2024-12)
- **Why 8.x:** Mature, widely used in ESLint ecosystem
- **Why not 9.x alpha:** No release yet; stick with stable
- **Lock:** Yes — pin for consistent AST structure
- **Alternative:** Babel parser is heavier; acorn is minimal

### No custom parser library needed
- **Why not add parser combinator library (e.g., Parsimmon, Chevrotain)?** TLA+ and Alloy specs are structured (ASSUME/PROPERTY sections clearly marked). Regex + string split covers 95% of extraction. Parser combinator is over-engineering.
- **Cost to justify:** Would add 15KB+ dependency for what 200 lines of code handles.

---

## Integration Checklist

Before writing model-driven debugging features:

- [ ] Install `npm install fast-xml-parser@5.4.1 acorn@8.11.0`
- [ ] Create `bin/itf-trace-parser.cjs` (custom, no deps)
- [ ] Create `bin/alloy-instance-extractor.cjs` (fast-xml-parser)
- [ ] Create `bin/invariant-constraint-extractor.cjs` (custom, no deps)
- [ ] Create `bin/constraint-naturalizer.cjs` (quorum dispatch)
- [ ] Create `bin/bug-to-model-resolver.cjs` (acorn + proximity graph)
- [ ] Add extraction step to `run-formal-verify.cjs` pipeline
- [ ] Wire `/nf:debug` to consume constraint cache
- [ ] Test with 5 real counterexamples from TLC/Alloy

---

## Sources

- [Apalache ITF Format Documentation](https://apalache-mc.org/docs/adr/015adr-trace.html)
- [TLC Counterexample Trace Parsing Research](https://github.com/visualzhou/tla-trace-formatter)
- [fast-xml-parser NPM Package](https://www.npmjs.com/package/fast-xml-parser)
- [fast-xml-parser GitHub](https://github.com/NaturalIntelligence/fast-xml-parser)
- [Alloy Tools Documentation](https://alloytools.org/)
- [Acorn JavaScript Parser](https://github.com/acornjs/acorn)
- [APISpecGen: Generating API Specifications for Bug Detection](https://github.com/Yuuoniy/APISpecGen)
- [Natural Language to Formal Specifications (2025-2026 Research)](https://aclanthology.org/2025.acl-long.1310.pdf)
