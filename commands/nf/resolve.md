---
name: nf:resolve
description: Guided triage wizard — walk through solve items one-by-one with enriched context, brainstorm ambiguous cases, and take action
argument-hint: "[--source solve|pairings|orphans (restrict to one class)] [--category dtoc|ctor|ttor|dtor] [--verdict genuine|review|unclassified] [--limit N] [--auto-confirm-yes] [--auto-reject-no]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Edit
  - AskUserQuestion
  - Agent
---

<objective>
Walk the user through unresolved solve items one at a time with enriched context.
For each item: present evidence, assess confidence, then either recommend an action (for obvious cases) or ask targeted questions (for ambiguous cases). Take the agreed action before moving to the next item.

This is a CONVERSATIONAL skill — the user drives decisions, you provide analysis. Never take action without explicit user confirmation.

Output: Each resolved item gets one of: FP acknowledgment, archive, TODO creation, requirement creation, or skip.
</objective>

<execution_context>
CRITICAL SHELL ESCAPING RULE: Node.js v25+ mangles `!` in `node -e` strings (both single and double quotes).
ALWAYS write JavaScript to a temp file and run it with `node /private/tmp/<name>.cjs`. NEVER use `node -e` for anything with `!` or complex logic.

CRITICAL INTERACTIVITY RULE: This skill is CONVERSATIONAL. After presenting each item with its evidence and recommendation/questions, you MUST use the AskUserQuestion tool to pause and wait for the user's response. Do NOT present multiple items in a single turn. The flow is:
1. Present ONE item (or a batch of identical-pattern items) with evidence
2. Call AskUserQuestion to get user's decision
3. Execute the chosen action
4. Present the NEXT item
5. Repeat

When batching similar items, still use AskUserQuestion to confirm the batch action.
</execution_context>

<process>

## Step 1: Load data and parse arguments

Write this to /private/tmp/nf-resolve-load.cjs and run it:
```javascript
const st = require("<PROJECT_ROOT>/bin/solve-tui.cjs");
const path = require('path');
const fs = require('fs');
const data = st.loadSweepData();
const cache = st.readClassificationCache();
const archive = st.readArchiveFile();
const summary = {};
for (const catKey of ["dtoc", "ctor", "ttor", "dtor"]) {
  const cat = data[catKey];
  if (!cat || !cat.items) { summary[catKey] = { total: 0 }; continue; }
  const items = cat.items.filter(i => !st.isArchived(i));
  const classified = items.map(i => {
    const k = st.itemKey(catKey, i);
    return { ...i, verdict: (cache[catKey] || {})[k] || "unclassified" };
  });
  summary[catKey] = {
    total: items.length,
    genuine: classified.filter(i => i.verdict === "genuine").length,
    review: classified.filter(i => i.verdict === "review").length,
    fp: classified.filter(i => i.verdict === "fp").length,
    unclassified: classified.filter(i => i.verdict === "unclassified").length,
  };
}

// Load pairings if file exists
const PAIRINGS_PATH = path.join(process.cwd(), '.planning', 'formal', 'candidate-pairings.json');
let pairingSummary = { total: 0, pending: 0, confirmed: 0, rejected: 0, byVerdict: {} };
if (fs.existsSync(PAIRINGS_PATH)) {
  const pd = JSON.parse(fs.readFileSync(PAIRINGS_PATH, 'utf8'));
  const pending = pd.pairings.filter(p => p.status === 'pending');
  const byVerdict = { yes: 0, no: 0, maybe: 0 };
  for (const p of pending) byVerdict[p.verdict || 'maybe']++;
  pairingSummary = { total: pd.pairings.length, pending: pending.length,
    confirmed: pd.metadata.confirmed, rejected: pd.metadata.rejected, byVerdict };
}

// Load orphans from candidates.json if file exists
const CANDIDATES_PATH = path.join(process.cwd(), '.planning', 'formal', 'candidates.json');
let orphanSummary = { models: 0, requirements: 0 };
if (fs.existsSync(CANDIDATES_PATH)) {
  const cd = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'));
  if (cd.orphans) {
    orphanSummary = {
      models: (cd.orphans.models || []).length,
      requirements: (cd.orphans.requirements || []).length,
    };
  }
}

console.log(JSON.stringify({ summary, archived: archive.entries.length, pairings: pairingSummary, orphans: orphanSummary }));
```

Parse `$ARGUMENTS` for:
- `--source <source>` → restrict to one class of issue only (solve|pairings|orphans). Without this flag, ALL classes are processed: solve items, pairings, and orphans.
- `--category <catKey>` → restrict to one solve category only (dtoc|ctor|ttor|dtor). Without this flag, all categories are processed in priority order: dtoc → dtor → ctor → ttor.
- `--verdict <verdict>` → restrict to items with this Haiku classification only (genuine|review|unclassified). Without this flag, process in order: genuine → review → unclassified; skip fp.
- `--limit <N>` → max items to process (default: 10)
- `--auto-confirm-yes` → batch-confirm all yes-verdict pairings
- `--auto-reject-no` → batch-reject all no-verdict pairings

Display overview showing all sections. If `--source` restricts to one class, show only that section:

**Solve section:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► RESOLVE: N items + P pairings to triage
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 -- Solve Items --
 D→C Broken Claims:   X genuine, Y review, Z unclassified
 C→R Untraced:        ...
 T→R Orphan Tests:    ...
 D→R Unbacked Claims: ...

 -- Proximity Pairings --
 Pending:  P (X yes, Y maybe, Z no)
 Resolved: Q confirmed, R rejected

 -- Orphans (no graph coverage) --
 Models:       X (need requirement annotations)
 Requirements: Y (need new formal models)
```

If `--source` restricts to one class, only show that section.

## Step 1b: Batch mode (if --auto-confirm-yes or --auto-reject-no)

If `--auto-confirm-yes` or `--auto-reject-no` flags are present AND source includes pairings:
- Shell out: `node bin/resolve-pairings.cjs --auto-confirm-yes` (or `--auto-reject-no`)
- Display result counts from output
- Track pairings confirmed/rejected in session counters
- If solve items remain, continue to interactive loop (Step 3)
- If only pairings were processed, skip to Step 4 (session summary)

## Step 2: Build prioritized queue

Write to /private/tmp/nf-resolve-queue.cjs and run it. This script should:
1. Load sweep data, classifications, candidate-pairings.json, and candidates.json (orphans)
2. Filter out archived and FP items
3. If `--source` is specified, include only that class. Otherwise include all three classes.
4. **Solve items** (unless `--source` excludes them):
   - Sort: genuine → review → unclassified, then by category: dtoc → dtor → ctor → ttor
   - For each item, gather evidence:
     - **dtoc**: check if file exists (normalize .formal/ → .planning/formal/), find similar files, check for generator scripts, read full claim context
     - **ctor**: check if infrastructure/utility, check for test file, read purpose from comments
     - **ttor**: check if source module exists, read test describes
     - **dtor**: extract action verbs, search requirements.json for keyword matches
5. **Pairings** (unless `--source` excludes them):
   - Load candidate-pairings.json, filter to pending status
   - Convert to queue items with `_source: 'pairing'`, include model, requirement, proximity_score, verdict, confidence, reasoning
   - Sort within pairings: yes → maybe → no, by proximity_score desc within each verdict group
6. **Orphans** (unless `--source` excludes them):
   - Load candidates.json, read orphans.models[] and orphans.requirements[]
   - Convert orphan models to queue items with `_source: 'orphan_model'`, include path, zeroPairCount
   - Convert orphan requirements to queue items with `_source: 'orphan_requirement'`, include id, zeroPairCount
   - Sort by zeroPairCount descending (most isolated first)
   - For each orphan model: read the model file, extract its `module` description if available
   - For each orphan requirement: look up the requirement text from requirements.json
7. Output JSON array of enriched items (capped at --limit)

Apply `--category` and `--verdict` filters if specified. Take up to `--limit` items. Order: solve items first, pairings second, orphans last.

## Step 3: Present items one at a time (interactive loop)

**CRITICAL: Present ONE item (or one batch of same-pattern items), then call AskUserQuestion to get the user's decision. Do NOT present all items at once.**

### Batching identical patterns

Before presenting item-by-item, scan the queue for groups of 3+ items sharing the same pattern (e.g., all reference ".formal/X" where ".planning/formal/X" exists). Present these as a batch with a single confirmation.

### For each item (or batch):

#### Step 3a: Display the evidence

**For solve items**, present using this format:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Item N/Total — <Category Label>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Haiku:     [verdict badge]
 Type/File: [key identifier]
 Reason:    [why it was flagged]

── Evidence ──────────────────────────────────────────
 [✓/✗/○ checks with explanations]

── Full Claim / Context ──────────────────────────────
 [word-wrapped claim text or file purpose]
```

**For proximity pairings**, present using this format:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Item N/Total — Proximity Pairing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Model:       [item.model basename]
 Requirement: [item.requirement] — "[requirement description from requirements.json]"
 Proximity:   [item.proximity_score]  |  Verdict: [item.verdict]
 Confidence:  [item.confidence]%
 Reasoning:   [item.reasoning]

── Recommendation ──────────────────────────────────
 Haiku says [VERDICT] with proximity [SCORE]
 → [Confirm if yes+high score / Review if maybe / Likely reject if no]

   [c] Confirm  [n] Reject  [s] Skip  [q] Quorum  [r] Revision  [x] Exit
```

**For orphan models** (when `item._source === 'orphan_model'`), present using this format:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Item N/Total — Orphan Model
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Model:        [item.path basename]
 Full Path:    [item.path]
 Zero Pairs:   [item.zeroPairCount] (requirements with no graph path to this model)
 Linked Reqs:  0

── Context ──────────────────────────────────────────
 [First 10-15 lines of the model file, or "File not readable"]

── Recommendation ──────────────────────────────────
 This model has no linked requirements. It either:
 (a) covers requirements that haven't been annotated yet, or
 (b) is an unused/obsolete model that can be archived.

   [w] Write requirement annotation  [a] Archive  [s] Skip  [q] Quorum  [r] Revision  [x] Exit
```

**For orphan requirements** (when `item._source === 'orphan_requirement'`), present using this format:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Item N/Total — Orphan Requirement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Requirement:  [item.id] — "[requirement text from requirements.json]"
 Category:     [requirement category]
 Zero Pairs:   [item.zeroPairCount] (models with no graph path to this requirement)
 Formal Models: [] (none)

── Recommendation ──────────────────────────────────
 This requirement has no formal model coverage. It either:
 (a) needs a new Alloy/TLA+/PRISM model to be created, or
 (b) is covered by existing models that aren't properly linked.

   [m] Create formal model (TODO)  [l] Link to existing model  [s] Skip  [q] Quorum  [r] Revision  [x] Exit
```

#### Step 3b: Assess confidence

**HIGH confidence — present recommendation:**
- File doesn't exist AND generator script also missing → "Feature likely removed → FP?"
- File doesn't exist BUT generator exists → "Run the generator → TODO?"
- File path alias (.formal/ → .planning/formal/) and file EXISTS → "Path alias FP"
- Package is an English word with no npm match → "Misidentified word → FP?"
- Infrastructure/utility file untraced → "Infrastructure doesn't need tracing → FP?"
- Claim matches existing requirements (2+ keywords) → "Already covered → FP?"

Append recommendation. **When the recommended action is "Requirement"**, you MUST also form your own opinion on what the requirement text should say — don't just echo the mechanical default from `proposeRequirementText`. Read the file/claim context, understand what it actually does, and draft a meaningful description. Show both the default and your recommended text:
```
── Recommendation ────────────────────────────────────
 [Assessment with reasoning]

 → [Recommended action]?

── Proposed Requirement Text ─────────────────────────
 Default:     "[mechanical text from proposeRequirementText]"
 Recommended: "[your opinionated, descriptive text based on evidence]"

   [y] Yes (use recommended)  [d] Use default  [e] Edit  [a] Archive  [f] FP  [s] Skip
   [q] Quorum  [r] Revision  [x] Exit
```

For batches of requirements, show a numbered table with both default and recommended texts for every item. The user can approve all, edit by number, or override individually.

**LOW confidence — ask probing questions:**
- File doesn't exist, no generator, but similar files exist → "Did this move?"
- Package not installed but real npm name → "Removed dependency or missing install?"
- Feature module untraced → "User-facing or internal plumbing?"
- Claim with action verbs, no requirement match → "Real promise or just description?"

Append questions:
```
── Questions ─────────────────────────────────────────
 [Numbered probing questions with trade-offs]

 What do you think? (describe your reasoning, or pick:
 [t]odo / [a]rchive / [f]p / [w]rite req / [s]kip / [q]uorum / [r]evision / e[x]it)
```

#### Step 3c: WAIT FOR USER INPUT

**Use AskUserQuestion tool** with the action choices as the question. This is what makes the skill interactive — without this, it just dumps everything and exits.

#### Step 3d: Process the response

- Action keys: `y`, `d`, `e`, `f`, `a`, `s`, `t`, `w`, `c`, `n` — execute corresponding action (Step 3e)
- `q`: trigger quorum review (Step 3f)
- `r`: trigger revision / deeper solo review (Step 3g)
- `x`: jump to Step 4 (session summary)
- Free text: the user is reasoning through the item. Engage with their analysis, provide additional context if helpful, then re-present the action choices and AskUserQuestion again

#### Step 3e: Execute the chosen action

**For solve items**, write action scripts to /private/tmp/nf-resolve-action.cjs:

- **TODO**: `st.createTodoFromItem(item)` → confirm TODO ID
- **FP**: `st.acknowledgeItem(item)` → confirm suppression
- **Archive**: `st.archiveItem(item)` → confirm archival
- **Write Requirement (w)**: First show proposed text using `st.proposeRequirementText(item, catKey)`. Display it clearly so the user can review/edit. If the user provides custom text, pass it as the third argument: `st.createRequirementFromItem(item, catKey, customText)`. If the user approves the default, call `st.createRequirementFromItem(item, catKey)`. For batches, show ALL proposed texts in a numbered list before confirming, and let the user edit individual entries by number.

**For proximity pairings** (when `item._source === 'pairing'`), write action scripts to /private/tmp/nf-resolve-action.cjs:

- **Confirm (c)**: Load bin/resolve-pairings.cjs, call `confirmPairing(pairing)` with model, requirement, and current pairing object. Load candidate-pairings.json, find matching pairing, update status to 'confirmed', write file back. Also update model-registry.json if confirmPairing exports indicate registry updates.
- **Reject (n)**: Load bin/resolve-pairings.cjs, call `rejectPairing(pairing)`. Load candidate-pairings.json, find matching pairing, update status to 'rejected', write file back.
- **Skip (s)**: No-op, continue to next item.
- **Exit (x)**: Jump to Step 4 (session summary).

**For orphan models** (when `item._source === 'orphan_model'`):

- **Write requirement annotation (w)**: Search requirements.json for requirements whose text matches the model's domain. Present top 3 candidate requirements to link. If user selects one, update model-registry.json to add that requirement to the model's requirements array.
- **Archive (a)**: Note the model as "no coverage needed" — add to acknowledged-false-positives.json with reason "orphan_model_archived".
- **Skip (s)**: No-op, continue to next item.
- **Exit (x)**: Jump to Step 4 (session summary).

**For orphan requirements** (when `item._source === 'orphan_requirement'`):

- **Create formal model TODO (m)**: Create a TODO item noting that a new formal model needs to be created for this requirement. Use `st.createTodoFromItem()` with a synthetic item.
- **Link to existing model (l)**: Search model-registry.json for models whose domain overlaps with the requirement. Present top 3 candidate models. If user selects one, update model-registry.json to add the requirement to that model's requirements array.
- **Skip (s)**: No-op, continue to next item.
- **Exit (x)**: Jump to Step 4 (session summary).

Display one-line confirmation, then loop to next item.

#### Step 3f: Quorum review (q)

When the user picks `q`, dispatch the current item to the quorum for multi-model consensus:

1. Format a quorum prompt summarizing the item:
   - For solve items: category, key, reason, verdict, and all gathered evidence
   - For pairings: model, requirement, proximity score, verdict, confidence, reasoning
   - End with: "Should this item be: acknowledged as FP, archived, turned into a TODO, turned into a requirement, or skipped? Provide your verdict and reasoning."

2. Dispatch to quorum slots using parallel `Agent(subagent_type="nf-quorum-slot-worker")` calls per R3.2:
   - Load active slots from `bin/providers.json`
   - Launch one Task per slot with the formatted prompt
   - Collect responses

3. Present the quorum consensus:
```
── Quorum Review ─────────────────────────────────
 [slot-name]: [verdict] — [one-line reasoning]
 [slot-name]: [verdict] — [one-line reasoning]
 ...
 Consensus: [majority verdict] (N/M agree)
──────────────────────────────────────────────────
```

4. Re-present the action choices (unchanged) and call AskUserQuestion again. The quorum opinion is advisory — the user still decides.

#### Step 3g: Revision / deeper solo review (r)

When the user picks `r`, the main agent performs a deeper investigation of the current item without dispatching to external models:

1. **For solve items**: Read the actual files referenced (source, test, requirement), check `git log --oneline -5` for recent changes, examine surrounding code for context, and search for related patterns in the codebase.

2. **For pairings**: Read the model file and requirement in full, check if the model's behavior actually implements the requirement's intent (not just keyword overlap), and look for indirect coverage through related models.

3. Present an updated assessment:
```
── Revised Assessment ────────────────────────────
 Original confidence: [HIGH/LOW]
 After review:        [revised confidence with reasoning]

 [2-4 bullet points of new evidence or nuance found]

 Revised recommendation: [action] — [reasoning]
──────────────────────────────────────────────────
```

4. Re-present the action choices and call AskUserQuestion again. The user still decides.

## Step 4: Session summary

After all items processed or user quits:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 nForma ► RESOLVE: Session complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Processed: N items
 ✓ TODOs created:     X
 ✓ Marked FP:         Y
 ✓ Archived:          Z
 ✓ Reqs created:      W
 ○ Skipped:           S

 -- Pairings --
 ✓ Confirmed:        A
 ✓ Rejected:         B
 ○ Skipped:          C

 -- Orphans --
 ✓ Models annotated:  D
 ✓ Models archived:   E
 ✓ Reqs TODO'd:       F
 ✓ Reqs linked:       G
 ○ Skipped:           H

 Remaining: R items (run /nf:resolve to continue)
```

Track pairing counters (pairingsConfirmed, pairingsRejected, pairingsSkipped) and orphan counters (orphanModelsAnnotated, orphanModelsArchived, orphanReqsTodod, orphanReqsLinked, orphansSkipped) alongside existing solve counters throughout the interactive loop.

</process>
