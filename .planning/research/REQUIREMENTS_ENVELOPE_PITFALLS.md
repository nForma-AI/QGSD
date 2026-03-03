# Pitfalls Research: Requirements Envelope

**Domain:** Adding formal requirements artifacts, LLM validation, immutability enforcement, and drift detection to QGSD's existing formal verification ecosystem

**Researched:** 2026-03-01

**Confidence:** HIGH (formal verification literature, JSON Schema best practices, LLM validation patterns, and infrastructure drift detection all well-documented)

---

## Critical Pitfalls

### Pitfall 1: JSON Schema Versioning Creates Validation Brittleness

**What goes wrong:**
Requirements envelope schema is defined once, then as QGSD's formal verification capabilities evolve, the schema must change to support new constraint types, validation metadata, or traceability fields. But changing the schema breaks existing requirements documents or requires expensive backward-compatibility layers. Alternatively, the schema becomes over-engineered at the start to "future-proof," creating validation complexity that obscures the core requirements.

**Why it happens:**
JSON Schema has a well-documented history of breaking changes across versions (Draft 2019-09 → 2020-12 broke $recursiveRef semantics). Developers unfamiliar with this pattern either lock the schema too early or create sprawling extensibility that becomes unmaintainable. Additionally, formal verification systems often discover new constraint categories during implementation, forcing awkward retrofit into immutable schema.

**How to avoid:**
1. **Version the schema explicitly** — include `"schema_version": "1.0"` at the envelope root; don't rely on JSON Schema version alone
2. **Design for planned evolution** — use `additionalProperties: false` to catch unknown fields (fail-fast on schema drift), but keep `"requirements_metadata"` as an extensible object that can absorb new types
3. **Accept breaking changes in advance** — plan now for v1.0 → v1.1 migration tooling; don't try to make schema permanent
4. **Establish vocabulary boundaries** — define which constraint types are "core immutable" (preconditions, postconditions, invariants) vs. "extension metadata" (priority, risk level, sunset date)
5. **Validate against a separate "canonical schema"** stored in `.formal/requirements.schema.json`, not embedded in tooling code

**Warning signs:**
- Schema has more than 10 optional fields (sign of over-design)
- Formal spec generation discovers a constraint type not representable in current schema
- Phase-specific requirements tools implement their own sub-schema validation
- Schema discussions center on "what if we need X in the future" (planning for ghosts)

**Phase to address:**
Phase 1 (Requirements Envelope Foundation) — finalize schema design before freezing. Phase 2 should only extend metadata objects, not restructure the core envelope.

---

### Pitfall 2: Haiku Validation Pass Becomes Unreliable / Non-Deterministic

**What goes wrong:**
Haiku validates the requirements envelope for duplicates, conflicts, and ambiguity. But LLM validation is probabilistic — the same envelope returns different results on different runs. Phase passes with 95% confidence Tuesday, fails Wednesday. Or validation results diverge between local runs and CI runs due to subtle context differences. Planner discovers inconsistencies Haiku missed, but requirements are already frozen.

**Why it happens:**
LLM-as-judge validation research (2024-2026) shows that explicit rubrics, reference-based checks, and aggregate scoring are necessary for reliability. LLMs are not deterministic validators. Single-shot "is this ambiguous?" queries return noisy results. QGSD's Haiku model (faster, cheaper, smaller) trades accuracy for speed. Without structured validation frames, the gate becomes theater.

**How to avoid:**
1. **Structured validation, not free-form judgement** — provide Haiku with:
   - Explicit rubric (list of known duplicate patterns, canonical conflict types)
   - Reference data (previous requirements from prior phases, external standards)
   - Output format: JSON list of findings, not narrative assessment
2. **Aggregate scoring** — ask Haiku 3 independent passes (with different prompts); flag findings that appear in ≥2 passes as HIGH confidence, single-pass findings as LOW
3. **Whitelist known conflicts** — distinguish between "conflict" (bad) and "compatible options" (acceptable design trade); bake into rubric
4. **Explicit confidence thresholds** — validation passes only if HIGH+ confidence findings < some threshold; LOW confidence findings logged but don't block
5. **Generate deterministic hashes of findings** — output a requirements-validation.json with a hash of the finding set; failing to reproduce the hash flags non-determinism early
6. **Version the validation rubric** — if rubric changes, regenerate all prior envelopes or document why

**Warning signs:**
- Same envelope passes validation locally, fails in CI
- Haiku reports "ambiguous language in req X" but spec generation later works fine
- Phase is blocked because "ambiguity detected" but team can't reproduce the concern
- Validation pass/fail seems to depend on time of day (context window, model temperature, quota effects)

**Phase to address:**
Phase 2 (Haiku Validation Gate) — establish rubric and determinism tests. Include end-to-end test validating the same envelope 5 times and checking hash stability.

---

### Pitfall 3: Immutability Enforcement Lacks Clear Amendment Workflow

**What goes wrong:**
Pre-commit hook blocks writes to `.formal/requirements.json`. But there's no clear path for legitimate changes (typo fix, spec discovery of missing requirement, scope change). User tries to modify frozen envelope, hits block, has no guidance. Do they open a PR? Ask permission somewhere? Hack the hook? Team ends up maintaining a shadow document outside the formal system or skipping the immutability guard entirely.

**Why it happens:**
Immutability is easy to enforce (`chattr +i` on Unix, hook rejects Write tool calls). Immutability with escape hatches is hard. QGSD's existing infrastructure has quorum gates (for planning decisions) and user approval workflows, but those are wired into hook structures that expect narrative approvals. Formal requirements amendment is different — it needs bounded decision scope (which requirements changed, why) and possibly formal re-validation.

**How to avoid:**
1. **Define amendment classes upfront**:
   - **Class A (no re-validation)**: Typos, non-semantic fixes (adding clarifying words, grammar), priority/metadata-only changes
   - **Class B (re-validation required)**: Requirement scope change, precondition relaxation, postcondition strengthening
   - **Class C (roadmap impact)**: Adding/removing requirements, changing requirement category
2. **Amendment request format** — User cannot directly edit `.formal/requirements.json`. Instead:
   - Create `.formal/requirements.AMENDMENT-<timestamp>.json` with before/after + amendment class + rationale
   - Hook allows Amendment files, blocks direct envelope edits
   - Amendment validator checks amendment class and auto-approves Class A, gates Class B/C to explicit user approval
3. **Audit trail** — Amendment files never deleted; envelope retains `"amendment_history"` list (pointers to applied amendments)
4. **Re-validation workflow for Class B/C**:
   - Amendment file triggers Haiku re-validation on the modified envelope
   - Results go into amendment document; amendment not applied until validation passes
5. **Phase-specific amendment windows** — amendments only apply during plan-phase, not during execute-phase (prevent spec churn)

**Warning signs:**
- User modifies envelope directly and bypasses hook (suggesting hook is too strict)
- Multiple untracked requirements documents emerge (shadow specs)
- "No one remembers why this requirement is frozen"
- Phase planner requests requirement change but there's no mechanism to request it

**Phase to address:**
Phase 3 (Immutability Contract) — implement amendment workflow and hook guard. Amendment design should be finalized before enforcement hook is installed.

---

### Pitfall 4: Drift Detection False Positives Overwhelm Signal

**What goes wrong:**
Drift detector compares `.planning/REQUIREMENTS.md` (working document) against `.formal/requirements.json` (frozen). Tool reports drift on any difference — formatting changes, reordering, adding examples, clarifying language. Team spends hours daily triaging "false positive" drifts. Tool output is ignored or disabled. Real drift (actual requirement change) goes unnoticed.

**Why it happens:**
Drift detection research (infrastructure drift, data drift, model drift all documented) shows that naive diff-based detection floods users with false positives. String-level diffs catch noise (whitespace, comment changes). Semantic drift detection (does the meaning change?) is hard without LLM assistance. But LLM drift detection has its own false positive rate. Balance is critical.

**How to avoid:**
1. **Define drift categories with severity**:
   - **NOISE**: Formatting, typo fixes, markdown restructuring, examples, clarifying language — these are NOT drift
   - **SEMANTIC DRIFT**: Requirement scope changes, precondition/postcondition changes, priority/category changes — real drift
   - **STRUCTURAL DRIFT**: Requirement added/removed/merged — must escalate
2. **Implement semantic-level detection**:
   - Generate embedding-based fingerprint of each requirement (semantic hash via Haiku summary)
   - Compare fingerprints, not text; ignore text-only changes
   - If fingerprint unchanged, mark as NOISE and suppress alert
   - If fingerprint changed, ask: "What changed? Is this intentional?" → present only semantic changes
3. **Establish allowed-change windows**:
   - Drift checking disabled during plan-phase (requirements are being refined)
   - Enabled during execute-phase (requirements should be stable)
   - Enables developers to iterate during planning without constant drift warnings
4. **Whitelist known-safe changes** — maintain `.driftignore` listing changes that are intentional (e.g., "REQ-03: Added timeout bound after testing phase")
5. **Escalation, not blocking** — drift detection warns, but doesn't block commits; requires explicit user acknowledgment with rationale

**Warning signs:**
- Drift detector fires 100+ times in a phase; team learns to ignore warnings
- Same change flagged as drift 3 days in a row (sign of flaky detection)
- User disables drift detection to "unblock the phase"
- Phase planner documents "require X" but it's already in requirements; confusion traced to drift detector having been ignored

**Phase to address:**
Phase 5 (Drift Detection) — finalize semantic fingerprinting approach and window definitions. Disable initially during execute-phase; only warn during plan-phase until team validates false positive rate is <5%.

---

### Pitfall 5: Formal Spec Generation Discovers Requirements Were Incomplete / Contradictory

**What goes wrong:**
Requirements envelope is frozen after Haiku validation. Phase 2 runs `generate-formal-specs.cjs`, which attempts to synthesize TLA+/Alloy specs from requirements as source of truth. Spec generation fails: "REQ-02 precondition not satisfiable given REQ-05 postcondition" or "REQ-08 references undefined state X." Specification is now blocked but envelope is immutable. Discover issues only after expensive machinery kicks in.

**Why it happens:**
Requirements validation (Haiku duplicates/conflicts check) and specification synthesis are different gates with different discovery power. Haiku catches surface-level conflicts ("all users are admins" vs "admins are a subset of users"). But Haiku doesn't run the formal semantics — it doesn't know if a postcondition is reachable given the system's preconditions and invariants. Formal spec generation is the "deep" validator. By that point, envelope is frozen.

**How to avoid:**
1. **Add a "formal specification compatibility" check before Haiku validation**.
   - During requirements aggregation phase (before Haiku), attempt a dry-run `generate-formal-specs --validate-only --requirements <envelope>`
   - If synthesis fails, requirements are not ready for Haiku validation
   - Error must cite specific requirements and the conflict (e.g., "REQ-02 ∧ REQ-05 are unsatisfiable; revise one")
2. **Haiku validation includes a formal semantics rubric**:
   - Provide Haiku with brief spec synthesis rules ("if a requirement sets variable X, all later requirements must respect X's domain")
   - Ask Haiku to flag potential formal conflicts, not just surface-level duplicates
3. **Staged freezing**:
   - Freeze requirements for Haiku validation (STAGE 1: Semantic Validation)
   - After Haiku passes, allow amendments to address formal synthesis errors (STAGE 2: Formal Compatibility)
   - Only after synthesis passes, freeze fully (STAGE 3: Immutable Envelope)
4. **Specification synthesis errors are NOT blocker**:
   - If synthesis reveals gaps, phase doesn't fail; instead, amendment workflow is triggered
   - Amendments are Class B (require re-validation), not Class C (roadmap impact)

**Warning signs:**
- Phase 2 spec generation fails with "unsatisfiable" errors
- Requirements seem clear in English but spec generator can't translate them
- Formal spec generation blocks for days while team negotiates requirement clarification
- Envelope has been "frozen" but amendments are still being applied (suggests frozen premature)

**Phase to address:**
Phase 2 (Haiku Validation) should include pre-Haiku formal compatibility dry-run. If that passes, Haiku can validate with confidence. Keep amendment window open until Phase 2 spec generation is complete.

---

### Pitfall 6: Immutability Enforcement Prevents Normal Development Workflows

**What goes wrong:**
Pre-commit hook blocks modifications to `.formal/requirements.json`. But legitimate workflows need to touch the file:
- Developer runs `generate-phase-spec.cjs` (supposed to write updated specs), which fails because it tries to update derived data stored with the requirements
- Git merge conflicts on the frozen file require manual resolution but hook prevents all writes
- Automated tooling (e.g., spec regenerator from Phase v0.21) can't write to frozen file

The immutability enforcement becomes an obstacle, not a protection.

**Why it happens:**
Pre-commit hooks intercept file writes at git level, but QGSD's workflows involve hooks and tooling that write outside normal git patterns. Immutability enforcement is OS-level (chattr, chflags) or git-level (pre-commit hook), but tooling may have different assumptions. Additionally, the envelope may store derived data (last_validated_by, last_amendment_timestamp) that legitimate tools need to update.

**How to avoid:**
1. **Separate immutable envelope from operational metadata**:
   - `.formal/requirements.json` contains only authoritatively frozen requirements (r/o from QGSD tools)
   - `.formal/requirements.metadata.json` contains mutable operational data (last_validated_timestamp, last_validated_by, amendment_history, fingerprints)
   - Only the core envelope is immutable; metadata can be written by tooling
2. **Explicit amendment path for tooling**:
   - Tools that discover new requirements write to a staging file: `.formal/requirements.STAGE-<tool-name>.json`
   - Staging files are NOT immutable; they accumulate until user reviews and merges into envelope via amendment workflow
   - Cleaner than fighting the immutability guard
3. **Hook allows specific writes**:
   - Pre-commit hook is not a blanket block; it allows writes if:
     - Amendment class is identifiable (Class A → auto-approve, no validation needed)
     - OR user supplies `--approve-amendment <class>` flag to Bash/commit (user intent explicit)
     - OR CI approval token is present (roadmap sync validated the change)
4. **Preserve merge safety**:
   - Immutability does NOT apply to git merge conflict resolution
   - Allow developers to resolve merge conflicts, then re-validate if amendments touched
   - Hook blocks *creation* of new formal requirement conflicts, not *resolution* of git conflicts

**Warning signs:**
- Tooling that should auto-update specs can't because envelope is immutable
- Merge conflicts on `.formal/requirements.json` hang the phase (can't resolve due to hook)
- Team creates workaround files (e.g., `requirements-working.json`) outside formal system
- Hook error message is confusing or suggests workarounds the team shouldn't use

**Phase to address:**
Phase 3 (Immutability Contract) — design amendment workflow and metadata separation concurrently. Hook implementation must test common workflows: spec regeneration, merge resolution, amendment approval.

---

### Pitfall 7: Hook Installation Sync Breaks Immutability Enforcement

**What goes wrong:**
Immutability enforcement hook is developed in `hooks/qgsd-requirements-guard.js`, tested locally, then installed via `node bin/install.js --claude --global`. But the installed copy at `~/.claude/hooks/` is not in sync with the source. Developer modifies the hook logic locally, forgets to reinstall, and the old version keeps running. Enforcement is inconsistent between developers. Or the hook is installed for user A but not user B; one team member's frozen envelope isn't actually frozen for the other.

**Why it happens:**
QGSD's hook installation pattern (source in `hooks/`, compiled to `hooks/dist/`, installed globally to `~/.claude/hooks/`) has a multi-step sync. From the memory context, there's a documented pattern: "edits to hook source files MUST sync to `hooks/dist/` first, then run `node bin/install.js --claude --global`." Developers new to the system forget this. Or global installation is skipped (user says "I'll use local hooks"), and different developers run different versions.

**How to avoid:**
1. **Enforce installation as a git hook**:
   - Add a post-merge git hook that checks if `hooks/qgsd-requirements-guard.js` is newer than `hooks/dist/qgsd-requirements-guard.js`
   - If source is newer, WARN user and require explicit install: `node bin/install.js --claude --global`
   - This catches sync issues automatically
2. **Version-stamp the hook**:
   - Include a `HOOK_VERSION` constant in both source and installed copy
   - At start of qgsd-prompt/qgsd-stop hooks, check version match; log mismatch as WARN
   - Alert user if installed hook is older than local source
3. **Namespace the enforcement**:
   - Immutability enforcement applies only to commits from user's Claude Code session (where the installed hook is running)
   - Document that requirements-guard.js must be installed globally for enforcement to be effective
   - Add README section: "Immutability requires: `node bin/install.js --claude --global`"
4. **CI enforcement as backstop**:
   - Keep an independent, separate CI gate that rejects direct writes to `.formal/requirements.json` without amendment
   - Client-side hook + CI gate = defense in depth
   - If client hook isn't installed, CI gate still protects

**Warning signs:**
- Developer successfully commits change to `.formal/requirements.json` that should have been blocked
- Hook behavior differs between developers
- Hook changes are made but don't take effect (developer re-runs same commit, still allowed)
- Team member asks "why does the hook enforce for me but not for you?"

**Phase to address:**
Phase 3 (Immutability Contract) — implement version checking and post-merge sync validation in install.js. Add an explicit section to .planning/PROJECT.md documenting installation requirements.

---

### Pitfall 8: Requirements-to-Formal-Spec Traceability Gap Obscures Coverage

**What goes wrong:**
Requirements envelope is frozen and valid. Formal specs (TLA+, Alloy) are generated and verified. But there's no record of which specs verify which requirements. Phase 2 spec generation creates PROPERTY X, but it's not clear if PROPERTY X is "enforced by REQ-08" or "an implementation detail." When spec generation later discovers new properties must be added, team doesn't know if they're required by requirements or are free choices. Traceability breaks at the boundary between requirements and specs.

**Why it happens:**
Requirements and formal specs live in different languages and tools. Requirements are natural language, stored in JSON. Specs are TLA+ or Alloy, stored in `.tla` and `.als` files. Traceability ("this PROPERTY proves this REQ") is not automatic. QGSD's model registry tracks which specs exist, but doesn't map specs → requirements. Bridging this gap requires explicit design effort and maintenance.

**How to avoid:**
1. **Embed traceability in spec files**:
   - Each TLA+ property or Alloy invariant must have a comment linking to requirement ID:
     ```tla
     \* PROPERTY AcquirePhaseMonotonic proves REQ-12 (phases advance monotonically)
     PROPERTY AcquirePhaseMonotonic == ...
     ```
   - Spec generator enforces this: any property without a REQ- reference is flagged as "untraced" and requires explicit approval
2. **Generate traceability report**:
   - After spec generation, emit `.formal/traceability.json` mapping requirements → properties → check results
   - Example:
     ```json
     {
       "REQ-08": {
         "title": "Planning gate must block without quorum",
         "properties": ["HasPlanningCommand_RequiresQuorum", "QuorumVoteGuard"],
         "last_verified": "2026-03-01T...",
         "last_check_result": "PASS"
       }
     }
     ```
3. **Coverage check as phase gate**:
   - Before phase transitions, run: `check-requirement-coverage --requirements .formal/requirements.json --properties .formal/tla/*.tla`
   - Report any requirements without verified properties → flag for amendment or spec addition
   - Report any properties without requirements → flag as implementation details (acceptable but documented)
4. **Amendment impact analysis**:
   - When amendment workflow triggers, automatically recompute affected properties
   - Show user: "Your amendment to REQ-08 affects properties [X, Y, Z]; re-running verification..."

**Warning signs:**
- Phase 2 completes specs but team can't explain "what does PROPERTY X verify?"
- Requirement removed but no one notices the property it mapped to is now orphaned
- Spec generation adds new properties without clear rationale
- Traceability document would have to be manually maintained (sign it should be automated)

**Phase to address:**
Phase 2 (Formal Spec Generation) — integrate traceability into spec generation. Traceability report is a mandatory output; phase doesn't complete until coverage is >95%.

---

### Pitfall 9: Haiku Validation Fails Due to Quota / Model Availability

**What goes wrong:**
Haiku validation pass runs during plan-phase. Haiku is unavailable (quota hit, rate-limited, endpoint down). Validation hangs or fails. Phase cannot proceed. User has no clear recovery path: Is this permanent? Should they skip validation? Use a different model? Validation gate becomes a blocker even when envelope hasn't changed.

**Why it happens:**
QGSD's memory context documents that "Codex frequently UNAVAILABLE (usage limits until Feb 24 2026+); Gemini hits quota daily (~30min resets)." Haiku is cheaper and faster, but still subject to provider limits. Validation is a critical gate, but it's now dependent on external LLM availability. No fallback or graceful degradation.

**How to avoid:**
1. **Health check before validation**:
   - `plan-phase.md` runs a quick Haiku health check before attempting full validation:
     ```bash
     node bin/health-check.cjs --model haiku --timeout 10s
     ```
   - If health check fails, validation is skipped with explicit messaging: "Haiku unavailable; validation deferred to next phase"
   - Phase can proceed (assuming envelope from previous phase is still valid)
2. **Cache previous validation result**:
   - If envelope hasn't changed since last successful validation, reuse cached result
   - Store validation timestamp + envelope hash in `.formal/requirements.validation.json`
   - Skip Haiku call if: `last_validation_hash == current_envelope_hash && last_validation_time < 1 day ago`
3. **Graceful degradation to syntax-only validation**:
   - If Haiku unavailable, fall back to schema-level validation only (does JSON parse? Does it match schema?)
   - This is not a replacement for semantic validation, but it's better than blocking
   - Log as "VALIDATION=SYNTAX_ONLY" to distinguish from full validation
4. **Explicit user override**:
   - User can pass `--skip-validation` to plan-phase if validation is stuck
   - This requires explicit intent (not silent default) and is logged as a risk flag
   - Downstream phases report "Requirements not validated; confidence: low"

**Warning signs:**
- Validation passes locally but fails in CI (model availability varies)
- Phase blocked because "Haiku is down" multiple times
- User asks "can I skip validation?" and there's no supported path
- Validation takes 5+ minutes (sign of retries / rate limiting)

**Phase to address:**
Phase 2 (Haiku Validation) — implement health check and cache before attempting validation. Plan-phase should test this with simulated unavailability (mock Haiku to timeout) and verify phase can proceed with cached result.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip Haiku validation during MVP | Fast phase completion | Undetected requirement conflicts discovered later during formal spec gen (expensive) | Never. Add health check + cache so validation is cheap, not skipped. |
| Store validation metadata in requirements.json | Single source of truth | Metadata and content lock together; can't update metadata without full re-validation | Never. Separate into requirements.json (content) + requirements.metadata.json (operational). |
| No amendment workflow; just edit frozen envelope directly | Simplicity | Immutability becomes theater; team ignores the guard and edits anyway | Never. Amendment workflow complexity pays for itself in first modification. |
| Drift detection using naive string diff | Fast detection | False positives overwhelm signal; team ignores warnings | Only for prototype. Switch to semantic fingerprinting before phase 5. |
| No traceability between requirements and specs | Fast spec generation | Obscured coverage; hard to know if spec changes require requirement updates | Only if specs are never re-examined. With ongoing FV loops (v0.21), unacceptable. |
| Pre-commit hook without metadata separation | Prevents accidental modifications | Breaks legitimate tools; team finds workarounds | Only for local development. Must separate envelope from metadata before team-wide deployment. |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Hook installation sync | Modify source hook, forget to sync to `hooks/dist/`, forget to reinstall globally | Add post-merge git hook checking for version mismatch; add explicit version stamp to hook; enforce installation in CI |
| Haiku validation in plan-phase | Call Haiku without health check; gate blocks phase if unavailable | Health check + cache previous result; fall back to syntax-only validation if Haiku unavailable |
| Amendment approval workflow | No clear path for amendments; users bypass immutability guard | Define amendment classes (A/B/C); implement staging files; route to explicit approval gate before applying |
| Formal spec generation with requirements as source | Spec gen fails late (after freeze); requirements were incomplete | Pre-flight dry-run spec gen before Haiku validation; report conflicts early; stage freezing (semantic → formal compat → immutable) |
| Drift detection in continuous workflows | Drift detector flags all changes during plan-phase; team ignores it | Disable drift checking during plan-phase; enable only during execute-phase; implement semantic fingerprinting, not string diffs |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|-----------|---|
| Haiku validation without caching | Validation takes 30s every plan-phase; context window bloat from repeated envelope reads | Cache validation result keyed by envelope hash; skip if hash unchanged | When envelope is large (100+ requirements) and plan-phase happens frequently |
| Drift detection runs on every git operation | Drift alerts on every commit; noise overwhelms signal | Run drift check only during specific phases (plan-phase end, execute-phase start); disable during rapid iteration | When requirements document is edited frequently and detector can't distinguish noise from signal |
| Traceability report generated but never used | Report generation adds 5-10s to phase completion; no one reads it | Generate report only when requirements change or phase completes; make report optional unless there's a coverage gap | When roadmap is stable and specs rarely change; if roadmap churns, report becomes valuable |
| Amendment validation re-runs full Haiku pass | Amendment to 1 requirement triggers full envelope re-validation (30s+) | Structure amendments to skip already-validated requirements; only re-validate changed subset | When amendments are frequent and Haiku is unavailable / slow |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|----------|
| Immutability hook allows user override via environment variable (e.g., `SKIP_IMMUTABILITY=1`) | Requirements can be silently modified without audit trail | Never allow env-var overrides to immutability gate; require explicit CLI flag + audit logging |
| Amendment approval is implicit ("I'll just commit it") | No accountability for requirement changes; scope creep invisible | Amendment approval must route through explicit workflow with user intent + rationale logged |
| Frozen envelope contains secrets or sensitive data | Secrets committed to .formal/ directory, immutable forever | Redact sensitive data before freezing; similar to redaction enforcement in v0.19. Audit for secrets at validation time. |
| Drift detection compares against a user-modifiable `.driftignore` file | User can silence drift warnings for any requirement without oversight | `.driftignore` changes require explicit commit + code review; drift exemptions are tracked separately and reported |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Requirements are frozen" but no clear amendment path | User can't fix a typo; frustrated by apparent rigidity | Provide clear amendment workflow with 3 classes; Class A (typos) auto-approves; user can fix without blocking |
| Drift detection reports "changes detected" but doesn't explain which changes | User spends 30 min diffing files to understand what drifted | Report semantic changes only (embedded vs unembedded), not formatting; explain in natural language what changed |
| Haiku validation "conflicts detected" but doesn't cite which requirements conflict | User must manually inspect envelope to find the issue | Validation report must cite specific requirement pairs + the nature of conflict (contradictory precondition, mutually exclusive postcondition, etc.) |
| Amendment workflow has 5 approval gates but docs are unclear on how to use it | User tries to amend, gets blocked multiple times, gives up | Provide a wizard (e.g., `qgsd amendment --help` with step-by-step guidance) or auto-route Class A amendments without user knowing |
| "Immutability enforced" but file is still writable via direct edit (if hook not installed) | User experiences inconsistent behavior; confused by silent acceptance on day 1, rejection on day 2 | Enforce immutability at multiple levels (hook + CI gate); fail loudly if hook is not installed; check at phase start |

---

## "Looks Done But Isn't" Checklist

- [ ] **Requirements Schema:** Schema is finalized AND includes versioning field AND includes plan for v1.0 → v1.1 migration. NOT just "good enough for now."
- [ ] **Haiku Validation:** Validation uses explicit rubric AND aggregates 3+ passes AND produces deterministic output AND is tested for non-determinism (run 5 times, check hash stability). NOT single-shot LLM judgment.
- [ ] **Immutability Enforcement:** Hook is installed globally (`~/.claude/hooks/`) AND version is checked at phase start AND amendment workflow is implemented AND tested with legitimate modification workflows (merge resolution, metadata update). NOT just blocking writes.
- [ ] **Drift Detection:** Semantic fingerprinting is working AND false positive rate is <5% AND only enabled during execute-phase AND whitelisting mechanism exists for intentional changes. NOT naive string diffs.
- [ ] **Formal Spec Traceability:** Every PROPERTY has a comment linking to REQ- AND `traceability.json` is generated AND coverage check passes (>95%) AND coverage report is present in phase summary. NOT implicit traceability "everyone knows it."
- [ ] **Amendment Workflow:** All three amendment classes (A/B/C) are defined AND staging files work AND approval routing is clear AND audit trail is complete. NOT "we'll figure it out when we need it."
- [ ] **Haiku Health Check:** Health check before validation is implemented AND cache is working AND fallback to syntax-only validation is available AND unavailability doesn't block phase. NOT assuming Haiku is always available.
- [ ] **Hook Installation Sync:** Post-merge git hook checks for source/dist sync AND version stamp is present AND install.js refuses to run if hook not installed AND CI enforces installation. NOT hoping developers remember to install manually.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|---|
| Haiku validation discovered late that requirements are contradictory | HIGH (days; requires amendment cycle + re-validation + phase re-plan) | Implement formal spec dry-run before Haiku (Phase 2 spec gen validation); this cost only occurs if caught at Haiku time, not later |
| Team discovered immutability enforcement is too strict; legitimate workflows blocked | HIGH (days; requires hook redesign + amendment workflow + reinstall) | Test against real workflows (merge resolution, metadata update) before enforcing; separate envelope from metadata to avoid this |
| Drift detection false positives overwhelmed signal; team disabled it | MEDIUM (hours; re-implement with semantic hashing) | Start with drift detection disabled; enable only after semantic fingerprinting is tested and false positives <5% |
| Schema version clash between developers (v1.0 vs v1.1) | MEDIUM (hours; requires envelope migration + re-validation) | Version schema explicitly; plan migrations before locking v1.0; document upgrade path |
| Amendment got approved and applied but later caused spec generation to fail | MEDIUM (hours; rollback amendment, fix in next round) | Implement staged freezing: amendments unlock envelope for formal spec validation before re-freezing |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|---|
| Schema Versioning Brittleness | Phase 1 (Foundation) | Schema includes version field; migration plan documented; team confirms extensibility strategy |
| Haiku Non-Determinism | Phase 2 (Validation) | Run same envelope 5 times; hash of findings matches 100%; rubric is explicit; aggregation tested |
| Immutability Lacks Amendment Path | Phase 3 (Immutability) | Amendment classes defined; staging workflow implemented; hook tested with Class A/B/C amendments |
| Drift Detection False Positives | Phase 5 (Drift Detection) | False positive rate <5%; semantic fingerprinting confirmed; allowed-change windows tested |
| Formal Spec Incompatibility | Phase 2 (Validation) | Dry-run spec gen before Haiku validation; failures reported with specific requirement conflicts |
| Immutability Breaks Development | Phase 3 (Immutability) | Test against merge resolution, metadata update, spec regeneration; all pass without bypassing hook |
| Hook Installation Sync Breaks | Phase 3 (Immutability) | Version check at phase start; post-merge sync validation; CI enforces installation |
| Requirements-to-Spec Traceability Gap | Phase 2 (Spec Generation) | Traceability report generated; coverage >95%; untraced properties require explicit approval |
| Haiku Validation Blocked by Quota | Phase 2 (Validation) | Health check passes before validation; cache working; fallback to syntax validation tested |

---

## Sources

- [Automated requirement contradiction detection through formal logic and LLMs](https://link.springer.com/article/10.1007/s10515-024-00452-x) — Academic study on ALICE system for detecting contradictions; shows LLM-only approaches miss 40% of contradictions, formal logic integration achieves 60%+ detection.

- [Requirements Ambiguity Detection and Explanation with LLMs: An Industrial Study](https://www.ipr.mdu.se/pdf_publications/7221.pdf) — Industrial validation of LLM-based ambiguity detection in requirements.

- [Context-Adaptive Requirements Defect Prediction through Human-LLM Collaboration](https://arxiv.org/html/2601.01952) — January 2026 research on LLM-based requirements quality assessment.

- [Validation of Modern JSON Schema: Formalization and Complexity](https://dl.acm.org/doi/10.1145/3632891) — Formal specification of JSON Schema validation; PSPACE-hard with dynamic references, P-complete without.

- [JSON Schema - Towards a stable JSON Schema](https://json-schema.org/blog/posts/future-of-json-schema) — Official JSON Schema roadmap documenting history of breaking changes (Draft 2019-09 → 2020-12) and strategy for stable evolution.

- [Data Drift: Key Detection and Monitoring Techniques in 2026](https://labelyourdata.com/articles/machine-learning/data-drift) — Drift detection patterns (Population Stability Index, KL Divergence, Kolmogorov-Smirnov Test).

- [Drift Detection in IaC: Prevent Your Infrastructure from Breaking](https://www.env0.com/blog/drift-detection-in-iac-prevent-your-infrastructure-from-breaking) — Infrastructure-as-Code drift detection shows ~90% of large deployments experience drift; false positives overwhelm signal without semantic analysis.

- [Autonomous Regulatory Drift Detection](https://al-kindipublishers.org/index.php/jcsts/article/download/10650/9398) — Regulatory drift detection using statistical divergence; relevant for requirements drift prevention.

- [Best AI evals tools for CI/CD in 2025](https://braintrust.dev/articles/best-ai-evals-tools-cicd-2025) — LLM validation in CI/CD; semantic evaluation via embedding similarity and LLM judges preferred for reliability.

- [CI/CD for LLM apps: Run tests with Evidently and GitHub actions](https://www.evidentlyai.com/blog/llm-unit-testing-ci-cd-github-actions) — LLM-as-judge in CI gates; explicit rubrics and aggregate scoring necessary for reliability.

- [LogSage: An LLM-Based Framework for CI/CD Failure Detection and Remediation with Industrial Validation](https://arxiv.org/html/2506.03691v2) — March 2026 research on adversarial CI validation; shows single-shot evaluations unreliable, aggregation required.

- [Effortless Code Quality: The Ultimate Pre-Commit Hooks Guide for 2025](https://gatlenculp.medium.com/effortless-code-quality-the-ultimate-pre-commit-hooks-guide-for-2025-57ca501d9835) — Pre-commit hook patterns and automation; file validation strategies.

- [5 'chattr' Commands to Make Important Files IMMUTABLE (Unchangeable) in Linux](https://www.tecmint.com/chattr-command-examples/) — Immutable file enforcement via chattr; common pitfall is lack of escape hatch.

- [How to Set Up Immutable Backup Storage Using Azure Blob](https://www.ninjaone.com/blog/set-up-immutable-backup-storage-using-azure-blob/) — WORM (Write-Once Read-Many) strategy for immutable storage; relevant for immutability design.

---

*Pitfalls research for: QGSD v0.22 Requirements Envelope (formal requirements artifacts, LLM validation, immutability, drift detection)*

*Researched: 2026-03-01*

*Next steps: Use these pitfalls to inform Phase 1-5 design; test against recovery strategies during implementation; validate false-positive rates empirically during Phase 5 (Drift Detection).*
