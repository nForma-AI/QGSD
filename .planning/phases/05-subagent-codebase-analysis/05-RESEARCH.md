# Phase 5: Subagent Codebase Analysis - Research

**Researched:** 2026-01-20
**Domain:** Subagent orchestration, context window management, Claude Code Task tool
**Confidence:** HIGH

## Summary

Phase 5 refactors the current `/gsd:analyze-codebase` entity generation from main-context execution to subagent delegation. The current implementation (Phase 4) has Claude executing the command generate entity content directly via the Task tool with batches of 10 files, but ALL exploration and decision-making happens in the main orchestrator context.

**The problem:** On large codebases (500+ files), the orchestrator exhausts context by:
1. Reading all files during selection (identifying which 50 files to generate entities for)
2. Orchestrating batch splits and subagent spawns
3. Collecting and validating subagent results

**The solution:** Delegate the entire entity generation phase to a subagent, following the `gsd-codebase-mapper.md` pattern:
- Orchestrator provides minimal instructions + file list
- Subagent operates in fresh 200k context
- Subagent reads files, generates entities, writes directly to disk
- Subagent returns only confirmation (not entity contents)

**Current baseline:** `gsd-codebase-mapper.md` demonstrates successful subagent delegation for analysis tasks. It spawns with a focus area, explores thoroughly, writes documents directly, and returns ~10 lines of confirmation. This pattern scales because the orchestrator never loads document contents.

**Primary recommendation:** Extract entity generation (Step 9) from `/gsd:analyze-codebase` into a dedicated `gsd-entity-generator` subagent. Orchestrator handles Steps 1-8 (indexing), then spawns subagent with file list. Subagent generates all entities and returns statistics only.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Claude Code Task tool | Built-in | Subagent spawning with model selection | Official Claude Code orchestration primitive |
| sql.js | 1.12.0+ | Graph database in subagent context | Subagent needs graph access to resolve [[wiki-links]] |

### Supporting

| Component | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gsd-codebase-mapper.md | Current | Reference pattern for subagent delegation | Template for entity-generator architecture |
| gsd-executor.md | Current | Reference for Task tool usage | Shows how to spawn with model profile |

### Installation

No new dependencies required. Phase 5 refactors existing architecture.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single subagent for all files | Multiple subagents (1 per batch) | Multiple subagents = parallel processing but complex orchestration and potential race conditions in graph.db writes |
| Subagent with file list | Subagent discovers files itself | Discovery requires reading index.json anyway, orchestrator already has this data |
| Inline in hook | Keep current approach | Hooks have strict execution limits, can't spawn subagents or handle 500+ files |

## Architecture Patterns

### Recommended Execution Flow

```
User: /gsd:analyze-codebase

Orchestrator (main context):
├── Steps 1-8: Index creation (existing)
│   ├── Scan files with Glob
│   ├── Extract exports/imports
│   ├── Write index.json, conventions.json, summary.md
│   └── Identify 50 key files for entity generation
│
└── Step 9: Spawn entity-generator subagent
    ├── Pass: file list, index data, config
    ├── Subagent operates in fresh 200k context
    └── Returns: { entities_created: N, skipped: M }

Subagent (gsd-entity-generator):
├── Load file list from prompt
├── For each file:
│   ├── Read file content
│   ├── Generate entity markdown (Claude's own analysis)
│   ├── Write to .planning/intel/entities/{slug}.md
│   └── PostToolUse hook syncs to graph.db
└── Return confirmation statistics
```

### Pattern 1: Minimal Orchestrator Handoff

**What:** Orchestrator passes only essential data, not full file contents

**When to use:** When subagent needs to read files itself (maintains fresh context)

**Example:**

```markdown
Task(
  prompt=f"""Generate semantic entity files for key codebase files.

Entity generation parameters:
- Total files to process: {len(selected_files)}
- Output directory: .planning/intel/entities/
- Slug convention: src/lib/db.ts -> src-lib-db

Files to process:
{chr(10).join(selected_files)}

For each file:
1. Read the file content using Read tool
2. Analyze purpose, exports, dependencies
3. Generate entity markdown following template
4. Write to .planning/intel/entities/{{slug}}.md

Entity template:
---
path: {{file_path}}
type: [module|component|util|config|api|hook|service|model]
updated: {today}
status: active
---

# {{filename}}

## Purpose

[1-3 sentences: What does this file do? Why does it exist?]

[... rest of template ...]

After all files processed, return statistics:
- Entities created: N
- Files skipped: M (already existed)
- Errors: K (if any)
""",
  subagent_type="gsd-entity-generator",
  model="{model}"
)
```

**Why minimal:** Passing file contents in prompt exhausts orchestrator context (defeats purpose of subagent delegation).

### Pattern 2: Subagent Direct Write

**What:** Subagent writes entity files directly, doesn't return contents to orchestrator

**When to use:** Always (learned from gsd-codebase-mapper.md)

**Anti-pattern:**

```python
# DON'T: Return entity contents to orchestrator
entities = []
for file in files:
    entity = generate_entity(file)  # Claude generates
    entities.append(entity)         # Accumulates in context
return entities                     # Passes back to orchestrator
```

**Correct pattern:**

```python
# DO: Write directly, return only confirmation
for file in files:
    entity_content = generate_entity(file)  # Claude generates
    Write(path=f".planning/intel/entities/{slug}.md", content=entity_content)
    # PostToolUse hook automatically syncs to graph.db

return {
    "entities_created": len(files),
    "location": ".planning/intel/entities/"
}
```

### Pattern 3: Model Profile Resolution

**What:** Orchestrator resolves model profile, passes specific model to Task tool

**When to use:** Every subagent spawn (ensures consistent model selection)

**Example:**

```bash
# Read model profile from config
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | \
  grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | \
  grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

```python
# Model lookup table for gsd-entity-generator
model_map = {
    "quality": "claude-opus-4-5-20251101",
    "balanced": "claude-sonnet-4-5-20250929",
    "budget": "claude-sonnet-4-5-20250929"
}
model = model_map.get(MODEL_PROFILE, "claude-sonnet-4-5-20250929")
```

**Why this matters:** Entity generation is semantic analysis (requires strong reasoning). Sonnet 4.5 adequate for balanced/budget, Opus 4.5 for quality profile.

### Pattern 4: PostToolUse Hook Integration

**What:** Subagent writes entities, hook syncs to graph.db automatically

**When to use:** Always (no explicit sync needed in subagent)

**Flow:**

```
Subagent writes: .planning/intel/entities/src-lib-db.md
    ↓
PostToolUse hook (gsd-intel-index.js) detects Write tool
    ↓
isEntityFile(path) returns true
    ↓
syncEntityToGraph(path):
    - Extracts frontmatter
    - Extracts [[wiki-links]]
    - Upserts node to graph.db
    - Inserts edges
    - Persists database
    ↓
regenerateEntitySummary():
    - Generates new summary from graph
    - Writes summary.md
```

**Critical insight:** Subagent doesn't need graph access for writes. Hook handles all graph operations. Subagent only needs to write well-formed entity markdown.

### Anti-Patterns to Avoid

**Anti-pattern 1: Orchestrator reads files for subagent**

```python
# DON'T: Load all file contents in orchestrator
file_contents = {}
for file_path in selected_files:
    file_contents[file_path] = Read(file_path)  # Exhausts orchestrator context

Task(prompt=f"Generate entities for: {file_contents}", ...)  # Too late, context blown
```

**Why it fails:** Defeats purpose of subagent delegation (500 files × 5KB avg = 2.5MB of code in orchestrator context).

**Anti-pattern 2: Multiple parallel subagents**

```python
# DON'T: Spawn one subagent per file (or per small batch)
for file in selected_files:
    Task(prompt=f"Generate entity for {file}", ...)  # 50 subagents = chaos
```

**Why it fails:**
- 50 concurrent subagents writing to `.planning/intel/entities/`
- 50 concurrent PostToolUse hooks writing to `graph.db`
- Race conditions in sql.js export/import (no file locking)
- Excessive API calls (50 × context overhead)

**Anti-pattern 3: Subagent returns generated content**

```markdown
## ENTITY GENERATION COMPLETE

**Files processed:** 50

**Generated entities:**

[... 50 × 500 lines of entity content ...]  <!-- Explodes orchestrator context -->
```

**Why it fails:** Orchestrator asked for entity generation, not entity contents. Return confirmation only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subagent orchestration | Custom process spawning | Claude Code Task tool | Built-in, handles model selection, output capture, error handling |
| File batching | Complex batch scheduling | Single subagent with full file list | Subagent has 200k context (enough for 500 file paths), no coordination overhead |
| Entity template | Embedded in subagent logic | Pass template in prompt | Template may evolve, keep it in prompt not in subagent code |
| Graph database access | Direct sql.js in subagent | PostToolUse hook handles sync | Hooks are designed for this, no need to duplicate graph logic |
| Progress tracking | Real-time updates to orchestrator | Batch completion confirmation | Subagent works in isolation, returns final stats |

**Key insight:** The Task tool is designed for this exact pattern. Don't try to implement manual process forking, IPC, or result aggregation. Task() blocks until subagent completes, returns output directly.

## Common Pitfalls

### Pitfall 1: Orchestrator Context Bloat

**What goes wrong:** Orchestrator loads too much data before spawning subagent, exhausts context anyway.

**Why it happens:** Instinct to "prepare everything" for the subagent (read files, validate, format).

**How to avoid:**
- Orchestrator's job: Identify WHICH files (paths only)
- Subagent's job: Read files and process
- Pass file paths, not file contents
- Trust subagent to handle file reading

**Warning signs:** Orchestrator context usage >50% before Task() call.

### Pitfall 2: Subagent Result Explosion

**What goes wrong:** Subagent returns all generated entity content to orchestrator.

**Why it happens:** Thinking orchestrator needs to "validate" or "display" results.

**How to avoid:**
- Subagent writes directly to `.planning/intel/entities/`
- Return only: `{ entities_created: N, errors: [] }`
- Orchestrator reports to user: "Created N entities in .planning/intel/entities/"
- User can inspect entity files themselves

**Warning signs:** Task() return value contains >1000 lines of text.

### Pitfall 3: Race Conditions in graph.db

**What goes wrong:** Multiple concurrent writes to graph.db corrupt database.

**Why it happens:** PostToolUse hook fires for every Write. 50 entity writes = 50 hooks attempting sql.js export/import simultaneously.

**How to avoid:**
- Use single subagent (not parallel subagents)
- PostToolUse hooks run sequentially per Write operation
- sql.js persistence is synchronous (no async race conditions within single process)
- If implementing parallel subagents in future: file locking or write queue required

**Warning signs:** graph.db corruption, missing edges, "database is locked" errors.

### Pitfall 4: Missing Entity Template

**What goes wrong:** Subagent generates entities in wrong format, hook can't parse frontmatter/links.

**Why it happens:** Template not provided in subagent prompt, or template is incomplete.

**How to avoid:**
- Include EXACT entity template in Task prompt
- Show examples with all sections (frontmatter, Purpose, Exports, Dependencies, Used By, Notes)
- Specify [[wiki-link]] format for internal dependencies
- Test generated entities: hook should extract frontmatter + links successfully

**Warning signs:** Entities created but not appearing in graph queries, summary.md unchanged.

### Pitfall 5: No Progress Visibility

**What goes wrong:** Subagent processes 500 files silently, user has no idea if it's working or stuck.

**Why it happens:** Task() blocks until completion, no intermediate output.

**How to avoid:**
- For large operations (100+ files), consider chunking:
  - Orchestrator: Split 500 files into 10 batches of 50
  - Spawn subagent per batch (sequential, not parallel)
  - Report progress: "Batch 3/10 complete (150/500 files)"
- For moderate operations (50-100 files): Single subagent is fine, document expected duration

**Warning signs:** User cancels command thinking it's frozen (actually still processing).

## Code Examples

### Complete Subagent Spawn (Orchestrator)

```markdown
## Step 9: Generate Semantic Entities via Subagent

Read model profile from config:

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | \
  grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | \
  grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

Resolve model for gsd-entity-generator:

| Profile | Model |
|---------|-------|
| quality | claude-opus-4-5-20251101 |
| balanced | claude-sonnet-4-5-20250929 |
| budget | claude-sonnet-4-5-20250929 |

Spawn entity generator subagent:

```python
# Build file list from Step 9a selection
file_list = "\n".join(selected_files)
today = date.today().isoformat()

Task(
  prompt=f"""Generate semantic entity documentation for key codebase files.

You are a GSD entity generator. You read source files and create semantic documentation that captures PURPOSE (what/why), not just syntax.

**Parameters:**
- Files to process: {len(selected_files)}
- Output directory: .planning/intel/entities/
- Date: {today}

**Slug convention:**
- src/lib/db.ts → src-lib-db
- Replace / with -, remove extension

**Entity template (use EXACTLY this format):**

---
path: {{absolute_file_path}}
type: [module|component|util|config|api|hook|service|model|test]
updated: {today}
status: active
---

# {{filename}}

## Purpose

[1-3 sentences explaining what this file does and why it exists. Focus on the problem it solves, not implementation details.]

## Exports

[For each export, provide signature and brief purpose:]
- `functionName(params): ReturnType` - What it does
- `ClassName` - What it represents

If no exports: "None"

## Dependencies

[Internal dependencies as [[wiki-links]], external as plain text:]
- [[internal-file-slug]] - Why this dependency exists
- external-package - What it provides

If no dependencies: "None"

## Used By

TBD

## Notes

[Optional: Important patterns, gotchas, or context. Omit if nothing notable.]

**Process:**

For each file path below:
1. Read file content using Read tool
2. Analyze exports, imports, purpose
3. Write entity to .planning/intel/entities/{{slug}}.md
4. PostToolUse hook will sync to graph.db automatically

**Files:**

{file_list}

**Return format:**

When all files processed, return ONLY this structure:

```
## ENTITY GENERATION COMPLETE

**Files processed:** {{N}}
**Entities created:** {{M}}
**Already existed:** {{K}}
**Errors:** {{E}} (if any, list file paths)

Entities written to: .planning/intel/entities/
```

Do NOT include entity contents in your response.
""",
  subagent_type="gsd-entity-generator",
  model=model
)
```

Wait for subagent completion. Task() blocks until done.

Parse result for statistics:
- Extract entities_created count
- Report to user
```

### Subagent Response Format (gsd-entity-generator)

```markdown
## ENTITY GENERATION COMPLETE

**Files processed:** 47
**Entities created:** 47
**Already existed:** 0
**Errors:** 0

Entities written to: .planning/intel/entities/
```

**Critical:** Subagent does NOT return entity contents. Only statistics.

### Orchestrator Final Report

```markdown
Codebase Analysis Complete

Files indexed: 347
Exports found: 1,423
Imports found: 2,891

Conventions detected:
- Naming: camelCase (87%)
- Directories: components/ (23 files), lib/ (12 files), api/ (8 files)
- Patterns: *.test.ts (34 files), *.config.ts (5 files)

**Entities created: 47**
- Location: .planning/intel/entities/
- Graph database: Updated automatically
- Summary: Regenerated with dependency hotspots

Files created:
- .planning/intel/index.json
- .planning/intel/conventions.json
- .planning/intel/summary.md
- .planning/intel/entities/*.md (47 files)
- .planning/intel/graph.db

Next: Intel hooks will continue incremental updates as you code.
```

### Entity Generator Subagent Definition (New File)

```markdown
---
name: gsd-entity-generator
description: Generates semantic entity documentation for codebase files. Spawned by analyze-codebase with file list. Writes entities directly to disk.
tools: Read, Write, Bash
color: cyan
---

<role>
You are a GSD entity generator. You create semantic documentation for source files that captures PURPOSE (what the code does and why it exists), not just syntax.

You are spawned by `/gsd:analyze-codebase` with a list of file paths.

Your job: Read each file, analyze its purpose, write entity markdown to `.planning/intel/entities/`, return statistics only.
</role>

<process>

<step name="parse_file_list">
Extract file paths from your prompt. You'll receive:
- Total file count
- Output directory path
- Slug convention rules
- Entity template
- List of absolute file paths

Parse file paths into an array for processing.
</step>

<step name="process_each_file">
For each file path:

1. **Read file content:**
   ```bash
   Read(file_path)
   ```

2. **Analyze the file:**
   - What is the purpose? (Why does this file exist?)
   - What does it export? (Functions, classes, types)
   - What does it import? (Dependencies and why)
   - What type of module is it? (api, component, util, service, etc.)

3. **Generate slug:**
   - Remove leading slashes
   - Remove file extension
   - Replace / and . with -
   - Lowercase everything
   - Example: `src/lib/db.ts` → `src-lib-db`

4. **Build entity content using template:**
   - Frontmatter with path, type, date, status
   - Purpose section (1-3 sentences)
   - Exports section (signatures + descriptions)
   - Dependencies section ([[wiki-links]] for internal, plain text for external)
   - Used By: Always "TBD" (graph analysis fills this later)
   - Notes: Optional (only if important context)

5. **Write entity file:**
   ```bash
   Write(
     file_path=f".planning/intel/entities/{slug}.md",
     content=entity_markdown
   )
   ```

6. **Track statistics:**
   - Count files processed
   - Count entities created
   - Track any errors

**Important:** PostToolUse hook automatically syncs entity to graph.db. You don't need to touch the graph.
</step>

<step name="return_statistics">
After all files processed, return ONLY statistics. Do NOT include entity contents.

Format:
```
## ENTITY GENERATION COMPLETE

**Files processed:** {N}
**Entities created:** {M}
**Already existed:** {K}
**Errors:** {E}

Entities written to: .planning/intel/entities/
```

If errors occurred, list file paths that failed (not the error messages themselves).
</step>

</process>

<entity_template>
Use this EXACT format for every entity:

```markdown
---
path: {absolute_path}
type: [module|component|util|config|api|hook|service|model|test]
updated: {YYYY-MM-DD}
status: active
---

# {filename}

## Purpose

[1-3 sentences: What does this file do? Why does it exist? What problem does it solve? Focus on the "why", not implementation details.]

## Exports

[List each export with signature and purpose:]
- `functionName(params): ReturnType` - Brief description of what it does
- `ClassName` - What this class represents
- `CONSTANT_NAME` - What this constant configures

If no exports: "None"

## Dependencies

[Internal dependencies use [[wiki-links]], external use plain text:]
- [[internal-file-slug]] - Why this dependency is needed
- external-package - What functionality it provides

If no dependencies: "None"

## Used By

TBD

## Notes

[Optional: Patterns, gotchas, important context. Omit section if nothing notable.]
```
</entity_template>

<type_heuristics>
Determine entity type from file path and content:

| Type | Indicators |
|------|-----------|
| api | In api/, routes/, endpoints/ directory, exports route handlers |
| component | In components/, exports React/Vue/etc components |
| util | In utils/, lib/, helpers/, exports utility functions |
| config | In config/, *.config.*, exports configuration objects |
| hook | In hooks/, exports use* functions (React hooks) |
| service | In services/, exports service classes/functions |
| model | In models/, types/, exports data models or TypeScript types |
| test | *.test.*, *.spec.*, contains test suites |
| module | Default if unclear, general-purpose module |
</type_heuristics>

<wiki_link_rules>
**Internal dependencies** (files in the codebase):
- Convert to slug format
- Wrap in [[double brackets]]
- Example: Import from `../../lib/db.ts` → Dependency: `[[src-lib-db]]`

**External dependencies** (npm packages):
- Plain text, no brackets
- Example: `import { z } from 'zod'` → Dependency: `zod - Schema validation`

**When unsure if internal/external:**
- If import path starts with `.` or `@/` → internal (wiki-link)
- If import path is package name → external (plain text)
</wiki_link_rules>

<success_criteria>
Entity generation complete when:

- [ ] All file paths processed
- [ ] Each entity file written to `.planning/intel/entities/`
- [ ] Entity markdown follows template exactly
- [ ] Frontmatter is valid YAML
- [ ] Purpose section is substantive (not just "This file exports X")
- [ ] Internal dependencies use [[wiki-links]]
- [ ] Statistics returned (not entity contents)
</success_criteria>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Orchestrator generates entities | Subagent delegation | Phase 5 (planned) | Prevents context exhaustion on large codebases |
| Sequential processing in main context | Fresh 200k subagent context | Phase 5 (planned) | Scales to 500+ files without orchestrator bloat |
| Batches of 10 with multiple Task calls | Single subagent, all files | Phase 5 (planned) | Simpler orchestration, no batch coordination |
| Hook generates entities via `claude -p` | Subagent generates entities | Phase 5 (planned) | Richer semantic analysis (subagent has full context vs hook's one-shot) |

**Deprecated/outdated:**
- **Hook-based entity generation** (Phase 4 uses `execSync('claude -p')` in hook): Limited to 30s timeout, no retry, crude prompt passing. Phase 5 moves to proper subagent pattern.
- **Multiple parallel subagents** for entity batches: Overcomplicated, race condition risks, excessive overhead. Single subagent with full file list is cleaner.

## Open Questions

### 1. **Optimal File Count per Subagent**

- **What we know:** Subagent has 200k context. File path = ~50 chars avg. 500 paths = 25KB (negligible).
- **What's unclear:** At what file count does entity generation hit subagent context limits? 500 files? 1000?
- **Recommendation:** Start with single subagent for up to 500 files. If codebases >500 common, implement chunking (spawn 5 subagents of 100 files each, sequentially).

### 2. **Should Orchestrator Pre-read Index Data?**

- **What we know:** Subagent needs to understand codebase conventions (naming patterns, directory purposes) for better entity generation.
- **What's unclear:** Should orchestrator pass conventions.json content in prompt, or should subagent read it?
- **Recommendation:** Pass conventions in prompt (it's <2KB JSON). Saves subagent a Read operation, provides useful context for entity type classification.

### 3. **Entity Regeneration Strategy**

- **What we know:** Hook regenerates entities when file signature changes (exports/imports differ).
- **What's unclear:** Should bulk regeneration (via /gsd:analyze-codebase) skip existing entities or overwrite?
- **Recommendation:** Skip existing entities by default (check if `.planning/intel/entities/{slug}.md` exists). Add flag: `--force-regenerate` to overwrite all. This prevents destroying manual edits to entities.

### 4. **Error Handling for Unparseable Files**

- **What we know:** Some files might be binary, corrupted, or have syntax errors.
- **What's unclear:** Should subagent skip silently, or return error list?
- **Recommendation:** Try-catch around file reading. Skip unparseable files, track in errors list, report at end. Don't let one bad file block entire batch.

## Sources

### Primary (HIGH confidence)

- [commands/gsd/analyze-codebase.md](file://./commands/gsd/analyze-codebase.md) - Current entity generation implementation (Phase 4)
- [agents/gsd-codebase-mapper.md](file://./agents/gsd-codebase-mapper.md) - Subagent delegation pattern reference
- [agents/gsd-executor.md](file://./agents/gsd-executor.md) - Task tool usage with model profiles
- [commands/gsd/execute-phase.md](file://./commands/gsd/execute-phase.md) - Wave-based parallel execution pattern
- [hooks/gsd-intel-index.js](file://./hooks/gsd-intel-index.js) - PostToolUse hook that syncs entities to graph

### Secondary (MEDIUM confidence)

- [Claude Code documentation on Task tool](https://docs.anthropic.com/claude/docs/claude-code) - Official docs on subagent spawning
- [Phase 4 research findings](.planning/phases/04-semantic-intelligence/04-RESEARCH.md) - Context window management patterns

### Tertiary (LOW confidence)

- None - all findings based on existing codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Task tool is official Claude Code primitive, sql.js already in use
- Architecture: HIGH - Pattern directly mirrors gsd-codebase-mapper.md (proven)
- Pitfalls: HIGH - Based on direct code analysis and understanding of context limits
- Open questions: MEDIUM - Edge cases identifiable but not yet tested at scale

**Research date:** 2026-01-20
**Valid until:** 60 days (stable Claude Code APIs, no fast-moving dependencies)

**Critical insight:** Phase 5 is an architectural refactor, not a feature addition. The goal is context preservation, not new capabilities. Success = same output with less orchestrator context usage.
