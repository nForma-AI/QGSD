---
phase: quick-242
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - bin/nForma.cjs
autonomous: true
must_haves:
  truths:
    - "Gate Scoring menu item appears under Reqs (F2) module in TUI"
    - "Gate Scoring page displays per-model gate maturity levels"
    - "Gate Scoring page displays aggregate A/B/C scores"
    - "Gate Scoring page displays recent promotion changelog entries"
    - "Solve (F5) ASCII art renders as S shape instead of T"
    - "Screenshot mode _getModules() includes Gate Scoring item"
  artifacts:
    - path: "bin/nForma.cjs"
      provides: "Gate Scoring flow + Solve art fix"
      contains: "gateScoring"
  key_links:
    - from: "bin/nForma.cjs gateScoreFlow"
      to: "bin/compute-per-model-gates.cjs"
      via: "spawnSync with --aggregate --json"
      pattern: "compute-per-model-gates.*--aggregate.*--json"
requirements: []
---

<objective>
Add a Gate Scoring page to the Reqs (F2) module in the nForma TUI and fix the Solve (F5) ASCII art from T-shape to S-shape.

Purpose: Surfaces gate maturity pipeline data (per-model scores, aggregate A/B/C, promotion history) directly in the TUI so the user can inspect gate progression without running CLI commands manually.
Output: Updated bin/nForma.cjs with new menu item, flow handler, action routing, screenshot mirror, and corrected ASCII art.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/nf/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/nf/templates/summary.md
</execution_context>

<context>
@bin/nForma.cjs
@bin/compute-per-model-gates.cjs
@.planning/formal/promotion-changelog.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Gate Scoring page to Reqs module and fix Solve ASCII art</name>
  <files>bin/nForma.cjs</files>
  <action>
Three changes to bin/nForma.cjs:

**1. Add Gate Scoring menu item to Reqs (F2) module (MODULES array, line ~398):**
After the `Coverage Gaps` item, add:
```
{ label: '  Gate Scoring',           action: 'req-gate-scoring' },
```

**2. Add Gate Scoring item to screenshot _getModules() (line ~84):**
In the Reqs items array inside `_getModules()` function (around line 80-86), add after `Coverage Gaps`:
```
{ label: '  Gate Scoring' },
```

**3. Add gateScoreFlow() function:**
Place it after the `reqCoverageGapsFlow` function (around line 3099). Follow the same pattern as `reqCoverageGapsFlow` — synchronous setContent with blessed markup. Implementation:

```javascript
function gateScoreFlow() {
  try {
    const result = spawnSync('node', [
      path.join(__dirname, 'compute-per-model-gates.cjs'), '--aggregate', '--json'
    ], { encoding: 'utf8', timeout: 15000 });

    if (result.status !== 0) {
      setContent('Gate Scoring', `{red-fg}Error running gate computation: ${(result.stderr || '').slice(0, 200)}{/}`);
      return;
    }

    const data = JSON.parse(result.stdout);
    const lines = [];

    // Header: aggregate scores
    lines.push('{bold}Gate Scoring — Aggregate{/bold}');
    lines.push('─'.repeat(60));
    const s = data.scores || {};
    lines.push(`  Gate A pass: {bold}${s.gate_a_pass ?? '?'}{/bold} / ${data.total_models ?? '?'}`);
    lines.push(`  Gate B pass: {bold}${s.gate_b_pass ?? '?'}{/bold} / ${data.total_models ?? '?'}`);
    lines.push(`  Gate C pass: {bold}${s.gate_c_pass ?? '?'}{/bold} / ${data.total_models ?? '?'}`);
    lines.push(`  Avg layer maturity: {bold}${(s.avg_layer_maturity ?? 0).toFixed(2)}{/bold}`);
    lines.push('');

    // Per-model table: group by maturity level
    const pm = data.per_model || {};
    const models = Object.keys(pm);
    const byLevel = { HARD_GATE: [], SOFT_GATE: [], ADVISORY: [] };
    for (const m of models) {
      const level = pm[m].gate_maturity || 'ADVISORY';
      if (!byLevel[level]) byLevel[level] = [];
      byLevel[level].push(m);
    }

    const levelColors = { HARD_GATE: '{green-fg}', SOFT_GATE: '{yellow-fg}', ADVISORY: '{red-fg}' };
    lines.push('{bold}Per-Model Maturity{/bold}');
    lines.push('─'.repeat(60));
    for (const level of ['HARD_GATE', 'SOFT_GATE', 'ADVISORY']) {
      const arr = byLevel[level] || [];
      const clr = levelColors[level] || '';
      lines.push(`  ${clr}${level}{/} (${arr.length})`);
      // Show first 10 models per level, truncate rest
      const show = arr.slice(0, 10);
      for (const m of show) {
        const short = m.replace(/^\.planning\/formal\//, '');
        const info = pm[m];
        const abc = `A:${info.gate_a ? 'Y' : 'N'} B:${info.gate_b ? 'Y' : 'N'} C:${info.gate_c ? 'Y' : 'N'}`;
        lines.push(`    ${short}  ${abc}`);
      }
      if (arr.length > 10) lines.push(`    ... and ${arr.length - 10} more`);
      lines.push('');
    }

    // Promotion changelog (last 10 entries)
    const changelogPath = path.join(__dirname, '..', '.planning', 'formal', 'promotion-changelog.json');
    if (fs.existsSync(changelogPath)) {
      const changelog = JSON.parse(fs.readFileSync(changelogPath, 'utf8'));
      const recent = changelog.slice(-10).reverse();
      if (recent.length > 0) {
        lines.push('{bold}Recent Promotions/Demotions{/bold}');
        lines.push('─'.repeat(60));
        for (const entry of recent) {
          const short = (entry.model || '').replace(/^\.planning\/formal\//, '');
          const arrow = entry.to_level === 'ADVISORY' ? '{red-fg}v{/}' : '{green-fg}^{/}';
          const ts = (entry.timestamp || '').slice(0, 16).replace('T', ' ');
          lines.push(`  ${arrow} ${short}: ${entry.from_level} -> ${entry.to_level}  {gray-fg}${ts}{/}`);
        }
      }
    }

    setContent('Gate Scoring', lines.join('\n'));
  } catch (err) {
    setContent('Gate Scoring', `{red-fg}Error: ${err.message}{/}`);
  }
}
```

**4. Wire action routing:**
In the action dispatcher (around line 2801, after the `req-gaps` case), add:
```
else if (action === 'req-gate-scoring') gateScoreFlow();
```

**5. Fix Solve ASCII art (line ~429):**
Change the Solve module art from `['\u2580\u2588\u2580', ' \u2588 ', ' \u2588 ']` (T shape) to `['\\u2584\\u2580\\u2580', ' \\u2580\\u2584', '\\u2584\\u2584\\u2580']` which renders as an S shape using block characters. The actual values should be: `['\u2584\u2580\u2580', ' \u2580\u2584', '\u2584\u2584\u2580']`.

Verify the S shape renders correctly: top row has bottom-half left + top-half middle + top-half right (curves right), middle row curves, bottom row curves left.
  </action>
  <verify>
1. `grep 'req-gate-scoring' bin/nForma.cjs` — returns matches in MODULES items, _getModules screenshot, and action router
2. `grep 'gateScoreFlow' bin/nForma.cjs` — returns function definition and call site
3. `grep 'compute-per-model-gates.*aggregate.*json' bin/nForma.cjs` — confirms data source wiring
4. `node -e "require('./bin/nForma.cjs')" --screenshot reqs 2>&1 | grep -i gate` — Gate Scoring appears in screenshot output
5. `grep "art:" bin/nForma.cjs` near the Solve module does NOT contain the old T-shape pattern
  </verify>
  <done>
Gate Scoring menu item visible under Reqs (F2) with working flow that displays aggregate scores, per-model maturity breakdown, and promotion changelog. Solve (F5) ASCII art renders as S-shape. Screenshot mode mirrors the new menu item.
  </done>
</task>

</tasks>

<verification>
- `node bin/nForma.cjs --screenshot reqs` shows Gate Scoring in menu
- Manual TUI launch: F2 -> Gate Scoring displays data from compute-per-model-gates.cjs
- Solve module art in MODULES array uses S-shaped block characters
</verification>

<success_criteria>
1. Gate Scoring page renders aggregate gate A/B/C counts and average maturity
2. Gate Scoring page shows per-model breakdown grouped by maturity level (HARD_GATE, SOFT_GATE, ADVISORY)
3. Gate Scoring page shows recent promotion changelog entries
4. Solve ASCII art renders as S, not T
5. Screenshot mode _getModules() includes Gate Scoring
</success_criteria>

<output>
After completion, create `.planning/quick/242-add-gate-scoring-page-to-tui-under-reqs-/242-SUMMARY.md`
</output>
