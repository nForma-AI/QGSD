# Phase 57: Skeleton Views - Context

**Gathered:** 2026-04-11
**Status:** Ready for implementation

<domain>
## Phase Boundary

AST-based structural code views via web-tree-sitter WASM with lazy initialization. Produces skeleton output showing function/class/method names with line ranges at ~5-10% of original token count. Enriches skeleton with hotspot risk scores and coupling degree from Phases 55-56. Includes AST-based cyclomatic complexity (HOT-02 upgrade).

Key risk: web-tree-sitter WASM initialization. Mitigated by:
1. Lazy init (Parser.init() on first use, not at module load)
2. Fail-open: if web-tree-sitter fails to initialize, fall back to regex-based skeleton extraction
3. Grammar loading is also lazy and fail-open per language
</domain>

<decisions>
## Implementation Decisions

### web-tree-sitter integration (SKEL-01)
- `web-tree-sitter` added as `optionalDependency` — already installed
- Grammar packages (`tree-sitter-javascript`, `tree-sitter-typescript`, `tree-sitter-python`) added as `optionalDependency`
- Lazy initialization: `Parser.init()` called once on first parse attempt, cached via promise
- WASM files loaded from `node_modules/<grammar-package>/` using `Language.load(wasmPath)`
- Fail-open: if web-tree-sitter or any grammar fails, fall back to regex-based extraction

### Grammar management (SKEL-03)
- Bundled grammars: JavaScript, TypeScript, TSX, Python
- Grammar WASM file paths resolved via `require.resolve('<grammar-package>/<name>.wasm')`
- If a grammar WASM isn't found, that language uses regex fallback
- `LANG_GRAMMAR_MAP` maps extensions to grammar WASM paths

### Skeleton extraction (SKEL-02)
- AST-based: walk tree, extract nodes matching "definition" types (function_declaration, class_declaration, method_definition, etc.)
- Per-language definition node types:
  - JS/TS: function_declaration, function, arrow_function, class_declaration, method_definition, generator_function_declaration
  - Python: function_definition, class_definition
- Output: `<entry type="function" name="hello" start="1" end="3" complexity="1"/>`
- Token reduction target: 5-10% of original (names + line ranges only)

### AST-based complexity (HOT-02)
- Count decision points in AST: if_statement, for_statement, while_statement, conditional_expression, switch_case, catch_clause, and_clause, or_clause
- complexity = decision_point_count + 1 (standard cyclomatic formula)
- This replaces the heuristic line-count from Phase 55 when AST is available

### Enrichment (SKEL-04)
- Skeleton entries for files with hotspot risk > 0.4 get `hotspot_risk` attribute
- Skeleton entries for files with strong co-change coupling get `coupling_degree` attribute
- Uses cached hotspot and co-change data from Phases 55-56

### Directory structure
- `bin/repowise/skeleton.cjs` — AST skeleton extraction + regex fallback + complexity + enrichment
- `bin/repowise/skeleton.test.cjs` — tests
- Updates to `context-packer.cjs` for `--skeleton` flag
- Updates to `hotspot.cjs` for AST-based complexity (HOT-02)

### Regex fallback
When web-tree-sitter is unavailable:
- Extract function/method/class signatures via regex
- JS/TS: `/^(export\s+)?(async\s+)?(function|const|let|var|class)\s+(\w+)/m`
- Python: `/^(def|class)\s+(\w+)/m`
- No complexity calculation — falls back to heuristic line count
</decisions>

<specifics>
## Specific Ideas

- Parser.init() is async — the module stores the init promise and awaits it on each parse call
- Grammar WASM paths are resolved once at module load time (but Language.load is lazy)
- Skeleton cache keyed by `filePath:gitSha` in `.planning/repowise/skeleton-cache.json`
- Cache TTL: 7 days (skeletons change less frequently than hotspots)
- The `--skeleton` flag in context-packer triggers skeleton generation for all packed files

</specifics>

<deferred>
## Deferred Ideas

- Grammar auto-discovery (PACK-05) — Repowise v2
- Multi-language grammar hot-reload — Repowise v2
- Per-function hotspot scoring — Repowise v2
</deferred>

---

*Phase: 57-skeleton-views*
*Context gathered: 2026-04-11*
