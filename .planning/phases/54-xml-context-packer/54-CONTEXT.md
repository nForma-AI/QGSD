# Phase 54: XML Context Packer - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Zero-dependency XML-style tagged format for delivering file contents to LLMs. Produces well-formed XML output with `<file>` tags and an `escapeXml()` safety helper. The `context-packer.cjs` entry point orchestrates all Repowise modules (skeleton, hotspot, co-change) into a unified packed context output. Phases 55-58 will fill in the intelligence modules; this phase builds the delivery format they all feed into.

</domain>

<decisions>
## Implementation Decisions

### Directory structure
- Repowise modules live in `bin/repowise/` subdirectory — namespace isolation from the flat `bin/` modules
- `context-packer.cjs` is the single entry point at `bin/repowise/context-packer.cjs`
- Core primitives (`escape-xml.cjs`, `pack-file.cjs`) live alongside in `bin/repowise/`

### XML format design
- Primary tag: `<file path="relative/path.js" lang="js">...</file>` — includes language attribute for syntax-aware consumers
- Section wrappers: `<repowise><skeleton>...</skeleton><hotspot>...</hotspot><cochange>...</cochange></repowise>` — top-level structure for all signals
- `escapeXml()` handles all five XML-special characters: `<`, `>`, `&`, `"`, `'` using standard XML entity replacements
- No XML parsing — this module GENERATES XML tags only, never parses them
- Template literals with escapeXml() are sufficient — no template engine or XML library needed

### escapeXml() implementation
- Replacement map: `{ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }`
- Must replace `&` FIRST to prevent double-encoding (e.g., `&lt;` becoming `&amp;lt;`)
- Exposed as a named export for reuse by other Repowise modules and for testing
- Pure function — no side effects, no I/O

### packFile() implementation
- Accepts `{ filePath, content, lang? }` and returns a string wrapped in `<file>` tags
- Uses escapeXml() on the content before wrapping
- `lang` is optional — auto-detected from file extension if not provided
- Extension-to-language mapping for common languages (js, ts, py, etc.)

### context-packer.cjs entry point
- CLI usage: `node bin/repowise/context-packer.cjs [options]`
- Options: `--files=path1,path2`, `--stdin`, `--json` (structured output), `--project-root=/path`
- Sections for skeleton, hotspot, co-change initially render as empty `<skeleton/>`, `<hotspot/>`, `<cochange/>` self-closing tags (placeholder format for Phases 55-57)
- Each section has an `available` boolean attribute: `available="false"` until the corresponding phase ships
- Exit codes: 0 = success, 1 = error (matches OBS-01 convention)
- Errors to stderr, output to stdout (OBS-01)

### Integration point
- Called at the same workflow step as `design-impact.cjs` and `formal-scope-scan.cjs`
- Future workflow wiring (not this phase) will add context-packer to the executor pipeline

### Zero new dependencies
- Pure string templating — no xmlbuilder, fast-xml-parser, or similar packages
- Node.js built-ins only (fs, path, child_process for git operations in later phases)

### Claude's Discretion
- Exact formatting of XML output (indentation, line breaks)
- Extension-to-language mapping completeness (cover 10+ common languages minimum)
- Error message wording for invalid inputs
- Whether to add `--pretty` flag for human-readable vs compact output

</decisions>

<specifics>
## Specific Ideas

- XML packing means GENERATING XML tags, not parsing — this is a one-way transform
- Template literals with escapeXml() are sufficient — no XML library needed
- Output sections for skeleton, hotspot, and co-change should initially be empty placeholders
- The `<file>` tag format matches what LLMs already understand from tools like Aider's repo map
- Integration point: same workflow step as design-impact.cjs and formal-scope-scan.cjs

</specifics>

<deferred>
## Deferred Ideas

- Token budget compression (PACK-04) — Phase 58
- Hotspot detection wiring into context-packer — Phase 55
- Co-change detection wiring into context-packer — Phase 56
- Skeleton views wiring into context-packer — Phase 57
- Grammar auto-discovery (PACK-05) — Repowise v2

</deferred>

---

*Phase: 54-xml-context-packer*
*Context gathered: 2026-04-11*
