---
task_id: 365
description: "Fix quorum output truncation integrity bugs confirmed by NFOutputIntegrity.tla formal model"
formal_artifacts: update
requirements: [TRUNC-01, TRUNC-02, TRUNC-03, TRUNC-04, TRUNC-05]
files_modified:
  - bin/quorum-slot-dispatch.cjs
  - bin/call-quorum-slot.cjs
  - hooks/nf-stop.js
  - hooks/dist/nf-stop.js
  - bin/quorum-truncation-integrity.test.cjs
  - .planning/formal/tla/NFOutputIntegrity.tla
---

# Plan: Fix Quorum Output Truncation Integrity

## Objective

Fix 2 TLC-confirmed invariant violations (TRUNC-04, TRUNC-05) and add defensive guardrails for L1 truncation detection, verdict_integrity tagging, and consensus-gate awareness. Update the formal model to reflect the fixed system.

Formal model violations:
- TRUNC-04 FAIL: telemetryRecorded set FALSE when truncationDetected is TRUE (line 142 of NFOutputIntegrity.tla)
- TRUNC-05 FAIL: L6 raw field truncation (5KB) has no marker -- truncationDetected not set when afterL3 > L6Cap

Defensive guardrails (TRUNC-01, TRUNC-02, TRUNC-03):
- L1 (10MB) truncation in call-quorum-slot.cjs is silent -- add marker and propagate
- parseVerdict returns no metadata about whether verdict came from truncated buffer
- nf-stop.js has no awareness of verdict_integrity field

## Must-Haves

1. L1 (10MB) truncation in call-quorum-slot.cjs appends [OUTPUT TRUNCATED at 10MB] marker to stdout
2. L3 (50KB) truncation in quorum-slot-dispatch.cjs propagates truncated boolean and original_size to emitResultBlock
3. L6 (5KB) raw field truncation in emitResultBlock appends [RAW TRUNCATED at 5KB] marker when raw exceeds 5000 chars
4. emitResultBlock emits verdict_integrity: truncated and truncation YAML block when any truncation occurred
5. parseVerdict exposes truncation note via side-channel property (backward compat preserved)
6. recordTelemetry in call-quorum-slot.cjs accepts and records truncated, truncation_layer, original_size_bytes fields
7. nf-stop.js logs a stderr warning when verdict_integrity: truncated appears in tool_result text
8. NFOutputIntegrity.tla updated so all 6 invariants PASS
9. All changes fail-open -- truncation metadata is observational, never blocking
10. Backward compatibility preserved -- existing telemetry consumers see same fields plus new optional ones

## Tasks

### Task 1: Add truncation markers, metadata propagation, and telemetry fields

**Files:**
- bin/call-quorum-slot.cjs
- bin/quorum-slot-dispatch.cjs

**Action:**

**A) call-quorum-slot.cjs -- L1 truncation marker + telemetry fields:**

1. At line ~371, the stdout accumulation silently caps at MAX_BUF (10MB). Currently no truncation boolean is tracked here. Add a let l1Truncated = false and let l1OriginalSize = 0 before the data handler. In the data handler, when stdout.length >= MAX_BUF, set l1Truncated = true and accumulate l1OriginalSize += d.length. In the child.on('close') handler at line ~389, if l1Truncated, append the string \n\n[OUTPUT TRUNCATED at 10MB by call-quorum-slot] to the resolved output.

2. At line ~57, expand recordTelemetry signature to accept 3 new optional trailing params: truncated (boolean), truncationLayer (string or null), originalSizeBytes (number or null). Add them to the JSON record as truncated (default false), truncation_layer (default null), original_size_bytes (default null). These fields are additive -- existing consumers ignore unknown JSON fields.

3. Update all 4 recordTelemetry call sites (lines ~617, ~628, ~642, ~657) to pass the 3 new args. For the success path at line ~642, detect L1 truncation by checking if the result string contains [OUTPUT TRUNCATED at 10MB. For error paths, pass false, null, null.

**B) quorum-slot-dispatch.cjs -- L3 propagation + L6 marker + verdict_integrity:**

4. At line ~1318-1320 (subprocess close handler), the truncated boolean and suffix marker already exist for L3 (50KB). Change the resolve call to also pass truncated and originalSize in the resolved object. The truncated var is already in scope (line 1301). Change from resolve({ exitCode, output }) to resolve({ exitCode, output, truncated, originalSize: stdout.length }).

5. At line ~1328, destructure the new fields: const { exitCode, output, truncated: l3Truncated, originalSize: l3OriginalSize } = rawOutput;

6. Also detect L1 truncation from the marker: const l1Truncated = output.includes('[OUTPUT TRUNCATED at 10MB');

7. At line ~1344 (success path result construction), pass truncation metadata to emitResultBlock: add truncated: l3Truncated || l1Truncated, truncationLayer: l1Truncated ? 'L1' : (l3Truncated ? 'L3' : null), originalSizeBytes: l3OriginalSize || null.

8. Update emitResultBlock function signature (line ~985) to accept truncated, truncationLayer, originalSizeBytes from destructured opts. In the function body, after the raw field block (line ~1037):
   - For the raw field itself (line ~1033): if rawOutput length > 5000, append \n[RAW TRUNCATED at 5KB] to rawTruncated before splitting into lines.
   - Compute effective truncation: const l6Truncated = (rawOutput || '').length > 5000; const effectiveTruncated = truncated || l6Truncated; const effectiveLayer = truncationLayer || (l6Truncated ? 'L6' : null);
   - If effectiveTruncated is truthy, push verdict_integrity: truncated, then push truncation: block with truncated: true, layer, and optional original_size_bytes lines.

9. For parseVerdict (line ~809), do NOT change the return type (would break callers). Instead, set parseVerdict.lastTruncationNote as a side-channel property. After the regex match at line ~814, before returning, if rawOutput contains [OUTPUT TRUNCATED, set parseVerdict.lastTruncationNote = true, else false. The caller at line ~1345 can read this after calling parseVerdict.

**Verify:**
Run node --check bin/quorum-slot-dispatch.cjs and node --check bin/call-quorum-slot.cjs to confirm no syntax errors.

**Done:** L1 appends [OUTPUT TRUNCATED at 10MB] marker. L3 propagates truncated/originalSize to emitResultBlock. L6 appends [RAW TRUNCATED at 5KB] marker. emitResultBlock emits verdict_integrity and truncation YAML block. recordTelemetry records 3 new truncation fields. parseVerdict exposes truncation note via side-channel.

### Task 2: Add nf-stop.js truncation awareness + install sync

**Files:**
- hooks/nf-stop.js
- hooks/dist/nf-stop.js

**Action:**

1. In nf-stop.js, near line ~496 where tool_result text is checked for UNAVAIL verdicts, add truncation awareness. After the UNAVAIL check loop (around line ~500), add a check: if the result text matches /verdict_integrity:\s*truncated/i, write a warning to stderr: [nf-stop] WARNING: Slot result has verdict_integrity: truncated -- verdict may be from incomplete output. This is purely observational (fail-open) -- it logs to stderr for diagnostics but does NOT block consensus or change any decision logic.

2. Copy to dist and install: cp hooks/nf-stop.js hooks/dist/nf-stop.js then node bin/install.js --claude --global

**Verify:**
Run grep 'verdict_integrity.*truncated' hooks/nf-stop.js to confirm the pattern exists. Run diff hooks/nf-stop.js hooks/dist/nf-stop.js to confirm sync (should be empty).

**Done:** nf-stop.js emits stderr warning when it encounters verdict_integrity: truncated in slot results. Installed copy is synced.

### Task 3: Tests and formal model update

**Files:**
- bin/quorum-truncation-integrity.test.cjs
- .planning/formal/tla/NFOutputIntegrity.tla

**Action:**

**A) Create test file bin/quorum-truncation-integrity.test.cjs:**

Use node:test + node:assert/strict (same pattern as quorum-telemetry.test.cjs). Tests to write:

1. L6 marker test: Call emitResultBlock with rawOutput > 5000 chars. Assert the output contains [RAW TRUNCATED at 5KB]. Note: emitResultBlock may not be exported. Check if quorum-slot-dispatch.cjs has a module.exports block. If not, add module.exports = { emitResultBlock, parseVerdict } guarded by if (require.main !== module) or unconditionally (the file is loaded as a CLI via spawn, so exports do not interfere).

2. Truncation metadata in emitResultBlock: Call emitResultBlock with truncated: true, truncationLayer: 'L3', originalSizeBytes: 51200. Assert output contains verdict_integrity: truncated, truncation:, truncated: true, layer: L3, original_size_bytes: 51200.

3. No truncation metadata when not truncated: Call emitResultBlock with truncated: false. Assert output does NOT contain verdict_integrity.

4. L6-only truncation: Call emitResultBlock with truncated: false but rawOutput > 5000 chars. Assert output contains verdict_integrity: truncated with layer: L6.

5. parseVerdict truncation note: Call parseVerdict with input containing [OUTPUT TRUNCATED. Check parseVerdict.lastTruncationNote === true. Call with clean input, check === false.

6. parseVerdict backward compat: Call parseVerdict with normal input. Assert return value is a string (APPROVE, REJECT, or FLAG).

7. Telemetry record shape: Build a mock telemetry record with the 3 new fields (truncated: true, truncation_layer: 'L1', original_size_bytes: 10485760). Parse the JSON, assert the 3 fields are present alongside the original 10 fields.

8. nf-stop.js source check: Read hooks/nf-stop.js, assert it contains the verdict_integrity truncated regex pattern.

**B) Update NFOutputIntegrity.tla:**

Fix the formal model to reflect the corrected system. The invariants themselves do NOT change -- only the actions change.

1. ApplyL1 (line ~86-92): When slotOutput[s] > L1Cap, also set truncationDetected to TRUE. Update the action to include truncationDetected in the changed variables:
   Change truncationDetected' to [s \in SlotIds |-> IF slotOutput[s] > L1Cap THEN TRUE ELSE truncationDetected[s]]
   Remove truncationDetected from UNCHANGED tuple.

2. ApplyL6 (line ~108-115): When afterL3[s] > L6Cap, set truncationDetected to TRUE. Add:
   truncationDetected' = [s \in SlotIds |-> IF afterL3[s] > L6Cap THEN TRUE ELSE truncationDetected[s]]
   Remove truncationDetected from UNCHANGED tuple.

3. ConsensusCheck (line ~137-147): Fix the telemetry recording. Change telemetryRecorded' from the buggy conditional (FALSE when truncated) to simply [s \in SlotIds |-> TRUE]. This models that telemetry always records all fields including truncation metadata.

4. Add a comment block at the top noting the fix date and which invariants were violated before the fix.

**Verify:**
Run node --test bin/quorum-truncation-integrity.test.cjs -- all tests pass. Verify TLA+ model syntax: grep -c 'truncationDetected' .planning/formal/tla/NFOutputIntegrity.tla should show increased count (was 10, should be ~14+).

**Done:** All tests pass. NFOutputIntegrity.tla updated to model the fixed system where L1 and L6 set truncationDetected and telemetry always records. All 6 invariants (TypeOK, TruncationAlwaysDetected, VerdictIntegrityPreserved, ConsensusDistinguishesTruncatedVerdicts, TelemetryRecordsTruncation, RawFieldTruncationMarked) hold in the updated model.
