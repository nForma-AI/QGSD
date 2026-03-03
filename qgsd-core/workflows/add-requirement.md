<purpose>
Add a single requirement to the `.formal/requirements.json` envelope. Validates the new requirement against the existing envelope for duplicate IDs and semantic conflicts. If a conflict is detected, elevates to the user before proceeding.
</purpose>

<process>

<step name="parse_args">
**Parse arguments:**

The user provides requirement details interactively or via arguments:
- `--id=PREFIX-NN` — Requirement ID (must match `^[A-Z]+-\d+$`)
- `--text="..."` — Requirement text
- `--category="..."` — Category name
- `--phase=vX.XX-NN` — Phase reference (must match `^v[\d.]+-\d+$`)
- `--status=Pending|Complete` — Status (defaults to Pending)
- `--background="..."` — Optional background/rationale
- `--source-file="..."` — Provenance source file (defaults to "manual")
- `--milestone="..."` — Provenance milestone (defaults to current milestone from `.planning/ROADMAP.md`)
- `--dry-run` — Preview without writing

If required fields (id, text, category, phase) are missing, prompt the user interactively using AskUserQuestion.
</step>

<step name="validate_id_format">
**Validate ID format:**

1. Check that `id` matches pattern `^[A-Z]+-\d+$`
2. If invalid, show the error and ask user to correct it
3. Parse the prefix (e.g., `ACT` from `ACT-01`) for later conflict detection
</step>

<step name="read_envelope">
**Read existing envelope:**

1. Read `.formal/requirements.json`
2. If file doesn't exist, error: "No requirements envelope found. Run /qgsd:map-requirements first."
3. Parse the envelope and extract the requirements array
4. Note the `frozen_at` state for later re-freeze
</step>

<step name="check_duplicate_id">
**Check for duplicate ID (hard block):**

1. Search existing requirements for an exact ID match
2. If found, show the existing requirement to the user:
   ```
   DUPLICATE: Requirement {id} already exists:
     Text: {existing.text}
     Category: {existing.category}
     Phase: {existing.phase}
     Status: {existing.status}
   ```
3. Ask the user: "This ID already exists. Would you like to use a different ID, or update the existing requirement?"
4. Do NOT proceed until resolved
</step>

<step name="check_semantic_conflicts">
**Check for semantic conflicts (Haiku review) — ALWAYS runs:**

This step is MANDATORY for every new requirement, regardless of whether same-prefix requirements exist. A new `QUICK-01` could contradict an `ENFC-*` or `VERIFY-*` requirement under a completely different prefix.

Spawn a Haiku subagent to check for semantic conflicts against the **entire** requirements envelope.

Use the **Agent tool** with these parameters:
- `subagent_type`: `"general-purpose"`
- `model`: `"haiku"`
- `description`: `"Check requirement conflicts"`
- `prompt`: The prompt below (with actual values substituted)

```
You are checking whether a NEW requirement conflicts with ANY existing requirements in the envelope.

## New requirement
- ID: {id}
- Text: {text}
- Category: {category}
- Background: {background}

## Existing requirements

Read `.formal/requirements.json` and scan ALL requirements (not just same-prefix).

## Your task

Check for these issues ONLY:

1. DUPLICATE INTENT: Does the new requirement express the SAME intent as an existing one, just with different wording? If so, adding it would create redundancy.

2. CONTRADICTION: Does the new requirement CONTRADICT an existing one? Two requirements that cannot both be satisfied simultaneously. Pay special attention to cross-prefix contradictions (e.g., a new workflow requirement contradicting an enforcement or verification requirement).

3. SUBSUMPTION: Is the new requirement already FULLY COVERED by an existing one? Adding it would be redundant.

## Response format

Respond with EXACTLY one of:
- `CLEAR` — No conflicts found. The new requirement is distinct and compatible.
- `CONFLICT: <type> with <existing-id>: <brief explanation>` — A real issue was found.

Be conservative: only flag REAL conflicts. Similar-sounding requirements that address different aspects are NOT conflicts. Requirements from different domains that happen to share keywords are NOT conflicts.
```

If Haiku returns `CONFLICT`:
1. Display the conflict to the user with full context (both requirements)
2. Ask: "A potential conflict was detected. Do you want to proceed anyway, modify the requirement, or cancel?"
3. Wait for user decision before continuing

If Haiku returns `CLEAR`:
Display: `◆ Semantic conflict check: CLEAR (scanned {N} existing requirements)`
</step>

<step name="unfreeze">
**Unfreeze envelope if frozen:**

If `frozen_at` is not null:
1. Read `.formal/requirements.json`
2. Set `frozen_at` to `null`
3. Write back atomically
</step>

<step name="append_requirement">
**Append the new requirement:**

1. Read `.formal/requirements.json` (fresh read after unfreeze)
2. Build the new requirement object:
   ```json
   {
     "id": "<id>",
     "text": "<text>",
     "category": "<category>",
     "phase": "<phase>",
     "status": "<status>",
     "provenance": {
       "source_file": "<source_file>",
       "milestone": "<milestone>"
     }
   }
   ```
3. If `background` was provided, add it to the object
4. Append to the `requirements` array
5. Sort the array by `id` (lexicographic) for determinism
6. Recompute `content_hash`: SHA-256 of `JSON.stringify(requirements, null, 2)`
7. Update `aggregated_at` to current ISO timestamp
8. If dry-run: display the new requirement object and stop
9. Write atomically (temp file + rename)
</step>

<step name="refreeze">
**Re-freeze the envelope:**

1. Read `.formal/requirements.json`
2. Set `frozen_at` to current ISO timestamp
3. Write back atomically
</step>

<step name="summarize">
**Show summary:**

- The new requirement that was added (id, text, category, phase)
- Total requirement count (before → after)
- Whether conflicts were checked and cleared
- If dry-run: note this was a preview only
</step>

</process>
