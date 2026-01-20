---
name: gsd:settings
description: Configure GSD workflow toggles (research, plan checker, verifier)
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

<objective>
Allow users to toggle workflow agents on/off via interactive settings.

Updates `.planning/config.json` with workflow preferences that control whether research, plan checking, and verification agents are spawned.
</objective>

<process>

## 1. Validate Environment

```bash
ls .planning/config.json 2>/dev/null
```

**If not found:** Error - run `/gsd:new-project` first.

## 2. Read Current Config

```bash
cat .planning/config.json
```

Parse current values (default to `true` if not present):
- `workflow.research` — spawn researcher during plan-phase
- `workflow.plan_check` — spawn plan checker during plan-phase
- `workflow.verifier` — spawn verifier during execute-phase

## 3. Present Settings

Use AskUserQuestion with current values shown:

```
AskUserQuestion([
  {
    question: "Spawn Plan Researcher? (researches domain before planning)",
    header: "Research",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Research phase goals before planning" },
      { label: "No", description: "Skip research, plan directly" }
    ]
  },
  {
    question: "Spawn Plan Checker? (verifies plans before execution)",
    header: "Plan Check",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Verify plans meet phase goals" },
      { label: "No", description: "Skip plan verification" }
    ]
  },
  {
    question: "Spawn Execution Verifier? (verifies phase completion)",
    header: "Verifier",
    multiSelect: false,
    options: [
      { label: "Yes", description: "Verify must-haves after execution" },
      { label: "No", description: "Skip post-execution verification" }
    ]
  }
])
```

**Pre-select based on current config values.**

## 4. Update Config

Merge new workflow settings into existing config.json:

```json
{
  ...existing_config,
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false
  }
}
```

Write updated config to `.planning/config.json`.

## 5. Confirm Changes

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SETTINGS UPDATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Setting              | Value |
|----------------------|-------|
| Plan Researcher      | {On/Off} |
| Plan Checker         | {On/Off} |
| Execution Verifier   | {On/Off} |

These settings apply to future /gsd:plan-phase and /gsd:execute-phase runs.

Override per-invocation with flags:
- /gsd:plan-phase --research (force research)
- /gsd:plan-phase --skip-research (skip research)
- /gsd:plan-phase --skip-verify (skip plan check)
```

</process>

<success_criteria>
- [ ] Current config read
- [ ] User presented with 3 toggle questions
- [ ] Config updated with workflow section
- [ ] Changes confirmed to user
</success_criteria>
