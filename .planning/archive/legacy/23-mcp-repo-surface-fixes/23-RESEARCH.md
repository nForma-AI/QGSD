# Phase 23: MCP Repo Surface Fixes - Research

**Researched:** 2026-02-22
**Domain:** npm package metadata, file scaffolding, identity rename, ESM dynamic versioning across 6 TypeScript MCP server repos
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STD-01 | openhands-mcp-server package.json name, class name, and server config corrected to `openhands-mcp-server` (currently all say `codex-mcp-server`) | Full rename surface mapped; all 7 code locations + package.json + bin field + package-lock.json identified |
| STD-03 | All 6 repos read version dynamically from `package.json` (no hardcoded string in `index.ts`) | `createRequire` + `pkg.version` pattern confirmed from gemini/opencode; 4 repos still hardcoded at `'0.0.6'` |
| STD-05 | All 6 repos use MIT license with a `LICENSE` file present | 4 repos missing LICENSE; 2 existing LICENSE files use non-standard "MIT License (Non-Commercial)" text, not OSI-approved MIT |
| STD-06 | All 6 repos have `engines: node>=18`, `prepublishOnly` build script, `publishConfig: {access: public}` | 4 repos missing all three fields; gemini/opencode have all three |
| STD-07 | All 6 repos have a comprehensive Makefile with lint/format/test/build/clean/dev targets | 4 repos have stub Makefile (lint-only); gemini/opencode have full 6-target Makefile; claude-mcp-server has only lint+format combined |
| STD-09 | All 6 repos have `CHANGELOG.md` and `CLAUDE.md` | 4 repos missing CHANGELOG.md; 3 repos missing CLAUDE.md; gemini missing CLAUDE.md |
| STD-10 | All 6 repos use consistent npm scoping (all `@tuannvm/` or all unscoped — not mixed) | Only gemini uses `@tuannvm/`; other 5 are unscoped; decision required on which direction |
</phase_requirements>

---

## Summary

Phase 23 is a surface-level repo standardization phase — no new features, no architecture changes, just fixing metadata and scaffolding across 6 repos. The changes are high-confidence and low-risk because the reference implementation (gemini-mcp-server and opencode-mcp-server) already demonstrates all desired patterns correctly. The planner's job is to apply the Gen2 patterns to the 4 Gen1 repos and fix the openhands identity rename.

The gap analysis reveals two tiers of repos: Gen2 (gemini, opencode) which are mostly compliant, and Gen1 (claude, codex, copilot, openhands) which are missing engines/publishConfig/prepublishOnly, have stub Makefiles, are missing CHANGELOG.md and CLAUDE.md, use ISC license, and hardcode version strings. The openhands repo has the additional problem of identity references still pointing to `codex-mcp-server` throughout its source files. The npm scoping question (STD-10) is the only open decision: gemini uses `@tuannvm/` while the other 5 do not — the phase must pick a direction.

The standard MIT license text needed by STD-05 is the OSI-approved version (not the existing "MIT License (Non-Commercial)" text present in gemini/opencode LICENSE files). The requirement says "MIT license with the correct author" — this means creating a clean OSI MIT LICENSE file with `tuannvm` as the author. The `license` field in package.json for Gen1 repos must change from `"ISC"` to `"MIT"`.

**Primary recommendation:** Apply the gemini/opencode pattern uniformly to all 6 repos — use their Makefile, index.ts dynamic version pattern, and package.json field set as the canonical template. Decide npm scoping as unscoped (simpler, matches 5 of 6 repos) and remove `@tuannvm/` from gemini.

---

## Current State Audit (Evidence-Based)

### Per-Repo Gap Matrix

| Repo | name correct | version dynamic | LICENSE | engines | prepublishOnly | publishConfig | Makefile full | CHANGELOG | CLAUDE.md |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| claude-mcp-server | YES | NO (hardcoded `'0.0.6'`) | MISSING | MISSING | MISSING | MISSING | NO (1 target) | MISSING | MISSING |
| codex-mcp-server | YES | NO (hardcoded `'0.0.6'`) | MISSING | MISSING | MISSING | MISSING | NO (1 target) | MISSING | MISSING |
| copilot-mcp-server | YES | NO (hardcoded `'0.0.6'`) | MISSING | MISSING | MISSING | MISSING | NO (1 target) | MISSING | MISSING |
| gemini-mcp-server | YES | YES (pkg.version) | YES (non-commercial text) | YES | YES | YES | YES (6 targets) | YES | MISSING |
| opencode-mcp-server | YES | YES (pkg.version) | YES (non-commercial text) | YES | YES | YES | YES (6 targets) | YES | YES |
| openhands-mcp-server | NO (says codex-mcp-server) | NO (hardcoded `'0.0.6'`) | MISSING | MISSING | MISSING | MISSING | NO (1 target) | MISSING | YES (exists) |

### npm Scoping Status

| Repo | Current package name | Scoped? |
|------|---------------------|---------|
| claude-mcp-server | `claude-mcp-server` | No |
| codex-mcp-server | `codex-mcp-server` | No |
| copilot-mcp-server | `copilot-mcp-server` | No |
| gemini-mcp-server | `@tuannvm/gemini-mcp-server` | Yes |
| opencode-mcp-server | `opencode-mcp-server` | No |
| openhands-mcp-server | `codex-mcp-server` (wrong) | No |

**Decision needed:** 5 of 6 repos are unscoped. The simplest path to STD-10 compliance is to remove the `@tuannvm/` scope from gemini. The alternative is to add `@tuannvm/` to all 5 others — more work and breaks existing `npx` install instructions for 5 repos.

---

## Standard Stack

### Core (No New Libraries — Pure File Editing)

This phase installs no new npm packages. All changes are to existing files or new scaffolding files (LICENSE, CHANGELOG.md, CLAUDE.md).

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Node.js `module.createRequire` | Built-in (Node 12+) | Load package.json in ESM context | Official Node.js pattern for ESM JSON imports |
| Makefile | POSIX standard | Build target orchestration | Already used by compliant repos; no extra tooling |
| MIT License (OSI) | SPDX: MIT | Open source license | Required by STD-05; publishConfig: public requires permissive license |

### Pattern: Dynamic Version in ESM (from gemini/opencode — HIGH confidence)

Both compliant repos use identical pattern:

```typescript
// src/index.ts — pattern confirmed in gemini-mcp-server and opencode-mcp-server
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const SERVER_CONFIG = {
  name: 'claude-mcp-server',  // each repo uses its own name
  version: pkg.version,
};
```

This works because:
- All 6 repos are `"type": "module"` in package.json
- All Gen1 tsconfig.json files already have `"resolveJsonModule": true`
- `createRequire` is the Node.js-blessed approach for loading JSON in ESM without a static `import` assertion

**Alternative pattern** (import assertion) is NOT recommended: `import pkg from '../package.json' assert { type: 'json' }` — import assertions are Stage 3/unstable as of 2026 and TypeScript's ESM handling for JSON requires special tsconfig flags. The `createRequire` pattern is simpler and already proven in this codebase.

---

## Architecture Patterns

### Canonical File Templates

#### Makefile (6 targets — use gemini/opencode as source)

```makefile
.PHONY: lint format test build clean dev

lint:
	npm run lint

format:
	npm run format

test:
	npm test

build:
	npm run build

clean:
	npm run clean

dev:
	npm run dev
```

All 6 repos already have these npm scripts in their package.json. The Makefile is purely a thin wrapper.

#### package.json additions for Gen1 repos (claude, codex, copilot, openhands)

Three fields to add:
```json
{
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```
And add to `scripts`:
```json
{
  "prepublishOnly": "npm run build"
}
```

Also update:
- `"license": "ISC"` → `"license": "MIT"`
- `"author": ""` → `"author": "tuannvm"`
- `"repository"` URL in claude/codex/openhands (currently points to codex-mcp-server GitHub)

#### MIT LICENSE file (OSI standard)

The REQUIREMENT says "MIT license with the correct author." The existing gemini/opencode LICENSE files say "MIT License (Non-Commercial)" which is NOT the standard OSI MIT license. STD-05 requires the real MIT text:

```
MIT License

Copyright (c) 2025 tuannvm

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Critical:** gemini and opencode already HAVE a LICENSE file but it uses Non-Commercial text — STD-05 says MIT. Their LICENSE files must also be replaced with the standard OSI text.

#### CHANGELOG.md (minimal initial content)

```markdown
# Changelog

## [Unreleased]

## [1.4.0] - 2026-02-22

- Initial public release
```

Use the actual current version from the repo's package.json.

#### CLAUDE.md

Copy the full CLAUDE.md from opencode-mcp-server or copilot-mcp-server (both have the same content — the QGSD operational policy). This is the binding policy document for each repo.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading version from package.json in ESM | Custom JSON parser, version constant file | `createRequire(import.meta.url)` | Standard Node.js pattern; proven in gemini/opencode |
| License text | Custom license verbiage | OSI MIT license text | Any deviation from standard MIT may invalidate `publishConfig: access: public` intent |
| Makefile build system | Shell scripts, custom runner | 6-target Makefile delegating to npm scripts | Already established pattern; zero new dependencies |

**Key insight:** All canonical templates already exist in the gemini and opencode repos. Copy-adapt, do not invent.

---

## openhands Rename: Full Surface Map (STD-01)

The rename from `codex-mcp-server` identity to `openhands-mcp-server` touches the following locations (all confirmed by grep):

### Source Files

| File | Change |
|------|--------|
| `src/index.ts` line 4 | `import { CodexMcpServer }` → `import { OpenHandsMcpServer }` |
| `src/index.ts` line 7 | `name: 'codex-mcp-server'` → `name: 'openhands-mcp-server'` |
| `src/index.ts` line 13 | `new CodexMcpServer(SERVER_CONFIG)` → `new OpenHandsMcpServer(SERVER_CONFIG)` |
| `src/server.ts` line 20 | `export class CodexMcpServer` → `export class OpenHandsMcpServer` |
| `src/__tests__/index.test.ts` line 34 | `import { CodexMcpServer }` → `import { OpenHandsMcpServer }` |
| `src/__tests__/index.test.ts` line 116 | `new CodexMcpServer(config)` → `new OpenHandsMcpServer(config)` |
| `src/__tests__/index.test.ts` line 117 | `expect(server).toBeInstanceOf(CodexMcpServer)` → `expect(server).toBeInstanceOf(OpenHandsMcpServer)` |

### package.json

| Field | Current | Target |
|-------|---------|--------|
| `name` | `codex-mcp-server` | `openhands-mcp-server` |
| `bin` key | `"codex-mcp-server": "dist/index.js"` | `"openhands-mcp-server": "dist/index.js"` |
| `description` | `MCP server wrapper for OpenAI Codex CLI` | `MCP server for OpenHands CLI integration` |
| `repository.url` | `github.com/tuannvm/codex-mcp-server.git` | `github.com/tuannvm/openhands-mcp-server.git` |
| `bugs.url` | `github.com/tuannvm/codex-mcp-server/issues` | `github.com/tuannvm/openhands-mcp-server/issues` |
| `homepage` | `github.com/tuannvm/codex-mcp-server#readme` | `github.com/tuannvm/openhands-mcp-server#readme` |

### package-lock.json

The `name` field at the root of package-lock.json also says `codex-mcp-server` — must be updated, or regenerate with `npm install`.

### Files NOT requiring changes (STD-01 scope exclusion)

- `src/utils/command.ts` lines 88/124/193 — These contain comments about "codex CLI" behavior, which refers to the OpenAI Codex CLI tool, not this server's identity. These are informational comments about the upstream CLI tool, NOT identity references. Leave as-is.
- `docs/plan.md`, `.planning/` files, `README.md` — Out of scope for STD-01 (docs/planning files). README has many codex references but README rewrite is not in Phase 23 scope.

---

## Common Pitfalls

### Pitfall 1: Non-Commercial vs. Standard MIT
**What goes wrong:** Assuming the existing gemini/opencode LICENSE files are the correct MIT template because they exist.
**Why it happens:** They say "MIT License" in the first line but add a non-commercial restriction that makes them NOT OSI-compliant MIT.
**How to avoid:** Use the OSI standard MIT text exactly. Replace both gemini and opencode LICENSE files.
**Warning signs:** LICENSE file says "non-commercial" or "commercial use prohibited" anywhere.

### Pitfall 2: ESM JSON Import via import assertion
**What goes wrong:** Using `import pkg from '../package.json' assert { type: 'json' }` instead of `createRequire`.
**Why it happens:** It looks cleaner; TypeScript supports it with `resolveJsonModule: true`.
**How to avoid:** Use `createRequire` pattern — it's already proven in the codebase and avoids TypeScript/Node.js version compatibility issues.
**Warning signs:** TypeScript errors about import assertions or jest transform errors during tests.

### Pitfall 3: Missing package-lock.json update for openhands rename
**What goes wrong:** package.json name is updated but package-lock.json still says `codex-mcp-server`.
**Why it happens:** package-lock.json has the name field at root and `packages[""]` node.
**How to avoid:** Run `npm install` in openhands-mcp-server after updating package.json, which regenerates the lock file with the correct name.
**Warning signs:** `npm publish` warnings about name mismatch between package.json and lock file.

### Pitfall 4: Incomplete Makefile .PHONY declaration
**What goes wrong:** Targets are added to Makefile but `.PHONY` declaration only lists `lint`.
**Why it happens:** Copying existing stub Makefiles that only have lint.
**How to avoid:** `.PHONY: lint format test build clean dev` — all 6 targets must be listed.
**Warning signs:** `make` treats an existing file named `test` or `build` as an up-to-date target.

### Pitfall 5: npm scoping change breaks existing Claude MCP config
**What goes wrong:** Adding `@tuannvm/` scope to unscoped repos breaks any `claude mcp add` install command that users have already configured.
**Why it happens:** The package name in the `claude_desktop_config.json` or MCP config won't auto-update.
**How to avoid:** Go with the unscoped direction (drop `@tuannvm/` from gemini only). This affects only gemini's existing users, not the 5 unscoped repos.
**Warning signs:** Thinking about adding scope to all — that's 5x more disruption.

### Pitfall 6: Forgetting openhands dynamic version alongside rename
**What goes wrong:** The rename (STD-01) is completed but STD-03 dynamic version is applied to the other 5 repos and missed on openhands.
**Why it happens:** openhands has the most changes and version-string fix can be overlooked amid the rename work.
**How to avoid:** The plan must explicitly list openhands as one of the 4 repos needing dynamic version fix (not just 3).

---

## Code Examples

### Dynamic Version Pattern (HIGH confidence — from opencode/gemini source)

```typescript
// src/index.ts — apply to claude, codex, copilot, openhands
#!/usr/bin/env node

import chalk from 'chalk';
import { ClaudeMcpServer } from './server.js';  // class name varies per repo
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const SERVER_CONFIG = {
  name: 'claude-mcp-server',  // matches package.json "name"
  version: pkg.version,       // reads from package.json at runtime
};

async function main(): Promise<void> {
  try {
    const server = new ClaudeMcpServer(SERVER_CONFIG);
    await server.start();
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

main();
```

### package.json additions for Gen1 repos

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write src/**/*.ts",
    "format:check": "prettier --check src/**/*.ts",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  },
  "author": "tuannvm",
  "license": "MIT"
}
```

---

## npm Scoping Decision (STD-10)

**Current situation:**
- 5 repos unscoped, 1 repo (`@tuannvm/gemini-mcp-server`) scoped
- STD-10 requires uniform choice

**Option A: Go unscoped (remove `@tuannvm/` from gemini)**
- Change gemini `name`: `@tuannvm/gemini-mcp-server` → `gemini-mcp-server`
- Change gemini `bin` key: `gemini-mcp-server` (already correct — bin key doesn't use the npm scope)
- Impact: gemini existing npm users need to update their install command; Claude MCP configs using `npx @tuannvm/gemini-mcp-server` break
- Simplest change; 1 package.json edit

**Option B: Add `@tuannvm/` to all 5 others**
- 5 package.json name field changes + bin key changes (bin keys don't use scope, so they stay the same)
- Impact: All existing `npx {repo-name}` install commands for 5 repos break for existing users
- More work, more disruption

**Recommendation:** Option A (go unscoped). Five repos are already unscoped and the standard npx usage pattern `npx {repo-name}` is simpler without a scope. The scope on gemini appears to be an artifact of its original upstream author (`jamubc`/`tuannvm` scoping conventions) that was not carried forward to the fork repos.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hardcoded version string `'0.0.6'` in index.ts | `createRequire` + `pkg.version` from package.json | Version auto-updates without touching source code |
| ISC license (permissive but less standard) | MIT license (OSI standard) | Cleaner for npm ecosystem; matches `publishConfig: public` intent |
| Stub Makefile (lint only) | Full 6-target Makefile | Developer experience parity with Gen2 repos |
| Mixed scoping (@tuannvm/ on gemini) | Uniform unscoped | Consistent `npx repo-name` install UX across all 6 |

---

## Open Questions

1. **Standard MIT vs Non-Commercial MIT for gemini/opencode LICENSE**
   - What we know: gemini and opencode have LICENSE files with "MIT License (Non-Commercial)" text — this is NOT standard MIT
   - What's unclear: Whether the user wants to replace these with standard MIT or keep them
   - Recommendation: STD-05 says "MIT license" (unqualified) — replace with OSI standard MIT text. If user intends non-commercial restriction, STD-05 wording is wrong and needs to be revisited before Phase 23 executes.

2. **npm scoping direction (STD-10)**
   - What we know: 5 unscoped, 1 scoped; research recommends unscoped
   - What's unclear: User preference (no CONTEXT.md provided)
   - Recommendation: Plan with unscoped as default (Option A). Add a decision note in the plan for user confirmation before any npm publish.

3. **openhands docs/ and .planning/ files with codex references**
   - What we know: docs/plan.md, docs/api-reference.md, README.md contain many `codex-mcp-server` references
   - What's unclear: Whether Phase 23 scope includes docs cleanup or only source/package identity
   - Recommendation: Scope Phase 23 strictly to the success criteria — source files, package.json, server config. Docs cleanup is deferred. Do not rename references in docs/ or .planning/.

---

## Sources

### Primary (HIGH confidence)
- Direct file inspection of all 6 repos at `/Users/jonathanborduas/code/{repo}/` — package.json, src/index.ts, Makefile, LICENSE, CHANGELOG.md, CLAUDE.md
- `createRequire` pattern confirmed from `/Users/jonathanborduas/code/gemini-mcp-server/src/index.ts` and `/Users/jonathanborduas/code/opencode-mcp-server/src/index.ts`
- Full grep of openhands-mcp-server for `CodexMcp|codex-mcp-server` confirming exact rename surface

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md STD-01 through STD-10 definitions confirmed against current state
- ROADMAP.md Phase 23 success criteria cross-referenced with audit findings

### Tertiary (LOW confidence)
- npm scoping direction recommendation based on current repo state analysis; actual user preference unknown

---

## Metadata

**Confidence breakdown:**
- Current state audit: HIGH — directly read all files
- Standard stack: HIGH — no new libraries; all patterns exist in codebase
- Architecture/templates: HIGH — gemini/opencode are the confirmed reference implementations
- openhands rename surface: HIGH — confirmed via grep with exact line numbers
- MIT license text: HIGH — OSI standard is well-defined
- npm scoping recommendation: MEDIUM — technical case is clear, user preference unknown

**Research date:** 2026-02-22
**Valid until:** 2026-04-22 (stable domain — npm packaging conventions do not change rapidly)
