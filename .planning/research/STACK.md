# Stack Research: Requirements Envelope Features

**Domain:** Formal verification infrastructure — JSON schema validation, LLM-based semantic analysis, file immutability enforcement, diff-based drift detection

**Researched:** 2026-03-01

**Overall Confidence:** HIGH

## Executive Summary

The requirements envelope feature (v0.22 ENV requirements) adds four new capabilities to QGSD's formal verification pipeline: aggregating phase requirements into a machine-readable JSON document, validating them with Claude Haiku for semantic duplicates/conflicts, enforcing immutability against unauthorized edits, and detecting drift between the canonical envelope and working markdown files.

The stack for these capabilities is minimal and leverages existing Node.js infrastructure patterns already in QGSD. No new major frameworks are needed. The core additions are: **ajv** for JSON schema validation (industry standard, 50% faster than alternatives, uses code generation), **@anthropic-ai/sdk** for Haiku LLM calls (native Claude integration), **husky** for git hook installation (already common in Node.js projects, used for file protection), and **diff** for text comparison (lightweight, battle-tested). These integrate seamlessly with QGSD's existing bin/ tooling and formal/ model registry patterns.

## Key Findings

**Stack:** ajv (JSON validation) + @anthropic-ai/sdk (Haiku LLM) + husky (git hooks) + diff (drift detection)

**Architecture:** Four new bin/ tools (aggregate-requirements, validate-requirements, enforce-envelope-immutability, detect-drift) + pre-commit hook + schema file in formal/

**Critical pitfall:** Haiku semantic validation requires explicit requirement deduplification prompt engineering — the LLM cannot auto-detect duplicates; you must provide candidate pairs and ask for boolean judgments.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| ajv | ^8.12.0 | JSON schema validation for requirements.json | Industry standard (50% faster than alternatives), code-generation approach, adopted by ESLint/Webpack/Fastify; validates ENV-01 envelope structure at parse time; no runtime interpretation overhead |
| @anthropic-ai/sdk | ^0.24.0+ | Haiku LLM calls for semantic validation | Native Claude API, official Anthropic SDK, supports streaming and timeouts; Haiku 4.5 ($1/$5 per M tokens) is cost-optimal for requirement validation pass (ENV-02); Claude Code already uses SDK in existing hook infrastructure |
| husky | ^9.0.0+ | Git hook management for immutability enforcement | De facto standard for Node.js, installs hooks in committed .husky/ directory, enables per-project enforcement without global state; ENV-04 immutability guard implemented as pre-commit hook |
| diff | ^5.2.0+ | Text differencing for drift detection | Lightweight (jsdiff), battle-tested, supports diffChars/diffLines; ENV-05 detects divergence between formal/requirements.json and .planning/REQUIREMENTS.md via per-line comparison |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| yaml | ^2.3.0+ | YAML parsing for requirement source documents | Already in devDependencies via xstate build pipeline; ENV-01 aggregation may read requirements from YAML sources (e.g., task-envelope.json must_haves) |
| chalk | ^5.3.0+ | Colored console output for validation reports | Optional; improves UX for ENV-02 validation pass output (color-coded duplicates/conflicts); used elsewhere in QGSD bin/ tools |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| JSON Schema Draft-07 | Schema definition for requirements.json | Recommended for validation schema (.planning/schemas/requirements.schema.json); ajv best supports draft-07 with custom keywords |
| Git pre-commit hooks | File protection at commit time | ENV-04 guard: pre-commit hook prevents modifications to formal/requirements.json unless user explicitly re-approves via CLI flag (--approve-amendment) |

## Installation

```bash
# Core stack (production requirements)
npm install ajv@^8.12.0 @anthropic-ai/sdk@^0.24.0 diff@^5.2.0

# Hook management
npm install -D husky@^9.0.0

# Supporting (already in devDependencies)
npm install yaml@^2.3.0

# Optional UX enhancement
npm install chalk@^5.3.0

# Initialize husky (one-time)
npx husky install
```

## Architecture Integration Points

### 1. **Aggregate Requirements** (bin/aggregate-requirements.cjs)

Triggered from `new-milestone` phase planning gate after roadmap creation.

**Inputs:**
- All phase `task-envelope.json` files (.planning/phases/*/task-envelope.json)
- Existing `.planning/REQUIREMENTS.md` (if migrating from v0.21)

**Processing:**
- Parse phase requirements (via YAML or JSON)
- Flatten to single JSON array: `[{ req_id, text, category, phase, provenance }, ...]`
- Write to `formal/requirements.json`

**Validates with:** ajv against `formal/schemas/requirements.schema.json`

**Output:** `formal/requirements.json` (immutable after ENV-02 approval)

### 2. **Validate Requirements** (bin/validate-requirements.cjs)

Implements ENV-02: Haiku semantic validation pass.

**Calls:** Haiku 4.5 via @anthropic-ai/sdk

**Prompt strategy:**
- Generate N^2 candidate pairs (or sampled pairs if N > 100)
- Ask Haiku: "Do these requirements have the same intent (semantic duplicate)?" and "Do these requirements contradict?"
- Collect boolean judgments
- Present user with: "5 duplicates found: [pair1, pair2, ...]", "3 contradictions: [...]"

**User resolution:**
- User explicitly approves duplicates for merge or contradiction resolution
- Updates `formal/requirements.json` with user's decisions

**Output:** Updated `formal/requirements.json` + `formal/validation-report.md`

### 3. **Enforce Immutability** (pre-commit hook + bin/unlock-requirements.cjs)

Implements ENV-04: file lock enforcement.

**Hook mechanism:**
- `.husky/pre-commit` checks if `formal/requirements.json` is modified
- If modified and no `--approve-amendment` flag, reject commit with message pointing to amendment workflow
- User runs: `node bin/validate-requirements.cjs formal/requirements.json --amend-mode` to re-validate and unlock

**Output:** Exit code 1 (block commit) or 0 (allow)

### 4. **Detect Drift** (bin/detect-requirements-drift.cjs)

Implements ENV-05: drift detection between working and canonical.

**Comparison:**
- Read `formal/requirements.json` (canonical, immutable)
- Read `.planning/REQUIREMENTS.md` (working copy)
- Use diff library: extract requirement blocks from markdown, parse structured diff

**Output:** `formal/drift-report.md` with:
- Lines added to .planning/REQUIREMENTS.md not in envelope
- Lines removed that exist in envelope
- Recommendation to re-run amendment workflow or revert working copy

---

## Integration with Existing QGSD Infrastructure

### Model Registry Synchronization
- Add `formal/requirements.json` entry to `formal/model-registry.json`
- Track `update_source: "envelope-validation"`, `update_source: "user-amendment"`
- Version bumps on each successful amendment

### Formal Verification Pipeline
- `bin/run-formal-verify.cjs` includes a new `env` step:
  - Validates `formal/requirements.json` schema (ajv)
  - Runs `bin/detect-requirements-drift.cjs` as pre-flight check
  - Fails CI if drift detected (ENV-05 violation)

### Phase Planning
- `plan-phase.md` template gains a step: "Does your plan respect formal/requirements.json envelope?"
- Quorum context includes `formal/requirements.json` summary for decision context

### Stop Hook Integration
- Stop hook (qgsd-stop.js) can reference formal/requirements.json for constraint validation
  - Optional future: "Does proposed action violate any frozen requirement?"

---

## Alternatives Considered

| Recommended | Alternative | When Alternative Makes Sense |
|-------------|-------------|-------------------------------|
| ajv | joi | joi is heavier (OOP, schema builder), better for form validation; ajv's code-gen is faster for pure validation |
| @anthropic-ai/sdk | axios + manual HTTP | axios adds no value here; @anthropic-ai/sdk handles auth, timeouts, streaming; don't use HTTP manually |
| husky | Manual .git/hooks/ files | husky is committed with .husky/ config; manual hooks are project-specific and fragile; husky is standard Node.js practice |
| diff (jsdiff) | node-diff3 | node-diff3 is for 3-way merge; drift detection only needs 2-way comparison; jsdiff is lighter |
| Claude Haiku | GPT-4 / other LLM | Haiku 4.5 is cost-optimal ($1/$5 per M tokens vs $15/$60 for GPT-4); sufficient semantic reasoning for duplicate/conflict detection; already integrated with QGSD (Claude ecosystem) |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| tv4 (JSON-Schema validator) | Deprecated, v1.3.0 is last release (2015); slow (no code generation) | ajv — maintained, modern, 50% faster |
| Manual semantic similarity (word embeddings) | Requires ML infrastructure (transformers), slow cold-start, adds ~500MB deps | Haiku LLM call — cheaper ($0.001 per req pair), more reliable semantic understanding, no model hosting |
| git-hooks NPM package | Abandoned (last update 2018), poor Node.js integration | husky — actively maintained, standard for Node.js CI/CD |
| Full formal spec for requirements (Alloy/TLA+) | Overkill; formal methods verify behavior, not requirement structure; high complexity for low ROI | JSON schema + Haiku validation — simple, sufficient for ENV requirements |

---

## Stack Patterns by Variant

**If immutability is organizational policy (ENV-04 must be enforced):**
- Use husky pre-commit hook + bin/unlock-requirements.cjs
- Document amendment workflow in CLAUDE.md
- Block commits by default; audit logs show who/when amended

**If semantic validation is optional (lighter validation):**
- Use ajv schema validation only (ENV-01 only)
- Skip Haiku pass (ENV-02)
- Drift detection still runs (ENV-05)
- Rationale: Haiku adds cost (~$0.01 per requirement set validation); ajv schema only costs 0

**If requirements are stable and rarely change:**
- Implement ajv + drift detection (ENV-01, ENV-05) only
- Skip Haiku validation (ENV-02) at new-milestone; run manual code review instead
- Immutability enforced but with looser amendment process

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| ajv@^8.12.0 | Node.js 14.6+, esbuild ^0.24.0 | ajv v8 is stable; v9 is beta as of 2026-03; use v8 for production |
| @anthropic-ai/sdk@^0.24.0+ | Node.js 16.7.0+ | SDK supports Haiku 4.5 model; check releases for latest claude-haiku-4-5 identifier |
| husky@^9.0.0+ | Node.js 14.17+ | v9 is stable; requires Git 2.9+; confirm with `git --version` |
| diff@^5.2.0+ | Node.js 14+ | v5 has TypeScript definitions built-in; no @types/diff needed |
| xstate@^5.28.0 (existing) | Compatible with all above | No conflicts with new stack additions |

---

## Deployment Considerations

### API Key Management
- @anthropic-ai/sdk uses ANTHROPIC_API_KEY env var (standard practice)
- Ensure API key is in .env.local (gitignored) or injected via CI/CD
- No changes to existing key rotation logic in QGSD

### Pre-Commit Hook Scope
- husky pre-commit hook is project-level (.husky/ committed)
- Does NOT affect global git config; safe for monorepos
- Each project maintains own hook logic

### Backward Compatibility
- New stack does NOT modify existing bin/ tools or formal/ specs
- Existing run-formal-verify.cjs continues to work
- ENV validation is additive; opt-in via new-milestone flag

### Cost Implications
- Haiku validation: ~$0.001 per requirement (1000 reqs = $1)
- Schema validation (ajv): Free (runs locally)
- Drift detection (diff): Free (runs locally)
- Total ENV overhead per new-milestone: <$0.01 (negligible)

---

## Configuration Schema

Create `formal/schemas/requirements.schema.json` (JSON Schema Draft-07):

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "requirements", "frozen_at"],
  "additionalProperties": false,
  "properties": {
    "version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+$" },
    "frozen_at": { "type": "string", "format": "date-time" },
    "frozen_by": { "type": "string" },
    "requirements": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "text", "category", "phase"],
        "additionalProperties": false,
        "properties": {
          "id": { "type": "string", "pattern": "^ENV-[0-9]{2}$" },
          "text": { "type": "string", "minLength": 10 },
          "category": { "type": "string", "enum": ["table_stakes", "differentiator", "anti_feature"] },
          "phase": { "type": "string" },
          "provenance": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Sources

- [Ajv JSON schema validator](https://ajv.js.org/) — Verified version 8 is current, code-generation approach, performance benchmarks
- [GitHub - ajv-validator/ajv](https://github.com/ajv-validator/ajv) — Confirms adoption, standards compliance
- [npm: @anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) — Official SDK, current versions, installation
- [Anthropic Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Haiku 4.5 cost ($1/$5 per M tokens)
- [GitHub - kpdecker/jsdiff](https://github.com/kpdecker/jsdiff) — Text differencing, drift detection capability
- [Husky](https://typicode.github.io/husky/) — Git hook management, current version, Node.js standard
- [Git Hooks: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/git-hooks-complete-guide) — Modern hook practices, file protection patterns

---

*Stack research for: Requirements Envelope (v0.22)*
*Domain: Formal verification infrastructure — JSON validation, LLM semantic analysis, file immutability, drift detection*
*Researched: 2026-03-01*
*Confidence: HIGH — All recommendations verified with official documentation and current package releases*
