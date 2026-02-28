---
phase: quick-118
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
autonomous: true
requirements:
  - DOCS-118
must_haves:
  truths:
    - "README describes the blessed TUI manager and how to launch it"
    - "README documents all formal verification tools (TLA+, Alloy, PRISM, Petri nets) with installation instructions"
    - "README explains how to run the full formal verification pipeline via run-formal-verify.cjs"
    - "README section on the TUI covers the full capability set (list/add/clone/edit/remove/reorder/health/login/provider-keys/batch-rotate/live-health/update-agents/export/import)"
    - "README installation instructions for TLA+ (Java 17 + tla2tools.jar), Alloy (jar), and PRISM cover the real prerequisites"
  artifacts:
    - path: "README.md"
      provides: "Updated user-facing docs with TUI + formal verification sections"
      contains: "manage-agents-blessed"
  key_links:
    - from: "README.md blessed TUI section"
      to: "bin/manage-agents-blessed.cjs"
      via: "invocation command node bin/manage-agents-blessed.cjs"
      pattern: "manage-agents-blessed"
    - from: "README.md formal verification section"
      to: "bin/run-formal-verify.cjs"
      via: "invocation command node bin/run-formal-verify.cjs"
      pattern: "run-formal-verify"
---

<objective>
Update README.md with two missing documentation sections:

1. The blessed TUI agent manager (`bin/manage-agents-blessed.cjs`) — a full-featured keyboard-navigable split-pane terminal UI for managing quorum agents that was built but never documented publicly.

2. The formal verification pipeline (TLA+, Alloy, PRISM, Petri nets) with installation prerequisites and run commands — critical infrastructure for verifying quorum protocol correctness that has no user-facing documentation.

Purpose: Close the documentation gap between what QGSD actually ships and what users know about.
Output: Updated README.md with a new "Agent Manager TUI" subsection under Getting Started and a new "Formal Verification" section.
</objective>

<execution_context>
@/Users/jonathanborduas/.claude/qgsd/workflows/execute-plan.md
@/Users/jonathanborduas/.claude/qgsd/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

# Key facts about what exists
# bin/manage-agents-blessed.cjs: 1759-line blessed-based TUI, invoked via `node bin/manage-agents-blessed.cjs`
# MENU_ITEMS: List Agents / Add Agent / Clone Slot / Edit Agent / Remove Agent / Reorder Agents /
#   Check Agent Health / Login/Auth / Provider Keys / Batch Rotate Keys / Live Health /
#   Update Agents / Settings / Tune Timeouts / Set Update Policy / Export Roster / Import Roster / Exit
# Provider presets: AkashML, Together.xyz, Fireworks.ai, Custom URL, None
# PROVIDER_KEY_NAMES: AKASHML_API_KEY, TOGETHER_API_KEY, FIREWORKS_API_KEY
#
# Formal verification:
# - TLA+: formal/tla/*.tla, tla2tools.jar (~50MB, gitignored), requires Java 17+
#   - run-tlc.cjs MCsafety / MCliveness / MCoscillation / MCconvergence / MCbreaker / MCdeliberation / MCprefilter / MCaccount-manager
# - Alloy: formal/alloy/*.als, org.alloytools.alloy.dist.jar (gitignored)
#   - run-alloy.cjs quorum-votes / scoreboard-recompute / availability-parsing / transcript-scan / install-scope / taxonomy-safety / account-pool-structure
# - PRISM: formal/prism/*.pm, requires PRISM CLI
#   - run-prism.cjs quorum / oauth-rotation / mcp-availability
# - Petri nets: formal/petri/*.dot -> *.svg via @hpcc-js/wasm-graphviz (included as devDep)
#   - generate-petri-net.cjs
# - Master runner: node bin/run-formal-verify.cjs [--only=tla|alloy|prism|petri|generate]
#   - 21 steps total: 2 generate, 2 petri, 8 TLA+, 7 Alloy, 2 PRISM
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Agent Manager TUI section to README</name>
  <files>README.md</files>
  <action>
Read README.md fully first. Then add a new "Agent Manager TUI" subsection inside the "Getting Started" section, after the existing "Setting Up Your Quorum" block (after the `</details>` that closes the "Manual setup (advanced)" block, before the NOTE blockquote about "QGSD works with as few as one quorum member").

The new subsection content:

```markdown
### Agent Manager TUI

```bash
node bin/manage-agents-blessed.cjs
```

A full-featured keyboard-navigable terminal interface for managing your quorum agents. Requires a local clone (`git clone https://github.com/LangBlaze-AI/QGSD.git`).

The TUI is a split-pane screen: left panel is the menu, right panel shows agent list or context for the selected action.

**Capabilities:**

| Action | What it does |
|--------|--------------|
| List Agents | Show all configured slots with provider, model, key status |
| Add Agent | Add a new slot with provider preset, model, and API key |
| Clone Slot | Duplicate an existing slot to a new name |
| Edit Agent | Update provider, base URL, model, or key for a slot |
| Remove Agent | Delete a slot from `~/.claude.json` |
| Reorder Agents | Drag slots up/down to change quorum priority order |
| Check Agent Health | Ping a single slot and show latency + model response |
| Login / Auth | Open the auth flow for CLI-based agents (gh, gemini, codex) |
| Provider Keys | View and update global API keys (AkashML, Together.xyz, Fireworks.ai) |
| Batch Rotate Keys | Rotate API keys across multiple slots in one operation |
| Live Health | Poll all configured slots simultaneously and display health table |
| Update Agents | Pull the latest version of all MCP server packages |
| Settings | View current quorum composition and configuration |
| Tune Timeouts | Adjust per-slot timeout values |
| Set Update Policy | Configure auto-update behavior per slot |
| Export Roster | Save the full agent configuration to a portable JSON file |
| Import Roster | Load agent configuration from a previously exported file |

**Navigation:** arrow keys to move, Enter to select, Escape or `q` to go back or exit.
```

Place this BEFORE the existing `> [!NOTE]` blockquote about "QGSD works with as few as one quorum member."
  </action>
  <verify>
grep -n "Agent Manager TUI" /Users/jonathanborduas/code/QGSD/README.md
grep -n "manage-agents-blessed" /Users/jonathanborduas/code/QGSD/README.md
grep -n "Clone Slot\|Live Health\|Batch Rotate\|Export Roster" /Users/jonathanborduas/code/QGSD/README.md
  </verify>
  <done>
README.md contains "Agent Manager TUI" subsection with full capability table and launch command `node bin/manage-agents-blessed.cjs`. All 17 menu actions documented.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add Formal Verification section to README</name>
  <files>README.md</files>
  <action>
After the "Atomic Git Commits" subsection (end of the `### Atomic Git Commits` block, before `### Modular by Design`), add a new `### Formal Verification` subsection inside the "Why It Works" section.

The new subsection content:

```markdown
### Formal Verification

QGSD ships formal models of its core protocols — quorum consensus, circuit breaker, account manager, MCP availability — verified by four independent tools: TLA+, Alloy, PRISM, and Petri nets.

These aren't documentation. They're executable specs that check safety, liveness, and probabilistic properties of the protocols that govern how your planning decisions get made.

#### Prerequisites

**TLA+ (model checker):** Requires Java 17+.

```bash
# Install Java 17: https://adoptium.net/
# Then download tla2tools.jar (~50MB, gitignored):
curl -L https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar \
     -o formal/tla/tla2tools.jar
```

**Alloy (relational logic):** Download from [alloytools.org](https://alloytools.org/download.html). Place the `org.alloytools.alloy.dist.jar` in `formal/alloy/`. Java 17+ required.

**PRISM (probabilistic model checker):** Install from [prismmodelchecker.org](https://www.prismmodelchecker.org/). Ensure `prism` is on your PATH.

**Petri nets:** Rendered via `@hpcc-js/wasm-graphviz` (included as a dev dependency — no additional install needed).

#### Running Verification

```bash
# Full pipeline — all 21 steps (generate → Petri → TLA+ → Alloy → PRISM)
node bin/run-formal-verify.cjs

# Subsets
node bin/run-formal-verify.cjs --only=tla      # 8 TLA+ model checks
node bin/run-formal-verify.cjs --only=alloy    # 7 Alloy assertions
node bin/run-formal-verify.cjs --only=prism    # 2 PRISM analyses (quorum + oauth-rotation)
node bin/run-formal-verify.cjs --only=petri    # 2 Petri net renders
node bin/run-formal-verify.cjs --only=generate # Regenerate specs from source only
```

Exit code 0 = all checks pass. Exit code 1 = at least one violation or configuration error.

#### What Gets Checked

| Tool | Models | Properties |
|------|--------|------------|
| TLA+ | Quorum, CircuitBreaker, Oscillation, Convergence, Deliberation, PreFilter, AccountManager, MCP Environment | Safety invariants + liveness (quorum always terminates, breaker never infinite-loops) |
| Alloy | Quorum votes, scoreboard recompute, availability parsing, transcript scan, install scope, taxonomy safety, account pool structure | Structural correctness (no impossible states) |
| PRISM | Quorum consensus, OAuth rotation, MCP availability | Probabilistic reachability (convergence probability, expected rounds to consensus) |
| Petri nets | Quorum flow, account manager lifecycle | Visual concurrency model (token flow, place/transition reachability) |

Individual runners are in `bin/run-tlc.cjs`, `bin/run-alloy.cjs`, `bin/run-prism.cjs`, and `bin/generate-petri-net.cjs`. Spec source files are in `formal/tla/`, `formal/alloy/`, `formal/prism/`, and `formal/petri/`.
```
  </action>
  <verify>
grep -n "Formal Verification" /Users/jonathanborduas/code/QGSD/README.md
grep -n "run-formal-verify\|tla2tools\|alloytools\|prismmodelchecker\|PRISM\|Alloy\|Petri" /Users/jonathanborduas/code/QGSD/README.md | head -20
  </verify>
  <done>
README.md contains "Formal Verification" subsection under "Why It Works" with: prerequisites for TLA+ (Java 17 + curl command), Alloy (jar), PRISM (CLI), Petri nets (devDep); run commands for full pipeline and subsets; capability table covering all 4 tools. All installation instructions are accurate to the actual prerequisite files in the repo.
  </done>
</task>

</tasks>

<verification>
After both tasks:
1. `grep -c "Agent Manager TUI\|Formal Verification\|manage-agents-blessed\|run-formal-verify" /Users/jonathanborduas/code/QGSD/README.md` — returns 4+ (each term present)
2. `grep -n "tla2tools\|alloytools\|prismmodelchecker" /Users/jonathanborduas/code/QGSD/README.md` — returns 3 lines (one per tool installation instruction)
3. `grep -c "Clone Slot\|Live Health\|Batch Rotate\|Export Roster\|Import Roster" /Users/jonathanborduas/code/QGSD/README.md` — returns 5 (all capability rows present)
4. `node -e "require('fs').readFileSync('/Users/jonathanborduas/code/QGSD/README.md','utf8').length" ` — significantly longer than original 875 lines
</verification>

<success_criteria>
README.md accurately documents:
- The blessed TUI manager with full capability table and launch command
- Formal verification pipeline: TLA+ (Java 17 + tla2tools.jar), Alloy (jar), PRISM (CLI install), Petri nets (devDep)
- `node bin/run-formal-verify.cjs` as the master run command with --only flags
- Individual tool capabilities table

Both sections are placed in logical locations: TUI under "Getting Started", Formal Verification under "Why It Works".
</success_criteria>

<output>
After completion, create `.planning/quick/118-update-all-user-facing-documentation-rea/118-SUMMARY.md`
</output>
