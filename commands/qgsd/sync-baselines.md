---
name: qgsd:sync-baselines
description: Sync baseline requirements into .formal/requirements.json (idempotent merge by text match)
argument-hint: [--profile <web|mobile|desktop|api|cli|library>]
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
Sync baseline requirements from the QGSD defaults into `.formal/requirements.json`. Reads the project profile from `.planning/config.json` (field: `profile`) unless `--profile` flag is provided. Runs `node bin/sync-baseline-requirements.cjs`, displays results, and commits if requirements were added.
</objective>

<process>

## Step 1: Determine Profile

Parse `--profile` from $ARGUMENTS if present.

Otherwise read `.planning/config.json` and extract the `profile` field:

```bash
PROFILE=$(node -e "const c = require('./.planning/config.json'); console.log(c.profile || '')")
```

If neither available, ask the user:

```
AskUserQuestion([
  {
    header: "Profile",
    question: "Which project profile should be used for baseline requirements?",
    multiSelect: false,
    options: [
      { label: "web", description: "Web Application" },
      { label: "mobile", description: "Mobile Application" },
      { label: "desktop", description: "Desktop Application" },
      { label: "api", description: "API Service" },
      { label: "cli", description: "CLI Tool" },
      { label: "library", description: "Library / Package" }
    ]
  }
])
```

Store as `$PROFILE`.

## Step 2: Run Sync

```bash
node bin/sync-baseline-requirements.cjs --profile "$PROFILE" --json
```

Parse the JSON output. Display a human-readable summary:

```
Baseline sync complete ($PROFILE profile)
  Added:   N new requirements
  Skipped: M (already present)
  Total:   K requirements
```

If added > 0, list each added requirement:

```
  + [ID] text
```

## Step 3: Commit if Needed

If `added.length > 0`:

```bash
node ~/.claude/qgsd/bin/gsd-tools.cjs commit "req(baseline): sync N baseline requirements" --files .formal/requirements.json
```

Where N is the count of added requirements.

If `added.length === 0`: display "No new requirements to sync -- .formal/requirements.json is up to date."

</process>

<success_criteria>
- [ ] sync-baseline-requirements.cjs ran without error
- [ ] Results displayed with added/skipped counts
- [ ] .formal/requirements.json committed if changed
</success_criteria>
