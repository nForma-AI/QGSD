# Technology Stack: v0.42 Repowise Intelligence Integration

**Project:** nForma
**Milestone:** v0.42 — Repowise Intelligence Integration
**Researched:** 2026-04-11
**Overall confidence:** HIGH

## Recommended Stack

### Core Framework (existing — no changes)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js (CommonJS) | >=18.0.0 | CLI runtime | Already the project runtime; all hooks and bin scripts are `.cjs`/`.js` CommonJS |
| `child_process` (stdlib) | built-in | Git operations, CLI spawning | nForma uses raw `spawnSync`/`execSync`/`execFileSync` throughout (185+ call sites in bin/ alone). No reason to introduce `simple-git` — the raw approach works and avoids a runtime dependency. |
| `fs`/`path`/`crypto` (stdlib) | built-in | File I/O, path resolution, hashing | Already required in every module |
| esbuild | ^0.27.3 | Hook bundling | Already in devDependencies for `build:hooks` |

### Tree-Sitter (NEW — optionalDependency)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `web-tree-sitter` | ^0.26.8 | WASM-based Tree-sitter bindings | **WASM over native** because nForma installs via `npm install` and must work on any system without C++ build tools. Native `tree-sitter` requires node-gyp compilation which fails on systems without Xcode/Visual Studio. WASM "just works" — zero compilation, zero native dependencies. Performance is "considerably slower" than native per docs, but we're parsing single files for skeleton views, not incremental-editing IDE-scale files. The ~50ms parse time for a typical source file is negligible. |
| `tree-sitter-javascript` | ^0.25.0 | JS/JSX grammar | JavaScript is nForma's own language and the most common target language |
| `tree-sitter-python` | ^0.25.0 | Python grammar | Second most common target language in agent tooling projects |
| `tree-sitter-typescript` | ^0.23.2 | TypeScript grammar | nForma uses TypeScript internally (XState machines); common in target projects |
| `tree-sitter-bash` | ^0.25.1 | Bash grammar | nForma generates/inspects shell scripts; hooks contain bash patterns |

**Why `web-tree-sitter` (WASM) instead of `tree-sitter` (native):**
1. Native requires node-gyp + C++ compiler — fails on systems without build tools (common for npm-only users)
2. nForma is distributed as an npm package — installation must be `npm install && done`
3. WASM has no native dependency — loads from a `.wasm` file
4. The performance difference (~5-10x slower) is irrelevant for our use case (parse single file, extract skeleton, discard tree)
5. Already precedented: nForma uses `@huggingface/transformers` as `optionalDependency` — same pattern applies

**Lazy initialization pattern:**
```js
// Only load when skeleton view is requested, NOT at CLI startup
let _parser = null;
async function getParser(grammarPath) {
  if (!_parser) {
    const { Parser } = require('web-tree-sitter');
    await Parser.init();
    _parser = new Parser();
  }
  const lang = await Parser.Language.load(grammarPath);
  _parser.setLanguage(lang);
  return _parser;
}
```

**Grammar `.wasm` file resolution:**
Tree-sitter grammar packages ship `.wasm` files in their npm package (since v0.21+). Locate via:
```js
const grammarPath = require.resolve('tree-sitter-javascript/tree-sitter-javascript.wasm');
```
If the `.wasm` file is not found (grammar not installed), degrade gracefully — return a line-count + file-header based skeleton instead of an AST skeleton.

### XML Context Packing (NO new dependency)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| String templates (stdlib) | built-in | Generate XML-tagged context for LLMs | "XML-style context packing" means *producing* `<file path="...">content</file>` strings for LLM consumption, not *parsing* external XML. No `fast-xml-parser` or XML library needed — just template literals. This is the same pattern Claude Code itself uses for XML-tagged context injection. |

**Implementation pattern:**
```js
function packContext(files, options = {}) {
  const parts = files.map(f =>
    `<file path="${escapeXml(f.path)}" lang="${f.lang}">\n${f.content}\n</file>`
  );
  return `<context version="1" cwd="${escapeXml(options.cwd || '')}">\n${parts.join('\n')}\n</context>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
```

**Token reduction strategies (no library needed):**
- Omit blank lines and comment blocks via regex stripping before packing
- Truncate files beyond a configurable line limit (default: 200 lines)
- Collapse repeated blank lines to single blank line
- Include only file headers (first N lines) for reference files vs. full content for target files

### Hotspot Detection: Churn + Complexity (NO new dependency)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `child_process.spawnSync` (stdlib) | built-in | Git churn extraction | nForma already uses raw `spawnSync('git', [...args])` throughout. No `simple-git` needed. |
| Tree-sitter AST traversal | (web-tree-sitter) | Cyclomatic complexity from AST | Compute complexity from the same AST used for skeleton views. Count decision points: `if`, `else`, `for`, `while`, `switch_case`, `catch`, `&&`, `\|\|`, ternary. This gives language-agnostic cyclomatic complexity without needing `escomplex` (JavaScript-only, unmaintained since 2015, 271 stars but archived). |

**Why NOT escomplex:**
1. JavaScript-only — can't analyze Python, TypeScript, Bash, etc. (nForma works on polyglot repos)
2. Last release v1.3.0 was October 2015 — 11 years unmaintained
3. Depends on `acorn` for JS parsing — but we already have tree-sitter for AST
4. Tree-sitter gives us AST for every language with a grammar — one complexity algorithm, all languages

**Git churn extraction (existing pattern):**
```js
// Uses spawnSync — same pattern as 185+ existing call sites
const result = spawnSync('git', [
  'log', '--numstat', '--format=COMMIT%n%H',
  `--since=${sinceDate}`, '--', ...paths
], { cwd, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
```

**Complexity from tree-sitter AST:**
```js
// Decision point node types by language family
const DECISION_NODES = new Set([
  'if_statement', 'else_clause', 'for_statement', 'for_in_statement',
  'while_statement', 'do_statement', 'switch_case', 'catch_clause',
  'conditional_expression', // ternary
  'try_statement', // +1 for each catch
]);

function cyclomaticFromAST(rootNode) {
  let complexity = 1; // base
  traverse(rootNode, node => {
    if (DECISION_NODES.has(node.type)) complexity++;
    // Logical operators: && and || each add 1
    if (node.type === '&&' || node.type === '||') complexity++;
  });
  return complexity;
}
```

### Co-Change Prediction: Git History Mining (NO new dependency)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `child_process.spawnSync` (stdlib) | built-in | Git history extraction | Same raw git pattern used everywhere in nForma |
| Custom co-occurrence miner | new code | Association rule mining | Implement directly. The full Apriori algorithm (seratch/apriori.js, 34 stars, unmaintained since 2020) is overkill — we don't need frequent itemset generation for market basket analysis. We need: for each commit, extract the set of changed files; count co-occurrence pairs; compute support and confidence. This is a simplified version of association rule mining that's ~100 lines of code and doesn't warrant a dependency. |

**Why NOT `apriori` npm package:**
1. Last updated August 2020 — 6 years unmaintained
2. 34 GitHub stars, 15 forks — low community adoption
3. Depends on bower (deprecated package manager) and Grunt (legacy build tool)
4. The algorithm we need is simpler than full Apriori — we don't need k-itemset generation, just pair-level co-occurrence
5. A direct implementation avoids the dependency and can be tuned for our specific use case (e.g., file-path-aware distance metrics, time-window decay)

**Git history extraction pattern:**
```js
// Extract commit→files mapping for co-change analysis
const result = spawnSync('git', [
  'log', '--name-only', '--format=COMMIT%n%H',
  `--since=${sinceDate}`, '--no-merge'
], { cwd, encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
// Parse into: Map<commitHash, Set<filePath>>
// Then compute co-occurrence: Map<filePair, { count, support, confidence }>
```

## Supporting Libraries (optionalDependency — existing pattern)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@huggingface/transformers` | ^3.0.0 | Haiku-based task classification | Already in `optionalDependencies`. Same lazy-load pattern can be used for tree-sitter. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Tree-sitter binding | `web-tree-sitter` (WASM) | `tree-sitter` (native) | Native requires node-gyp + C++ compiler. Fails on systems without build tools. nForma must install via `npm install` without compilation steps. |
| Tree-sitter binding | `web-tree-sitter` (WASM) | Shell out to `tree-sitter-cli` | Extra system dependency (requires tree-sitter-cli installed globally). Can't embed in nForma package. No AST manipulation in-process. |
| Git operations | Raw `child_process.spawnSync` | `simple-git` (npm) | nForma already uses raw spawnSync at 185+ call sites. Adding simple-git creates inconsistency and a runtime dependency for functionality we already have. Raw git is also faster (no parsing overhead). |
| Complexity analysis | Tree-sitter AST traversal | `escomplex` | JS-only, unmaintained since 2015, depends on acorn parser. Tree-sitter gives us multi-language complexity from the same AST. |
| Complexity analysis | Tree-sitter AST traversal | `plato` / `complexity-report` | Built on escomplex, same JS-only limitation. Both archived. |
| Co-change mining | Custom co-occurrence counter | `apriori` npm package | Unmaintained since 2020, depends on bower/grunt, overkill for our needs (we need pair-level co-occurrence, not full k-itemset generation). ~100 lines of custom code vs. a dependency that does more than we need. |
| XML generation | String templates | `fast-xml-parser` XMLBuilder | XMLBuilder is for building XML documents from JS objects. Our use case is wrapping file content in XML tags for LLM context — string templates are simpler, zero-dependency, and more flexible (we control the exact format). |
| XML generation | String templates | `xml2js` builder | Same issue as fast-xml-parser — overkill for tag-wrapping, adds a dependency. |
| XML generation | String templates | `xmlbuilder` | Yet another XML builder. Our context format is simple and stable — template literals are sufficient. |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `simple-git` | Adds a runtime dependency for functionality already achieved via `child_process.spawnSync`. nForma's pattern is raw git commands — adding a wrapper library creates inconsistency and bloat. | Raw `spawnSync('git', [...args])` — same as 185+ existing call sites |
| `escomplex` | JavaScript-only, unmaintained since 2015. Can't compute complexity for Python, TypeScript, Bash, etc. | Tree-sitter AST decision-point counting (language-agnostic) |
| `apriori` npm package | Unmaintained since 2020, depends on bower (deprecated) and grunt (legacy), does more than we need. | Custom co-occurrence counter (~100 lines) |
| `fast-xml-parser` / `xmlbuilder` / `xml2js` | We're *generating* XML-tagged strings, not parsing XML documents. Template literals are sufficient and dependency-free. | String template literals with `escapeXml()` helper |
| `tree-sitter` (native bindings) | Requires C++ compilation (node-gyp). Breaks `npm install` on systems without build tools. nForma users should never need to compile C++ code. | `web-tree-sitter` (WASM) — zero compilation |
| `acorn` / `espree` / other JS parsers | We need multi-language parsing, not just JavaScript. Tree-sitter with grammars handles JS, Python, TypeScript, Bash, and 50+ other languages. | `web-tree-sitter` + per-language grammar packages |

## Installation

```bash
# Core — always installed (no new runtime deps needed)
npm install  # existing deps only

# Tree-sitter support — optional, lazy-loaded
npm install web-tree-sitter@^0.26.8 tree-sitter-javascript@^0.25.0 tree-sitter-python@^0.25.0 tree-sitter-typescript@^0.23.2 tree-sitter-bash@^0.25.1
```

**optionalDependency pattern (matching existing `@huggingface/transformers`):**

```json
{
  "optionalDependencies": {
    "@huggingface/transformers": "^3.0.0",
    "web-tree-sitter": "^0.26.8",
    "tree-sitter-javascript": "^0.25.0",
    "tree-sitter-python": "^0.25.0",
    "tree-sitter-typescript": "^0.23.2",
    "tree-sitter-bash": "^0.25.1"
  }
}
```

**Graceful degradation:** If `web-tree-sitter` is not installed:
- Skeleton views fall back to line-count + file-header based summaries (no AST)
- Complexity scoring falls back to line-count heuristic (lines / 10 as rough proxy)
- Churn analysis and co-change prediction still work (they use only `git log`)
- Context packing still works (it's just string templates)

## Grammar Package Compatibility

Tree-sitter grammar npm packages must be compatible with `web-tree-sitter` version. The `.wasm` files are shipped in the grammar package since tree-sitter grammar ABI v14+.

**Key grammars for nForma:**

| Package | npm Name | Language | Why Needed |
|---------|----------|----------|------------|
| tree-sitter-javascript | `tree-sitter-javascript` | JS/JSX | nForma's own codebase + most common target |
| tree-sitter-python | `tree-sitter-python` | Python | Common in ML/data projects |
| tree-sitter-typescript | `tree-sitter-typescript` | TypeScript/TSX | nForma's XState machines; common in modern web |
| tree-sitter-bash | `tree-sitter-bash` | Bash | nForma hooks contain shell scripts; CI/config files |

**Extended grammars** (add on demand, not in default package):
- `tree-sitter-c` — C source analysis
- `tree-sitter-cpp` — C++ source analysis
- `tree-sitter-java` — Java source analysis
- `tree-sitter-go` — Go source analysis
- `tree-sitter-rust` — Rust source analysis
- `tree-sitter-ruby` — Ruby source analysis

The architecture should support a grammar registry: user can add `.wasm` grammar files, and nForma discovers them at runtime. This makes the system extensible without adding every grammar as a dependency.

## Version Compatibility Notes

| Technology | Constraint | Notes |
|------------|-----------|-------|
| `web-tree-sitter` | ^0.26.8 | Verified on npm: `npm view web-tree-sitter version` returns 0.26.8 (April 2026). |
| Grammar packages | ABI 14+ | Required for `.wasm` file inclusion. All grammars listed above have ABI >= 14. Verified versions: tree-sitter-javascript@0.25.0, tree-sitter-python@0.25.0, tree-sitter-typescript@0.23.2, tree-sitter-bash@0.25.1 |
| Node.js | >=18.0.0 | Already constrained by nForma's `engines` field. WASM support is native in Node.js 18+. |

## Sources

- **web-tree-sitter** — Official Tree-sitter WASM bindings documentation: https://tree-sitter.github.io/node-tree-sitter (HIGH confidence — official docs)
- **web-tree-sitter** — GitHub repository with README, installation, API: https://github.com/tree-sitter/node-tree-sitter (HIGH confidence — source repo)
- **web-tree-sitter** — WASM binding README (setup, Node.js usage, `.wasm` generation): https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web (HIGH confidence — official repo)
- **tree-sitter grammar list** — Official wiki with ABI versions: https://github.com/tree-sitter/tree-sitter/wiki/List-of-parsers (HIGH confidence — official community wiki)
- **simple-git** — Full API documentation: https://github.com/steveukx/git-js (MEDIUM confidence — verified source, but NOT recommended for use)
- **escomplex** — JavaScript complexity analysis library: https://github.com/escomplex/escomplex (MEDIUM confidence — verified source, but NOT recommended; unmaintained since 2015)
- **apriori.js** — Apriori algorithm in JS: https://github.com/seratch/apriori.js (LOW confidence — verified but unmaintained since 2020; NOT recommended)
- **fast-xml-parser** — XML parser/builder: https://github.com/NaturalIntelligence/fast-xml-parser (MEDIUM confidence — verified source, but NOT recommended for our use case)
- **nForma codebase** — Direct grep of `child_process` usage across bin/, hooks/, core/ (HIGH confidence — primary source)
- **nForma package.json** — Existing dependency tree, optionalDependency pattern (HIGH confidence — primary source)

---

*Stack research for: nForma v0.42 Repowise Intelligence Integration (XML context packing, Tree-sitter skeleton views, hotspot detection, co-change prediction)*
*Researched: 2026-04-11*
