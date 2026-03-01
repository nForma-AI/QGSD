# Architecture: Requirements Envelope Integration (ENV-01..05)

**Project:** QGSD v0.22 Requirements Envelope
**Researched:** 2026-03-01
**Confidence:** HIGH
**Focus:** How requirements envelope features integrate with existing QGSD formal verification architecture

---

## Executive Summary

The requirements envelope (ENV-01..05) adds a new canonical artifact (`formal/requirements.json`) to QGSD's formal verification system. It integrates at four critical touchpoints:

1. **Data generation** (ENV-01): `new-milestone` → `formal/requirements.json` aggregation
2. **Validation gate** (ENV-02): Haiku pre-freeze review for duplicates/conflicts
3. **Spec constraint binding** (ENV-03): `generate-phase-spec.cjs` reads envelope as PROPERTY source
4. **Immutability + drift** (ENV-04, ENV-05): Hook-based protection + drift checking

This architecture preserves existing data flow (`.planning/REQUIREMENTS.md` → phases → specs) while adding a formal validation layer that becomes the correctness envelope for all downstream verification.

---

## Current QGSD Architecture (Baseline)

### Existing Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Workflows                                │
│  /qgsd:new-project  /qgsd:new-milestone  /qgsd:plan-phase       │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌─────────────────┴────────────────────────────────────────────────┐
│                  Planning + Research Layer                       │
│  .planning/REQUIREMENTS.md → ROADMAP.md → CONTEXT.md            │
│  .planning/phases/*/PLAN.md → task-envelope.json                │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌─────────────────┴────────────────────────────────────────────────┐
│              Formal Verification Layer                           │
│  formal/model-registry.json (central artifact index)            │
│  formal/tla/ (TLA+ specs)                                        │
│  formal/alloy/ (Alloy models)                                    │
│  formal/prism/ (Probabilistic models)                            │
│  bin/run-formal-verify.cjs (orchestrator)                        │
│  bin/generate-phase-spec.cjs (phase → PROPERTY)                 │
│  bin/promote-model.cjs (plan → formal)                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌─────────────────┴────────────────────────────────────────────────┐
│              Execution + Feedback Layer                          │
│  hooks/qgsd-prompt.js (quorum injection)                         │
│  hooks/qgsd-stop.js (quorum validation)                          │
│  hooks/qgsd-spec-regen.js (XState → spec regeneration)          │
└─────────────────────────────────────────────────────────────────┘
```

### Existing Data Artifacts

| Artifact | Owner | Created By | Purpose |
|----------|-------|-----------|---------|
| `.planning/REQUIREMENTS.md` | User (working copy) | `/qgsd:new-milestone` discovery | Phase requirements reference document |
| `.planning/phases/*/task-envelope.json` | Planning system | `/qgsd:plan-phase` | Execution context + must_haves truths |
| `formal/model-registry.json` | Formal verification | v0.21 (ARCH-01) | Central registry of all living models + versions |
| `formal/tla/QGSDQuorum.tla` | Formal verification | `xstate-to-tla.cjs` | XState machine → TLA+ spec |
| `formal/tla/scratch/<phase>.tla` | Planning system | `generate-phase-spec.cjs` | Phase truths → TLA+ PROPERTY stubs |

---

## Proposed: Requirements Envelope Layer

### New Artifact: `formal/requirements.json`

**Location:** `formal/requirements.json` (owned by formal verification, not planning)
**Lifecycle:** Write-once after validation, read-many for spec generation + drift checking
**Ownership:** Formal verification system (immutable after frozen_at is set)

```json
{
  "version": "1.0",
  "frozen_at": "2026-03-01T18:00:00Z",
  "milestone": "v0.22",
  "source_document": ".planning/REQUIREMENTS.md",
  "validation": {
    "model": "claude-haiku-4-5",
    "passed_at": "2026-03-01T17:55:00Z",
    "issues_resolved": 3
  },
  "requirements": [
    {
      "id": "ENV-01",
      "category": "Requirements Envelope",
      "text": "Requirements are aggregated into `formal/requirements.json` during `new-milestone`...",
      "phase": "v0.22-00-envelope",
      "status": "active",
      "provenance": {
        "source_file": ".planning/REQUIREMENTS.md",
        "source_line": 65
      }
    },
    {
      "id": "ENV-02",
      "category": "Requirements Envelope",
      "text": "A Haiku validation pass detects duplicates and conflicts...",
      "phase": "v0.22-00-envelope",
      "status": "active",
      "provenance": {
        "source_file": ".planning/REQUIREMENTS.md",
        "source_line": 66
      }
    }
  ]
}
```

### Integration with Existing Formal Infrastructure

```
┌──────────────────────────────────────────────────────────────────┐
│          REQUIREMENTS ENVELOPE LAYER (NEW — v0.22)               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  formal/requirements.json ← (frozen after ENV-02, immutable)    │
│         ↓                                                        │
│  [generate-phase-spec] reads envelope as PROPERTY source        │
│  [run-formal-verify] includes ENV requirements in TLC checks    │
│  [drift-detector] compares .planning/REQUIREMENTS.md drift      │
│  [amend-requirements] modifies via amendment workflow           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
         ↑ (aggregated from)
┌──────────────────────────────────────────────────────────────────┐
│         PLANNING LAYER (EXISTING, SEMANTIC SHIFT ONLY)           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  .planning/REQUIREMENTS.md ← (working copy, mutable)            │
│  .planning/phases/*/task-envelope.json                          │
│  .planning/phases/*/PLAN.md (must_haves.truths)                │
│                                                                  │
│  Semantic shift: no longer "source of truth" — now              │
│  "source document" with drift detection vs frozen envelope      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
         ↓ (feeds via phase plans)
┌──────────────────────────────────────────────────────────────────┐
│          FORMAL VERIFICATION LAYER (ENHANCED BY ENV)             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  formal/tla/QGSDQuorum.tla (XState → machine spec)             │
│  formal/tla/scratch/<phase>.tla (phase truths + ENVELOPE       │
│                                   PROPERTYs)                   │
│  formal/alloy/*.als (composition, account-pool, etc.)          │
│  formal/prism/*.pm (MCP availability, quorum probability)      │
│                                                                  │
│  [run-formal-verify.cjs] now:                                  │
│    1. Validates requirements envelope (ENV-02)                 │
│    2. Runs TLC with ENVELOPE PROPERTY checks                   │
│    3. Reports formal violations separately                     │
│                                                                  │
│  [generate-phase-spec.cjs] now:                                │
│    - Reads formal/requirements.json (frozen envelope)          │
│    - Reads phase task-envelope.json (truths)                  │
│    - Merges: envelope PROPERTYs take precedence               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## New Components (ENV-01..05)

### 1. `bin/aggregate-requirements.cjs` (ENV-01)

**Responsibility:** Compile `.planning/REQUIREMENTS.md` → `formal/requirements.json` (unvalidated)

**Inputs:**
- `.planning/REQUIREMENTS.md` (working document with YAML frontmatter + requirement blocks)
- `.planning/ROADMAP.md` (phase definitions + ordering)

**Algorithm:**
1. Parse YAML frontmatter: version, defined date, core value
2. Extract requirement blocks (ARCH-01, ARCH-02, ..., ENV-05)
3. Parse each: id, category, text, phase assignment, status
4. Record provenance: source file + line number
5. Validate: no duplicate IDs, all phase assignments exist in ROADMAP
6. Output: `formal/requirements.json` with `frozen_at: null` (not yet validated)

**Exit codes:**
- 0: JSON written successfully
- 1: Parse error (malformed YAML) or validation error (duplicate IDs, undefined phases)

**Error output:** Structured report to stdout with line numbers + suggestions

**Called by:** Planner agent in `/qgsd:new-milestone` step 4 (after roadmap creation)

---

### 2. `bin/validate-requirements-haiku.cjs` (ENV-02)

**Responsibility:** Invoke Haiku validation gate, present results, freeze envelope if approved

**Inputs:**
- `formal/requirements.json` (aggregated, `frozen_at: null`)

**Algorithm:**
1. Read requirements JSON
2. Generate Haiku prompt:
   - Present all requirements as structured list (id, category, text, phase)
   - Request: JSON response with `{ issues: [...], summary: string, ready: boolean }`
   - Issues structure: `{ type: "duplicate"|"contradiction"|"ambiguity", ids: [string], description: string, resolution: string }`
3. Invoke Task with `subagent_type="qgsd-haiku-validator"`
4. Parse response for issues
5. If no issues: update `validation.passed_at`, set `frozen_at = now()`, write to disk, exit 0
6. If issues found: present to user via AskUserQuestion
   - "Issues detected. Accept / Resolve manually / Abort?"
   - If user accepts: set `frozen_at = now()`, exit 0
   - If user aborts: exit 1 (envelope stays unvalidated)

**Exit codes:**
- 0: Envelope validated and frozen (frozen_at is now set)
- 1: Validation failed or user rejected

**Haiku prompt data contract:**
```
Input to Haiku:
{
  "requirements": [{ "id": "ENV-01", "category": "...", "text": "...", "phase": "..." }],
  "instruction": "Detect semantic duplicates (same intent, different IDs), contradictions (requirements that cannot both be satisfied), and ambiguity (multiple interpretations). Return JSON with { issues: [...], summary: string, ready: boolean }"
}

Response from Haiku (expected):
{
  "issues": [
    { "type": "duplicate", "ids": ["ENV-01", "SPEC-04"], "description": "...", "resolution": "..." }
  ],
  "summary": "Found 3 issues: 1 duplicate, 1 contradiction, 1 ambiguity",
  "ready": false
}
```

**Called by:** Planner agent in `/qgsd:new-milestone` step 4.5 (immediately after aggregation)

---

### 3. `bin/detect-requirements-drift.cjs` (ENV-05)

**Responsibility:** Compare `.planning/REQUIREMENTS.md` vs `formal/requirements.json`, warn if diverged

**Inputs:**
- `.planning/REQUIREMENTS.md` (current working copy)
- `formal/requirements.json` (frozen envelope)

**Algorithm:**
1. Parse both documents for requirement blocks (id, text)
2. Compute diff: IDs in working copy vs IDs in envelope
3. Classify each mismatch:
   - **Missing from envelope:** ID in working copy but not in envelope (user added during execution)
   - **Deleted from working:** ID in envelope but not in working copy (user removed)
   - **Text changed:** ID in both but text differs by > 10% (semantic change)
   - **Minor text change:** ID in both but text differs by < 10% (formatting, grammar)
4. Write `formal/drift-report.md`:
   - Summary: N deletions, M additions, K modifications
   - Detail table: ID, type, old text (first 50 chars), new text (first 50 chars)
   - Guidance: "Use amendment workflow (ENV-04) to modify the frozen envelope"

**Exit codes:**
- 0 always (never blocks workflows)
- Output: silence if no drift, drift-report.md if drift detected

**Called by:**
- `hooks/qgsd-prompt.js` UserPromptSubmit hook on every `/qgsd:*` planning command
- Explicitly callable: `node bin/detect-requirements-drift.cjs --check` (exit 0 if clean, exit 1 if drift)

---

### 4. `bin/amend-requirements.cjs` (ENV-04)

**Responsibility:** Formal workflow to modify frozen envelope: approve amendments → re-validate → re-freeze

**Inputs:**
- Current `formal/requirements.json` (frozen)
- Amendments: new REQ IDs, deleted IDs, modified text

**Algorithm:**
1. Accept amendment input (JSON via stdin or interactive prompts)
2. Create temporary `formal/requirements.json.pending`
3. Apply amendments (add/delete/modify in .pending copy)
4. Invoke `validate-requirements-haiku.cjs` on .pending copy
5. If validation passes:
   - Move `.pending` → live
   - Update `validation.passed_at` and `frozen_at` to now
   - Exit 0 (envelope updated)
6. If validation fails:
   - Present issues to user
   - Offer: accept issues, retry amendments, abort
   - Exit 1 if user aborts (no changes written)

**Exit codes:**
- 0: Envelope updated, frozen_at refreshed
- 1: Validation failed, user aborted, no changes

**Called by:**
- Interactive user: `node bin/amend-requirements.cjs` (prompts for amendments)
- Programmatic: `node bin/amend-requirements.cjs --add REQ-XX --del REQ-YY --modify REQ-ZZ` (flags)

---

### 5. `bin/extract-requirements-properties.cjs` (ENV-03)

**Responsibility:** Transform envelope requirements → TLA+ PROPERTY statements for phase specs

**Inputs:**
- `formal/requirements.json` (frozen)
- Phase number (from context or CLI arg)

**Algorithm:**
1. Filter requirements by phase assignment
2. For each requirement:
   - Convert text to TLA+ LTL formula template
   - Category mapping:
     - "Requirements Envelope" → `<> (envelope_{id} = TRUE)`
     - "Formal Constraint" → custom LTL based on text
     - Other → assume liveness: `<> (envelope_{id} = TRUE)`
   - Generate comment: `\* ENV-{id}: {text}`
3. Return: array of `{ id: "ENV-XX", property: "...", comment: "..." }`

**Output format** (used by generate-phase-spec.cjs):
```javascript
[
  { id: "ENV-01", property: "<> (envelope_01 = TRUE)", comment: "Requirements aggregated..." },
  { id: "ENV-02", property: "<> (envelope_02 = TRUE)", comment: "Haiku validation..." }
]
```

**Exit codes:**
- 0: Properties extracted, JSON printed to stdout
- 1: Parse error or invalid phase

**Called by:** `generate-phase-spec.cjs` (see modification below)

---

## Modified Existing Components

### 1. `bin/generate-phase-spec.cjs` (MODIFIED — ENV-03)

**Change:** Read frozen envelope, extract envelope-constrained PROPERTYs

**Before (current):**
```javascript
// Extract truths from phase *-PLAN.md frontmatter
const truths = parsePlanFrontmatter(planContent);
// Generate PROPERTY statements from truths
const properties = truths.map(t => `PROPERTY: ${t}`);
// Output: formal/tla/scratch/<phase>.tla
```

**After (proposed):**
```javascript
// (1) Read frozen requirements envelope (if exists)
let envelopeRequirements = [];
const envPath = path.join(ROOT, 'formal', 'requirements.json');
if (fs.existsSync(envPath)) {
  try {
    const envelope = JSON.parse(fs.readFileSync(envPath, 'utf8'));
    if (envelope.frozen_at) {
      // Envelope is validated and frozen
      envelopeRequirements = filterRequirementsByPhase(envelope.requirements, phaseNumber);
    } else {
      // Envelope exists but not validated — warn but continue
      console.warn('[generate-phase-spec] WARNING: envelope exists but frozen_at is null (not validated)');
    }
  } catch (err) {
    console.warn(`[generate-phase-spec] WARNING: failed to read envelope: ${err.message}`);
  }
}

// (2) Convert envelope requirements to TLA+ PROPERTY templates
const envelopeProperties = envelopeRequirements.map(req => ({
  id: `ENV-${req.id}`,
  property: `<> (envelope_${req.id} = TRUE)`,
  text: req.text,
  isEnvelopeConstraint: true
}));

// (3) Extract phase-specific truths from task-envelope.json (unchanged)
const truths = parseTaskEnvelopeTruths(taskEnvelopeContent);
const phaseProperties = truths.map(t => ({
  id: null,
  property: `<> (${t})`,
  text: t,
  isEnvelopeConstraint: false
}));

// (4) Merge: envelope properties are formal constraints, appear first
const allProperties = [
  ...envelopeProperties,  // Formal envelope constraints
  ...phaseProperties       // Phase-specific truths
];

// (5) Inject into scratch spec with markers
const specContent = generateTLASpec({
  envelope_properties: envelopeProperties,
  phase_properties: phaseProperties,
  all_properties: allProperties
});
```

**Error handling:**
- If envelope missing: continue gracefully (backward compatible)
- If envelope.frozen_at is null: warn but continue (envelope not yet validated)
- If envelope requirements conflict with phase truths: error with suggestion to amend

**Integration point:** Called as step in `plan-phase.md` (existing location, no workflow change)

---

### 2. `hooks/qgsd-prompt.js` (MODIFIED — ENV-05)

**Change:** Add drift detection before quorum injection

**New logic** (early in UserPromptSubmit handler, after circuit breaker checks):
```javascript
// Drift detection (ENV-05)
if (isGSDPlanningCommand(prompt)) {
  const driftCheckResult = spawnSync('node', [
    path.join(cwd, 'bin', 'detect-requirements-drift.cjs'),
    '--check'
  ]);

  if (driftCheckResult.status !== 0 || fs.existsSync(path.join(cwd, 'formal', 'drift-report.md'))) {
    // Drift detected
    const driftReport = readFileSync(path.join(cwd, 'formal', 'drift-report.md'), 'utf8');
    const driftWarning = `
[⚠️  REQUIREMENTS DRIFT DETECTED]

Working copy (.planning/REQUIREMENTS.md) diverges from frozen envelope (formal/requirements.json).

${driftReport}

To update the frozen envelope formally, use:
  /qgsd:amend-requirements

Proceed with planning. Drift will be tracked in formal/drift-report.md.
`;
    hookSpecificOutput.additionalContext = driftWarning + (existingContext || '');
  }
}
```

**Behavior:**
- Drift report injected into Claude's context WITHOUT blocking
- User informed but workflow continues (non-blocking warning)
- Reinforces: "Working copy diverged, update envelope if intentional via amendment workflow"

---

### 3. `hooks/qgsd-stop.js` (MODIFIED — ENV-04)

**Change:** Add immutability enforcement for `formal/requirements.json`

**New logic** (in transcript scan section, after quorum evidence check):
```javascript
// Immutability enforcement (ENV-04)
if (hasDirectFileModification(transcript, 'formal/requirements.json')) {
  // Check if user explicitly approved amendment via quorum or formal workflow
  const hasAmendmentApproval = transcript.includes('<!-- AMENDMENT_APPROVED -->')
    || transcript.includes('amend-requirements');

  if (!hasAmendmentApproval) {
    decision = 'BLOCK';
    blockReasons.push(
      'formal/requirements.json cannot be modified without explicit amendment approval. ' +
      'Run `/qgsd:amend-requirements` to update the frozen envelope.'
    );
  }
}
```

**Behavior:**
- Prevents accidental direct edits to `formal/requirements.json`
- Routes modifications through formal amendment workflow (`amend-requirements.cjs`)
- Comment marker `<!-- AMENDMENT_APPROVED -->` acts as user consent signal

---

### 4. `bin/run-formal-verify.cjs` (MODIFIED — ENV-02 + ENV-03)

**Change 1 (ENV-02):** Add envelope validation step early in verification pipeline

```javascript
// Add to STEPS array (before TLA+ generation):
{
  tool: 'envelope', id: 'envelope:validate',
  label: 'Validate requirements envelope (Haiku: detect duplicates/conflicts)',
  type: 'node', script: 'validate-requirements-haiku.cjs',
  args: [],
  optional: true,  // Fail-open: envelope validation is optional for existing projects
}
```

**Change 2 (ENV-03):** After TLC runs, analyze envelope PROPERTY results separately

```javascript
// In post-processing after all TLA+ steps:
const envPropertyResults = check_results
  .filter(r => r.property && r.property.startsWith('ENV-'))
  .map(r => ({
    id: r.property,
    status: r.status,
    detail: r.counterexample || r.message
  }));

// Print envelope results in summary:
if (envPropertyResults.length > 0) {
  console.log('\n═══ ENVELOPE PROPERTY RESULTS ═══');
  envPropertyResults.forEach(r => {
    console.log(`${r.id}: ${r.status}`);
    if (r.detail) console.log(`  → ${r.detail}`);
  });
}
```

---

### 5. `.planning/REQUIREMENTS.md` (UNCHANGED in structure, semantic shift only)

**No content changes required**, but documentation should clarify:

Add to top of file (after title):
```markdown
> **Note:** This is the working copy of requirements.
> The formal envelope is `formal/requirements.json` (frozen after v0.22 validation).
> Working copy changes are tracked via drift detection (see `formal/drift-report.md`).
> To modify the formal envelope, use `/qgsd:amend-requirements` (amendment workflow).
```

---

## Data Flow Patterns

### ENV-01: Aggregation Flow

```
.planning/REQUIREMENTS.md (user document)
         ↓
      [parse YAML frontmatter + requirement blocks]
         ↓
[aggregate-requirements.cjs invoked by planner]
         ↓
formal/requirements.json (unvalidated, frozen_at = null)
         ↓
ready for validation gate (ENV-02)
```

**Timing:** `/qgsd:new-milestone` step 4, after roadmap creation
**Trigger:** Automatic (planner agent)
**Recovery:** Re-run `aggregate-requirements.cjs` after fixing REQUIREMENTS.md

---

### ENV-02: Validation Gate Flow

```
formal/requirements.json (unvalidated)
         ↓
[validate-requirements-haiku.cjs spawned by planner]
         ├→ invoke Task(subagent_type="qgsd-haiku-validator")
         ├→ receive response: { issues: [...], ready: boolean }
         └→ if issues found: present to user via AskUserQuestion
         ↓
User decision: accept / resolve manually / abort
         ├→ accept: update validation.passed_at, frozen_at = now()
         └→ abort: exit 1 (envelope stays unvalidated, user re-edits REQUIREMENTS.md)
         ↓
formal/requirements.json (validated + frozen, frozen_at timestamp set)
```

**Timing:** `/qgsd:new-milestone` step 4.5, immediately after aggregation
**Trigger:** Automatic (waits for validation)
**User interaction:** AskUserQuestion if issues found; automatic if clean

---

### ENV-03: Spec Constraint Binding Flow

```
formal/requirements.json (frozen, frozen_at set)
         ↓
[During plan-phase formal verification — step 8.2]
         ├→ extract-requirements-properties.cjs filters by phase
         ├→ converts envelope requirements to TLA+ PROPERTY templates
         └→ merges with phase truths (from task-envelope.json)
         ↓
formal/tla/scratch/<phase>.tla (now includes ENV-* PROPERTY statements)
         ↓
[run-formal-verify.cjs] runs TLC
         ├→ verifies PROPERTY statements
         └→ ENV properties are formal constraints (failures block approval)
         ↓
check-results.ndjson (includes ENV-* pass/fail results)
```

**Timing:** `plan-phase.md` step 8.2 (formal verification gate)
**Trigger:** Formal verification orchestrator
**Failure mode:** TLC failure on ENV property → quorum sees formal violation evidence

---

### ENV-04: Immutability Contract Flow

```
User attempts: direct edit to formal/requirements.json
         ↓
[qgsd-stop.js] detects Write to frozen envelope during transcript scan
         ├→ check: was edit approved by amendment workflow?
         └→ if no: BLOCK decision
         ↓
Claude sees: BLOCK message, directed to /qgsd:amend-requirements
         ↓
User runs: /qgsd:amend-requirements (or batch script)
         ↓
[amend-requirements.cjs]
         ├→ read amendments input
         ├→ apply to .pending copy
         ├→ invoke validate-requirements-haiku.cjs (ENV-02)
         └→ if validation passes: move .pending → live, frozen_at refreshed
         ↓
formal/requirements.json (updated + re-validated)
```

**Timing:** Anytime user attempts direct modification
**Trigger:** Stop hook immutability check
**User consent:** Amendment workflow interaction

---

### ENV-05: Drift Detection Flow

```
[User modifies .planning/REQUIREMENTS.md during phase execution]
         ↓
[Next /qgsd:* command invoked (e.g., plan-phase)]
         ↓
[qgsd-prompt.js] UserPromptSubmit hook (early stage)
         ├→ call detect-requirements-drift.cjs
         ├→ parse diff: working vs frozen envelope
         └→ classify: missing/deleted/modified requirements
         ↓
formal/drift-report.md (generated with diff table + guidance)
         ↓
[qgsd-prompt.js] injects drift report into additionalContext
         ↓
Claude sees: "[⚠️  REQUIREMENTS DRIFT DETECTED]" warning + report in context
```

**Timing:** On every `/qgsd:*` planning command
**Trigger:** Hook, automatic
**User action:** Review drift report, decide to amend or leave as-is

---

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   /qgsd:new-milestone                        │
│                  (Planner Agent)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 4: Roadmap created                                    │
│    ↓                                                         │
│  [aggregate-requirements.cjs]                               │
│    → formal/requirements.json (unvalidated)                 │
│    ↓                                                         │
│  Step 4.5: Validation gate                                  │
│    ↓                                                         │
│  [validate-requirements-haiku.cjs]                          │
│    → Task(qgsd-haiku-validator) → Haiku API                │
│    ↓                                                         │
│  If issues: AskUserQuestion                                 │
│    ↓                                                         │
│  formal/requirements.json (validated + frozen)              │
│    → (ready for phase planning)                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│                  /qgsd:plan-phase {N}                        │
│                  (Planner Agent)                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 8.2: Formal verification                              │
│    ↓                                                         │
│  [generate-phase-spec.cjs] (MODIFIED)                       │
│    ├→ reads formal/requirements.json (frozen)               │
│    ├→ filter by phase number                                │
│    ├→ [extract-requirements-properties.cjs]                 │
│    │   → convert to TLA+ PROPERTY statements                │
│    ├→ merge with phase truths (from task-envelope.json)     │
│    └→ formal/tla/scratch/<phase>.tla (incl. ENV-* props)    │
│    ↓                                                         │
│  [run-formal-verify.cjs]                                    │
│    ├→ run TLC on phase spec (ENV properties included)       │
│    └→ check-results.ndjson                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────────┐
│              During Phase Execution                          │
│              (/qgsd:execute-phase, etc.)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [qgsd-prompt.js] UserPromptSubmit hook                      │
│    ├→ [detect-requirements-drift.cjs] runs                  │
│    ├→ if drift found: formal/drift-report.md generated      │
│    └→ drift report injected into context                    │
│    ↓                                                         │
│  User sees: drift warning in prompt context                 │
│    ↓                                                         │
│  If user decides to amend:                                  │
│    → /qgsd:amend-requirements invoked                       │
│    → [amend-requirements.cjs]                               │
│    → [validate-requirements-haiku.cjs] (re-validate)        │
│    → formal/requirements.json (updated, re-frozen)          │
│                                                              │
│  [qgsd-stop.js] transcript scan                             │
│    ├→ check for direct modifications to envelope            │
│    └→ if unapproved: BLOCK response                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Build Order & Dependencies

### Phase Dependency Graph

```
ENV-01 (aggregate)
   ↓ (input → output)
ENV-02 (validate) ← must run after ENV-01
   ├→ unblocks envelope freezing
   └→ enables ENV-03
   ↓
ENV-03 (bind specs) ← depends on frozen_at being set
   ├→ modifies generate-phase-spec.cjs
   ├→ reads frozen envelope
   └→ enables formal verification to constrain by envelope
   ↓
ENV-04 (immutability) ← can run in parallel with ENV-03
   ├→ modifies qgsd-stop.js
   ├→ protects frozen envelope
   └→ enables amendment workflow
   ↓
ENV-05 (drift) ← depends on frozen envelope existing
   ├→ modifies qgsd-prompt.js
   ├→ warns user of working copy divergence
   └→ points to amendment workflow
```

### Recommended Sequential Build

**Phase 1: Foundation (ENV-01 + ENV-02) — Week 1**

- [ ] Create `bin/aggregate-requirements.cjs`
  - Parse REQUIREMENTS.md frontmatter
  - Extract requirement blocks
  - Output JSON with `frozen_at: null`
  - Exit 0 on success, 1 on error

- [ ] Create `bin/validate-requirements-haiku.cjs`
  - Read aggregated JSON
  - Invoke Haiku validator via Task()
  - Present issues to user (AskUserQuestion)
  - Update `frozen_at` if approved
  - Exit 0 (frozen) or 1 (aborted)

- [ ] Create `qgsd-haiku-validator.md` agent role
  - Role: lightweight validation reviewer
  - Input: requirements array
  - Output: JSON with issues + summary

- [ ] Test roundtrip: `.planning/REQUIREMENTS.md` → aggregation → validation → frozen envelope

**Phase 2: Spec Integration (ENV-03) — Week 2**

- [ ] Create `bin/extract-requirements-properties.cjs`
  - Filter requirements by phase
  - Convert to TLA+ PROPERTY templates
  - Output JSON with property + comment

- [ ] Modify `bin/generate-phase-spec.cjs`
  - Add envelope reading (graceful fallback if missing)
  - Check `frozen_at` before using (warn if null)
  - Merge envelope + phase properties
  - Inject into scratch spec with ENV-* markers

- [ ] Test: plan-phase generates scratch spec with envelope constraints

**Phase 3: Enforcement (ENV-04 + ENV-05) — Week 3**

- [ ] Create `bin/detect-requirements-drift.cjs`
  - Parse both documents
  - Diff: working vs envelope
  - Generate drift-report.md
  - Exit 0 always (non-blocking)

- [ ] Create `bin/amend-requirements.cjs`
  - Accept amendments (input parsing)
  - Apply to .pending copy
  - Invoke validation (ENV-02)
  - Move .pending → live if approved

- [ ] Modify `hooks/qgsd-stop.js`
  - Detect direct modifications to envelope
  - Check for amendment approval
  - BLOCK if unapproved

- [ ] Modify `hooks/qgsd-prompt.js`
  - Call drift detector
  - Inject drift report if found

- [ ] Test: amendment workflow, immutability enforcement, drift warnings

**Phase 4: Integration Testing — Week 4**

- [ ] Full roundtrip: new-milestone → env validation → plan-phase with envelope → formal verify
- [ ] Test amendment scenario: user amends REQUIREMENTS.md → drift warning → amendment workflow
- [ ] Test immutability: attempt to edit envelope directly → BLOCK
- [ ] Verify TLC failures correctly attributed to envelope constraint violations
- [ ] Load test: drift detection performance at 10K requirements

---

## Known Constraints & Mitigations

### Constraint 1: Haiku Availability During Validation

**Problem:** Haiku might timeout or be unavailable during ENV-02 validation gate.

**Mitigation:**
- `validate-requirements-haiku.cjs` times out after 30 seconds
- If timeout: allow user choice:
  - Accept envelope as-is (frozen_at = now() anyway)
  - Skip validation (frozen_at = null, envelope unvalidated)
  - Retry when Haiku available
- Drift detection still works even if envelope unvalidated

---

### Constraint 2: False Positive Drift from Minor Edits

**Problem:** Single-word typo fixes, capitalization changes trigger drift warnings.

**Mitigation:**
- Drift detector uses semantic similarity (not exact text match)
- Text change threshold: > 20% difference = semantic drift
- Single-word edits (< 5% change) don't trigger amendment workflow

---

### Constraint 3: Envelope Cannot Capture Context-Dependent Requirements

**Problem:** Some requirements depend on execution state (e.g., "must support 1000 concurrent users" depends on measured load).

**Mitigation:**
- Envelope focuses on structural constraints (what to prove)
- Context (performance targets, scalability bounds) stays in REQUIREMENTS.md working copy
- TLA+ properties are correctness constraints, not performance bounds
- Use PRISM for probabilistic constraints on availability/reliability

---

### Constraint 4: Backward Compatibility with Projects Without Envelope

**Problem:** Existing projects run without formal/requirements.json; new code must not break them.

**Mitigation:**
- All ENV-01..05 features are optional (graceful fallback)
- `generate-phase-spec.cjs` continues if envelope missing
- `run-formal-verify.cjs` validation step marked as `optional: true`
- Drift detector silent if envelope doesn't exist

---

## Integration Checklist

### Pre-Implementation

- [ ] Review existing REQUIREMENTS.md format (any special structure to preserve?)
- [ ] Identify which phases have existing task-envelope.json (PLAN-01)
- [ ] Confirm Haiku slot worker exists and is callable

### Implementation Milestone

- [ ] ENV-01: aggregate-requirements.cjs works end-to-end
- [ ] ENV-02: validate-requirements-haiku.cjs passes validation cycle
- [ ] ENV-03: generate-phase-spec.cjs reads envelope + merges properties
- [ ] ENV-04: qgsd-stop.js blocks direct envelope edits, amend-requirements works
- [ ] ENV-05: qgsd-prompt.js injects drift warnings, detect-requirements-drift.cjs runs

### Testing

- [ ] Unit: each script works in isolation
- [ ] Integration: new-milestone → plan-phase → formal-verify roundtrip
- [ ] Amendment: modify working copy → drift warning → amendment → re-frozen
- [ ] Immutability: direct edit attempt → BLOCK
- [ ] Backward compat: existing projects without envelope still work

### Documentation

- [ ] Update REQUIREMENTS.md top-of-file note about envelope
- [ ] Document `/qgsd:amend-requirements` workflow in commands/qgsd/
- [ ] Add drift-report.md format description to design docs

---

## Files to Create/Modify Summary

### New Files

| File | ENV | Purpose |
|------|-----|---------|
| `bin/aggregate-requirements.cjs` | ENV-01 | Compile REQUIREMENTS.md → JSON |
| `bin/validate-requirements-haiku.cjs` | ENV-02 | Haiku validation gate |
| `bin/detect-requirements-drift.cjs` | ENV-05 | Working copy drift detection |
| `bin/amend-requirements.cjs` | ENV-04 | Amendment workflow |
| `bin/extract-requirements-properties.cjs` | ENV-03 | Envelope → TLA+ properties |
| `agents/qgsd-haiku-validator.md` | ENV-02 | Haiku validator agent role |

### Modified Files

| File | ENV | Change |
|------|-----|--------|
| `bin/generate-phase-spec.cjs` | ENV-03 | Read envelope + merge properties |
| `bin/run-formal-verify.cjs` | ENV-02, ENV-03 | Add envelope validation step, analyze ENV results |
| `hooks/qgsd-prompt.js` | ENV-05 | Add drift detection + injection |
| `hooks/qgsd-stop.js` | ENV-04 | Add immutability enforcement |
| `.planning/REQUIREMENTS.md` | ENV-01..05 | Add note about envelope at top |

### No Changes Required

- `formal/model-registry.json` — structure already supports all update_source types
- `plan-phase.md` workflow — envelope generation is automatic in planner
- `.planning/phases/*/task-envelope.json` — unchanged, read alongside envelope

---

## Success Criteria

**ENV-01 Success:** `.planning/REQUIREMENTS.md` → `formal/requirements.json` without manual intervention

**ENV-02 Success:** Haiku validates envelope before freezing; issues presented to user for resolution

**ENV-03 Success:** Phase specs include ENV-* PROPERTY statements; TLC verifies them

**ENV-04 Success:** Direct edits to envelope blocked by Stop hook; amendment workflow works

**ENV-05 Success:** Working copy divergence detected; drift report injected into Claude context

**Overall:** Requirements envelope is the formal correctness boundary for all downstream verification

---

## Sources

**QGSD Project Documentation:**
- `/Users/jonathanborduas/code/QGSD/.planning/PROJECT.md` — v0.22 requirements overview
- `/Users/jonathanborduas/code/QGSD/.planning/REQUIREMENTS.md` — detailed ENV-01..05 specs

**Formal Verification:**
- `/Users/jonathanborduas/code/QGSD/formal/model-registry.json` — central artifact index
- `/Users/jonathanborduas/code/QGSD/bin/run-formal-verify.cjs` — 30-step orchestrator
- `/Users/jonathanborduas/code/QGSD/bin/generate-phase-spec.cjs` — truths → properties

**Hook System:**
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-prompt.js` — UserPromptSubmit hook
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-stop.js` — quorum validation + transcript scan
- `/Users/jonathanborduas/code/QGSD/hooks/qgsd-spec-regen.js` — PostToolUse regeneration

**Phase Planning:**
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/plan-phase.md` — phase planning workflow
- `/Users/jonathanborduas/code/QGSD/qgsd-core/workflows/new-milestone.md` — milestone creation

**Existing Architecture Research:**
- `/Users/jonathanborduas/code/QGSD/.planning/research/SUMMARY.md` — v0.21 summary
- `/Users/jonathanborduas/code/QGSD/.planning/research/ARCHITECTURE.md` — v0.18 token efficiency arch

---

**Researched:** 2026-03-01
**Architecture confidence:** HIGH (existing formal system well-documented, new components follow established patterns, all integration points identified)
