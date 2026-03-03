---
phase: quick-115
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - hooks/qgsd-stop.test.js
  - hooks/qgsd-prompt.test.js
  - .formal/tla/QGSDQuorum.tla
  - .formal/tla/MCsafety.cfg
  - .formal/tla/MCliveness.cfg
autonomous: true
requirements:
  - QUICK-115

must_haves:
  truths:
    - "node --test hooks/qgsd-stop.test.js passes all 32 tests (0 failures)"
    - "node --test hooks/qgsd-prompt.test.js passes all 16 tests (3 new tests added)"
    - "QGSDQuorum.tla defines a MaxSize constant separate from |Agents|"
    - "MCsafety.cfg and MCliveness.cfg set MaxSize alongside the Agents constant"
  artifacts:
    - path: "hooks/qgsd-stop.test.js"
      provides: "TC-DEFAULT-CEIL-BLOCK fixed — PLAN.md artifact renamed to quick-115-PLAN.md so -PLAN.md pattern matches"
    - path: "hooks/qgsd-prompt.test.js"
      provides: "TC-PROMPT-N-CAP, TC-PROMPT-SOLO, TC-PROMPT-PREFER-SUB-DEFAULT tests added"
    - path: ".formal/tla/QGSDQuorum.tla"
      provides: "MaxSize CONSTANT declared; quorum threshold uses MaxSize not ceil(N/2)"
    - path: ".formal/tla/MCsafety.cfg"
      provides: "MaxSize = 5 constant assignment added"
    - path: ".formal/tla/MCliveness.cfg"
      provides: "MaxSize = 3 constant assignment added"
  key_links:
    - from: "TC-DEFAULT-CEIL-BLOCK"
      to: "ARTIFACT_PATTERNS in qgsd-stop.js"
      via: "commit --files quick-115-PLAN.md matches /-PLAN\\.md/ pattern"
      pattern: "-PLAN\\.md"
    - from: "TC-PROMPT-N-CAP"
      to: "qgsd-prompt.js externalSlotCap"
      via: "capped cappedSlots.length = quorumSizeOverride - 1"
      pattern: "QUORUM SIZE OVERRIDE.*--n"
    - from: "QGSDQuorum.tla MaxSize"
      to: "MCsafety.cfg / MCliveness.cfg"
      via: "CONSTANTS block assignment"
      pattern: "MaxSize = [0-9]"
---

<objective>
Fix one failing stop-hook test, add three missing prompt-hook tests, and extend the TLA+ model with a MaxSize constant.

Purpose: Bring the test suite to 100% pass rate and model the --n N ceiling override as a first-class TLA+ parameter.
Output: Fixed qgsd-stop.test.js (32/32 passing), extended qgsd-prompt.test.js (16/16 passing), updated QGSDQuorum.tla + two MC configs.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

## Root cause summary

### Stop hook — TC-DEFAULT-CEIL-BLOCK fails (line 1206 of qgsd-stop.test.js)

The test's transcript uses:
  `node /path/gsd-tools.cjs commit "docs: plan" --files PLAN.md`

`hasArtifactCommit` in qgsd-stop.js requires the commit to reference a planning artifact
matching one of the ARTIFACT_PATTERNS (line 306):
  `/-PLAN\.md/`   (requires a hyphen before PLAN.md, e.g. `quick-115-PLAN.md`)

`PLAN.md` alone does NOT match. So `isDecisionTurn = false` → hook exits 0 (pass) even
with only 1 slot call. TC-DEFAULT-CEIL-PASS also exits 0, but for the wrong reason.

Fix: change `--files PLAN.md` → `--files quick-115-PLAN.md` in BOTH TC-DEFAULT-CEIL-PASS
and TC-DEFAULT-CEIL-BLOCK (so both tests exercise the ceiling correctly).

### Prompt hook — three tests missing

1. TC-PROMPT-N-CAP: `--n 3` on a prompt with 5 active slots must cap the injected
   step list to 2 external slots (N-1=2). Verify via
   `QUORUM SIZE OVERRIDE (--n 3)` in additionalContext AND only 2 Task lines.

2. TC-PROMPT-SOLO: `--n 1` injects `<!-- QGSD_SOLO_MODE -->` and the text
   `SOLO MODE ACTIVE (--n 1)`. No Task slot lines should appear.

3. TC-PROMPT-PREFER-SUB-DEFAULT: config with `quorum_active` containing mixed
   sub/api slots but NO `quorum.preferSub` key → hook defaults `preferSub = true`
   (line 190: `!(config.quorum && config.quorum.preferSub === false)`).
   Verify sub slot appears before api slot in the generated step list.

### TLA+ — MaxSize not modelled

QGSDQuorum.tla uses `n * 2 >= N` (majority of |Agents|). The --n N config override
controls how many external models are required (N-1), independent of |Agents|.
MaxSize must be a separate TLC CONSTANT so model checkers can verify ceiling-override
properties (e.g. quorum satisfied when successCount >= MaxSize, not just majority).

Changes:
- Add `MaxSize` to the CONSTANTS block (with ASSUME MaxSize \in 1..N)
- Keep existing `N == Cardinality(Agents)` for backwards compat
- Add `QuorumCeilingMet` safety invariant: if DECIDED, successCount >= MaxSize
- MCsafety.cfg: add `MaxSize = 5` (same as |Agents|, majority case)
- MCliveness.cfg: add `MaxSize = 3` (same as |Agents|, majority case)

Note: the header says "GENERATED — do not edit by hand" but the generate script
(bin/generate-formal-specs.cjs) does not yet support MaxSize. Edit the .tla and
.cfg files directly and update the header comment to:
  `* Hand-extended: MaxSize constant added (quick-115). Regenerate with caution.`
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix TC-DEFAULT-CEIL-BLOCK and add missing prompt-hook tests</name>
  <files>hooks/qgsd-stop.test.js</files>
  <files>hooks/qgsd-prompt.test.js</files>
  <action>
**hooks/qgsd-stop.test.js — fix TC-DEFAULT-CEIL-PASS and TC-DEFAULT-CEIL-BLOCK**

Both tests at lines ~1162 and ~1206 use `--files PLAN.md` in the Bash commit block.
Change both occurrences to `--files quick-115-PLAN.md` so the `-PLAN.md` ARTIFACT_PATTERN
matches and `hasArtifactCommit` returns true.

Specific lines to update:
- TC-DEFAULT-CEIL-PASS (~line 1185): `bashCommitBlock('node /path/gsd-tools.cjs commit "docs: plan" --files PLAN.md')`
  → `bashCommitBlock('node /path/gsd-tools.cjs commit "docs: plan" --files quick-115-PLAN.md')`
- TC-DEFAULT-CEIL-BLOCK (~line 1229): same replacement

After the fix, TC-DEFAULT-CEIL-PASS passes because 2 slots called = ceiling satisfied.
After the fix, TC-DEFAULT-CEIL-BLOCK blocks because isDecisionTurn=true and only 1/2 slots called.

**hooks/qgsd-prompt.test.js — add 3 new tests at the end of the file**

Test 1 — TC-PROMPT-N-CAP:
```
test('TC-PROMPT-N-CAP: --n 3 caps injected slot list to N-1=2 external slots', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-nc-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1', 'opencode-1', 'copilot-1', 'claude-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase --n 3', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    // Must announce the override
    assert.ok(ctx.includes('QUORUM SIZE OVERRIDE (--n 3)'), 'must announce --n 3 override');
    // Must cap to 2 Task lines (N-1 = 2)
    const taskLineCount = (ctx.match(/Task\(subagent_type="qgsd-quorum-slot-worker"/g) || []).length;
    assert.strictEqual(taskLineCount, 2, '--n 3 must produce exactly 2 slot-worker Task lines (N-1=2)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

Test 2 — TC-PROMPT-SOLO:
```
test('TC-PROMPT-SOLO: --n 1 injects SOLO MODE ACTIVE, no Task slot lines', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-solo-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({ quorum_active: ['codex-1', 'gemini-1'] }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase --n 1', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    assert.ok(ctx.includes('SOLO MODE ACTIVE (--n 1)'), 'must inject SOLO MODE ACTIVE marker');
    assert.ok(ctx.includes('<!-- QGSD_SOLO_MODE -->'), 'must include QGSD_SOLO_MODE XML comment');
    const taskLineCount = (ctx.match(/Task\(subagent_type="qgsd-quorum-slot-worker"/g) || []).length;
    assert.strictEqual(taskLineCount, 0, '--n 1 solo mode must produce zero slot-worker Task lines');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```

Test 3 — TC-PROMPT-PREFER-SUB-DEFAULT:
```
test('TC-PROMPT-PREFER-SUB-DEFAULT: no preferSub config → defaults true, sub slots appear before api slots', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qgsd-prompt-psub-'));
  try {
    spawnSync('git', ['init'], { cwd: tempDir, encoding: 'utf8', timeout: 5000 });
    const claudeDir = path.join(tempDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    // sub-1 listed AFTER api-1 in quorum_active — default preferSub must reorder
    fs.writeFileSync(
      path.join(claudeDir, 'qgsd.json'),
      JSON.stringify({
        quorum_active: ['api-slot-1', 'sub-slot-1'],
        agent_config: {
          'api-slot-1': { auth_type: 'api' },
          'sub-slot-1': { auth_type: 'sub' },
        },
        // No quorum.preferSub key → defaults to true
      }),
      'utf8'
    );
    const { stdout } = runHook({ prompt: '/qgsd:plan-phase', cwd: tempDir });
    const ctx = JSON.parse(stdout).hookSpecificOutput.additionalContext;
    const subPos = ctx.indexOf('sub-slot-1');
    const apiPos = ctx.indexOf('api-slot-1');
    assert.ok(subPos !== -1, 'sub-slot-1 must appear in step list');
    assert.ok(apiPos !== -1, 'api-slot-1 must appear in step list');
    assert.ok(subPos < apiPos, 'sub slot must appear before api slot (preferSub default=true)');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
```
  </action>
  <verify>
    node --test hooks/qgsd-stop.test.js 2>&1 | tail -10
    node --test hooks/qgsd-prompt.test.js 2>&1 | tail -10
  </verify>
  <done>
    Stop hook: 32/32 pass (0 failures). TC-DEFAULT-CEIL-BLOCK now correctly blocks.
    Prompt hook: 16/16 pass (3 new tests added and passing).
  </done>
</task>

<task type="auto">
  <name>Task 2: Add MaxSize constant to QGSDQuorum.tla and both MC configs</name>
  <files>.formal/tla/QGSDQuorum.tla</files>
  <files>.formal/tla/MCsafety.cfg</files>
  <files>.formal/tla/MCliveness.cfg</files>
  <action>
**.formal/tla/QGSDQuorum.tla**

1. Update the header comment block — change:
   `* GENERATED — do not edit by hand.`
   to:
   `* Hand-extended: MaxSize constant added (quick-115). Regenerate with caution.`

2. Add `MaxSize` to the CONSTANTS block (after `MaxDeliberation`):
   ```
   CONSTANTS
       Agents,          \* Set of quorum model slots (e.g., {"a1","a2","a3","a4","a5"})
       MaxDeliberation, \* Maximum deliberation rounds before forced DECIDED (default: 7)
       MaxSize          \* Quorum ceiling: minimum successful responses required (= --n N - 1 or config.maxSize)
   ```

3. Add ASSUME for MaxSize after the existing ASSUME for MaxDeliberation:
   ```
   ASSUME MaxSize \in 1..N
   ```
   Note: this ASSUME references N, which is defined as `N == Cardinality(Agents)`. Place it
   AFTER the `N ==` definition, not before.

4. Add a `QuorumCeilingMet` safety invariant in the "Safety invariants" section
   (after `MinQuorumMet`):
   ```
   \* QuorumCeilingMet: if DECIDED via approval, at least MaxSize agents approved.
   QuorumCeilingMet ==
       phase = "DECIDED" =>
           (successCount >= MaxSize \/ deliberationRounds >= MaxDeliberation)
   ```

   Keep the existing `MinQuorumMet` invariant unchanged — it models the majority-based
   ceiling. `QuorumCeilingMet` models the explicit --n N ceiling.

**.formal/tla/MCsafety.cfg**

Add `MaxSize = 5` to the CONSTANTS block (after `MaxDeliberation = 7`):
```
CONSTANTS
    a1 = a1
    a2 = a2
    a3 = a3
    a4 = a4
    a5 = a5
    Agents = {a1, a2, a3, a4, a5}
    MaxDeliberation = 7
    MaxSize = 5
```

Add the new invariant to be checked:
```
INVARIANT QuorumCeilingMet
```

Update the header comment:
```
\* Hand-extended: MaxSize constant added (quick-115). Regenerate with caution.
```

**.formal/tla/MCliveness.cfg**

Add `MaxSize = 3` to the CONSTANTS block (after `MaxDeliberation = 7`):
```
CONSTANTS
    a1 = a1
    a2 = a2
    a3 = a3
    Agents = {a1, a2, a3}
    MaxDeliberation = 7
    MaxSize = 3
```

Update the header comment:
```
\* Hand-extended: MaxSize constant added (quick-115). Regenerate with caution.
```

Liveness config does not check INVARIANT (only PROPERTY EventualConsensus) — do not add
`INVARIANT QuorumCeilingMet` to MCliveness.cfg.
  </action>
  <verify>
    node bin/run-tlc.cjs MCsafety 2>&1 | tail -20
    # If TLC is not installed, verify the file structure is correct by parsing:
    grep -n "MaxSize" .formal/tla/QGSDQuorum.tla .formal/tla/MCsafety.cfg .formal/tla/MCliveness.cfg
  </verify>
  <done>
    QGSDQuorum.tla has MaxSize in CONSTANTS with ASSUME MaxSize \in 1..N and QuorumCeilingMet invariant.
    MCsafety.cfg has MaxSize = 5 and INVARIANT QuorumCeilingMet.
    MCliveness.cfg has MaxSize = 3.
    grep confirms all three files contain "MaxSize".
    If TLC available: MCsafety passes all invariants including QuorumCeilingMet.
  </done>
</task>

</tasks>

<verification>
node --test hooks/qgsd-stop.test.js 2>&1 | grep -E "^ℹ (tests|pass|fail)"
node --test hooks/qgsd-prompt.test.js 2>&1 | grep -E "^ℹ (tests|pass|fail)"
grep -c "MaxSize" .formal/tla/QGSDQuorum.tla .formal/tla/MCsafety.cfg .formal/tla/MCliveness.cfg
</verification>

<success_criteria>
- Stop hook: 32 tests, 32 pass, 0 fail
- Prompt hook: 16 tests, 16 pass, 0 fail
- QGSDQuorum.tla contains MaxSize in CONSTANTS, ASSUME MaxSize \in 1..N, and QuorumCeilingMet invariant
- MCsafety.cfg contains MaxSize = 5 and INVARIANT QuorumCeilingMet
- MCliveness.cfg contains MaxSize = 3
</success_criteria>

<output>
After completion, create `.planning/quick/115-add-missing-unit-tests-for-default-ceili/115-SUMMARY.md`
</output>
