# Quorum Slot Review - Task Plan 137

## Metadata
- Slot: claude-6
- Round: 1
- Mode: A (Plan Evaluation)
- Request: Improvements = true
- Artifact: .planning/quick/137-fix-empty-roster-handling-add-validation/137-PLAN.md

---

## Executive Summary

**VOTE: APPROVE WITH IMPROVEMENTS**

The task plan for fixing empty roster handling is **well-structured, atomic, and safe**. All proposed guards follow established fail-open patterns in the codebase. The breakdown is executable with low risk and clear verification steps.

---

## Detailed Assessment

### 1. Atomicity Analysis

#### Task 1: Quorum Dispatch Pipeline Guards
- **Files**: 4 (hooks/qgsd-prompt.js, bin/call-quorum-slot.cjs, bin/probe-quorum-slots.cjs, bin/unified-mcp-server.mjs)
- **Scope**: Isolated, additive defensive checks
- **Dependencies**: None - all guards are independent
- **Verification**: Atomic (grep + npm test)
- **Status**: ✓ ATOMIC

#### Task 2: Tests and Hook Sync
- **Files**: 3 (bin/qgsd.cjs, bin/qgsd.test.cjs, hooks/dist/qgsd-prompt.js)
- **Scope**: Test additions + idempotent sync/install
- **Dependencies**: Task 1 must complete first
- **Verification**: Atomic (test suite + file diff)
- **Status**: ✓ ATOMIC

**Overall Atomicity: EXCELLENT** - Tasks can be executed in sequence with clear completion gates.

---

### 2. Code Consistency Review

#### Pattern 1: qgsd-prompt.js (Line ~419)
**Context**: `orderedSlots` built from `activeSlots.map()`

**Proposed Guard**:
```javascript
if (orderedSlots.length === 0) {
  console.error('[qgsd-dispatch] WARNING: no external agents in roster — falling back to solo quorum');
  instructions = `<!-- QGSD_SOLO_MODE -->\n...`;
}
```

**Assessment**:
- ✓ Matches existing SC-4 fallback pattern (fail-open to solo)
- ✓ Guard placed before subsequent iteration/access
- ✓ Diagnostic message mirrors error logging style
- ✓ Solo mode already implemented for filtered case
- Status: **SAFE & CONSISTENT**

**Improvement**: Add dynamic slot diagnostics showing which slots are missing:
```javascript
const missingSlots = config.quorum_active 
  ? config.quorum_active.filter(s => !activeSlots.includes(s)).join(', ')
  : 'all configured';
console.error(`[qgsd-dispatch] WARNING: no external agents in roster (missing: ${missingSlots}) — falling back to solo quorum`);
```

---

#### Pattern 2: call-quorum-slot.cjs (Line ~444)
**Context**: After `providers = findProviders()` null check

**Proposed Guard**:
```javascript
if (providers.length === 0) {
  process.stderr.write('[call-quorum-slot] No providers configured in providers.json — cannot dispatch slot\n');
  process.exit(1);
}
```

**Assessment**:
- ✓ Matches existing error handling style (stderr + exit)
- ✓ Guard placed in correct sequence (null check first)
- ✓ Clear error message matches diagnostic style
- ✓ No behavior change when providers populated
- Status: **SAFE & CONSISTENT**

**Improvement**: Suggest "Run /qgsd:mcp-setup" remediation in error message.

---

#### Pattern 3: probe-quorum-slots.cjs (Line ~133)
**Context**: After `providers = findProviders()` null check, before slot lookup

**Proposed Guard**:
```javascript
if (providers.length === 0) {
  process.stderr.write('[probe-quorum-slots] No providers configured in providers.json — skipping probe\n');
  process.stdout.write('[]\n');
  process.exit(0);
}
```

**Assessment**:
- ✓ Matches existing fail-open pattern (emit empty array)
- ✓ Gracefully skips probe without crashing
- ✓ Returns valid JSON (empty array) for downstream processing
- ✓ Diagnostic logged to stderr
- Status: **SAFE & CONSISTENT**

---

#### Pattern 4: unified-mcp-server.mjs (Line ~25-30)
**Context**: After `JSON.parse(providers)`, before PROVIDER_SLOT lookup

**Proposed Guard**:
```javascript
if (!Array.isArray(providers) || providers.length === 0) {
  process.stderr.write('[unified-mcp-server] WARNING: No providers configured in providers.json — server will start with zero tools\n');
  providers = providers || [];
}
```

**Assessment**:
- ✓ Normalizes null/undefined to empty array (defensive)
- ✓ Warns instead of crashing (fail-open)
- ✓ MCP server with zero tools is valid behavior
- ✓ Matches initialization safety pattern
- Status: **SAFE & CONSISTENT**

**Improvement**: Clarify that "zero tools" means no external agents, suggest remediation.

---

#### Pattern 5: qgsd.cjs (Line ~1493)
**Context**: `renderScoreboard()` accesses `pdata.providers.map()`

**Proposed Guard**:
```javascript
const providersList = pdata.providers || [];
const roster = new Set(providersList.map(p => p.name));
const lines = buildScoreboardLines(data, { roster, providers: providersList });
```

**Assessment**:
- ✓ Standard defensive access pattern (`providers || []`)
- ✓ Used throughout codebase for optional collections
- ✓ Prevents TypeError on undefined.map()
- ✓ TUI gracefully shows empty roster message
- Status: **SAFE & CONSISTENT**

Also in `buildScoreboardLines()` (line ~1311):
```javascript
if (opts && opts.providers && opts.providers.length === 0) {
  lines.push('  {gray-fg}No agents configured in providers.json.{/}');
  lines.push('  {gray-fg}Run /qgsd:mcp-setup to add agents.{/}');
}
```

This adds helpful UX messaging instead of blank scoreboard.

---

### 3. Fail-Open Pattern Verification

All guards follow the established fail-open pattern:

| Component | Empty Case Behavior | Pattern | Status |
|-----------|-------------------|---------|--------|
| qgsd-prompt.js | Solo quorum mode | Degraded but functional | ✓ |
| call-quorum-slot.cjs | Clear error + exit | Fatal-but-informative | ✓ |
| probe-quorum-slots.cjs | Skip probe, return [] | Graceful skip | ✓ |
| unified-mcp-server.mjs | Warn, continue with 0 tools | Degraded but functional | ✓ |
| qgsd.cjs | Show "No agents" message | Degraded but functional | ✓ |

**Assessment: ALL PATTERNS CONSISTENT** ✓

---

### 4. Requirement Traceability

#### QUICK-137 Requirements Coverage

| Requirement | Implementation | Status |
|------------|-----------------|--------|
| "Quorum dispatch degrades gracefully" | qgsd-prompt.js solo mode guard | ✓ COVERED |
| "SC-4 fallback doesn't crash when orderedSlots empty" | Guard before SC-4 logic | ✓ COVERED |
| "call-quorum-slot reports clear error when providers empty" | stderr message + exit(1) | ✓ COVERED |
| "unified-mcp-server logs warning and starts with zero tools" | Stderr warning, array normalization | ✓ COVERED |
| "qgsd.cjs renderScoreboard handles empty without TypeError" | Defensive access + conditional render | ✓ COVERED |
| "All existing tests continue to pass" | No changes to populated logic | ✓ COVERED |

**Traceability: COMPLETE** ✓

---

### 5. Verification Plan Assessment

All 9 verification checks in the plan are:
- ✓ Atomic (single command or grep)
- ✓ Deterministic (string presence/absence)
- ✓ Testable (can run offline)
- ✓ Clear success criteria

Example verification chain:
```bash
# String presence checks (4)
grep 'orderedSlots.length === 0' hooks/qgsd-prompt.js
grep 'providers.length === 0' bin/call-quorum-slot.cjs
grep 'providers.length === 0' bin/probe-quorum-slots.cjs
grep 'No providers configured' bin/unified-mcp-server.mjs

# Functional checks (5)
npm test
grep 'providersList' bin/qgsd.cjs
diff hooks/qgsd-prompt.js hooks/dist/qgsd-prompt.js
grep 'orderedSlots.length === 0' ~/.claude/hooks/qgsd-prompt.js
node bin/qgsd.cjs test-empty-roster
```

**Verification Plan: SOLID** ✓

---

### 6. Risk Analysis

#### Identified Risks

1. **Hook sync timing** (LOW)
   - Risk: Manual cp + install may not reach ~/.claude/hooks/
   - Mitigation: Verification check #8 confirms installation
   - Pattern: Known and tested per MEMORY.md
   - Status: ✓ ACCEPTABLE

2. **Test coverage gaps** (MEDIUM)
   - Risk: New tests only cover `providers: []`, not:
     - `providers: null`
     - Missing providers field
     - quorum_active referencing non-existent slots
   - Mitigation: Expand test suite (see improvements below)
   - Status: ⚠ ADDRESSABLE

3. **User messaging clarity** (MEDIUM)
   - Risk: "Zero tools" in unified-mcp-server might confuse non-technical users
   - Mitigation: Add remediation hints to all messages
   - Status: ⚠ ADDRESSABLE

4. **No configuration validation on startup** (LOW)
   - Risk: Issues discovered at dispatch time, not load time
   - Mitigation: Could be follow-up task
   - Status: ✓ ACCEPTABLE

#### Overall Risk Assessment: **LOW**
- No breaking changes to existing behavior
- All guards are defensive (additive only)
- Worst case: Solo mode activation (acceptable state)

---

## Improvement Suggestions

### 1. Enhanced Diagnostics in qgsd-prompt.js

**Current**:
```javascript
if (orderedSlots.length === 0) {
  console.error('[qgsd-dispatch] WARNING: no external agents in roster — falling back to solo quorum');
  instructions = `<!-- QGSD_SOLO_MODE -->...`;
}
```

**Suggested**:
```javascript
if (orderedSlots.length === 0) {
  const missingSlots = config.quorum_active 
    ? config.quorum_active.filter(s => !activeSlots.includes(s)).join(', ')
    : 'all configured';
  console.error(
    `[qgsd-dispatch] WARNING: no external agents in roster (missing: ${missingSlots}) — falling back to solo quorum`
  );
  instructions = `<!-- QGSD_SOLO_MODE -->\nSOLO MODE: No external agents in roster...`;
}
```

**Benefit**: Users see exactly which slots are missing, enabling faster remediation.

---

### 2. Expand Test Coverage

**Add tests for**:

```javascript
// Test 1: null providers field
test('readProvidersJson: normalizes null providers to empty array', () => {
  fs.writeFileSync(PROVIDERS_JSON, JSON.stringify({ providers: null }), 'utf8');
  const result = _pure.readProvidersJson();
  assert.deepStrictEqual(result.providers, []);
});

// Test 2: missing providers field
test('readProvidersJson: handles missing providers field', () => {
  fs.writeFileSync(PROVIDERS_JSON, JSON.stringify({}), 'utf8');
  const result = _pure.readProvidersJson();
  assert.ok(Array.isArray(result.providers)); // should normalize
});

// Test 3: scoreboard with empty providers
test('buildScoreboardLines: shows helpful message for empty providers', () => {
  const lines = _pure.buildScoreboardLines(
    { models: [] },
    { providers: [], roster: new Set() }
  );
  const text = lines.join('\n');
  assert.ok(text.includes('No agents configured') || text.includes('empty'));
});

// Test 4: mixed valid/invalid slots
test('activeSlots: filters to only valid providers', () => {
  const config = { quorum_active: ['valid-1', 'nonexistent-2'] };
  const validSlots = ['valid-1', 'valid-2'];
  const activeSlots = config.quorum_active.filter(s => validSlots.includes(s));
  assert.deepStrictEqual(activeSlots, ['valid-1']);
});
```

**Benefit**: Comprehensive coverage prevents regression in edge cases.

---

### 3. Add Remediation Hints to All Messages

**call-quorum-slot.cjs**:
```javascript
process.stderr.write(
  '[call-quorum-slot] No providers configured in providers.json — ' +
  'cannot dispatch slot.\n' +
  'Remediation: Run /qgsd:mcp-setup or edit ~/.claude/qgsd.json quorum_active\n'
);
```

**unified-mcp-server.mjs**:
```javascript
process.stderr.write(
  '[unified-mcp-server] WARNING: No providers configured in providers.json — ' +
  'server will start with zero tools.\n' +
  'Remediation: Add providers to ~/.claude/qgsd.json or run /qgsd:mcp-setup\n'
);
```

**qgsd.cjs scoreboard**:
```javascript
if (opts && opts.providers && opts.providers.length === 0) {
  lines.push('  {gray-fg}No agents configured in providers.json.{/}');
  lines.push('  {gray-fg}Remediation: Run /qgsd:mcp-setup to add agents.{/}');
  lines.push('');
}
```

**Benefit**: Users can self-remediate without needing to consult docs or ask for help.

---

### 4. Consider Configuration Validation Task

**Follow-up Quick Task**: "Validate providers.json on startup"
- Load and validate structure when qgsd.cjs initializes
- Report validation errors (missing fields, invalid format) to stderr
- This would catch issues at load time rather than dispatch time
- Could be separate quick task after 137 completion

**Benefit**: Fail-fast with clear error messages during setup, not during quorum dispatch.

---

## Final Verdict

### VOTE: APPROVE WITH IMPROVEMENTS

**Summary**:
- ✓ Task breakdown is atomic and safely executable
- ✓ All guards follow established fail-open patterns
- ✓ Verification plan is comprehensive and testable
- ✓ Requirement traceability is complete
- ✓ No breaking changes to existing behavior
- ⚠ Suggested improvements enhance robustness and UX

**Conditions for Execution**:
1. Implement at minimum suggestions #1 (enhanced diagnostics) and #3 (remediation hints)
2. Expand test coverage to include null/missing providers cases (suggestion #2)
3. Verify hook sync actually reaches ~/.claude/hooks/ before merging
4. Run full test suite including new tests (existing + added)

**Risk Level**: **LOW**
- All changes are defensive additions
- Worst case: Solo mode activation when providers empty (acceptable)
- Best case: Clear error messages guide users to fix configuration

**Estimated Execution Time**: 45-60 minutes for task + improvements + verification

---

## Appendix: Code Reference

### File Locations (verified)
- hooks/qgsd-prompt.js: orderedSlots built ~line 419
- bin/call-quorum-slot.cjs: providers check ~line 444
- bin/probe-quorum-slots.cjs: providers check ~line 133
- bin/unified-mcp-server.mjs: providers parse ~line 25-30
- bin/qgsd.cjs: renderScoreboard ~line 1483, buildScoreboardLines ~line 1303

### Related Files
- bin/providers.json: Provider configuration (referenced but not modified)
- hooks/dist/qgsd-prompt.js: Sync target (must track hooks/qgsd-prompt.js)
- ~/.claude/hooks/qgsd-prompt.js: Installed hook location (target of install.js)

---

Generated by: claude-6 (Quorum Slot Review)
Mode: A (Plan Evaluation with Improvements)
Date: 2026-03-03
