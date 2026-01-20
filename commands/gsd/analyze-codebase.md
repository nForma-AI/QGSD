---
name: gsd:analyze-codebase
description: Scan existing codebase and populate .planning/intel/ with file index and conventions
argument-hint: ""
allowed-tools:
  - Read
  - Bash
  - Glob
  - Write
---

<objective>
Scan codebase to populate .planning/intel/ with file index and conventions.

Works standalone (without /gsd:new-project) for brownfield codebases. Creates summary.md for context injection at session start.

Output: .planning/intel/index.json, conventions.json, summary.md
</objective>

<context>
This command performs bulk codebase scanning to bootstrap the Codebase Intelligence system.

**Use for:**
- Brownfield projects before /gsd:new-project
- Refreshing intel after major changes
- Standalone intel without full project setup

After initial scan, the PostToolUse hook (hooks/intel-index.js) maintains incremental updates.
</context>

<process>

## Step 1: Create directory structure

```bash
mkdir -p .planning/intel
```

## Step 2: Find all indexable files

Use Glob tool with pattern: `**/*.{js,ts,jsx,tsx,mjs,cjs}`

Exclude directories (skip any path containing):
- node_modules
- dist
- build
- .git
- vendor
- coverage
- .next
- __pycache__

Filter results to remove excluded paths before processing.

## Step 3: Process each file

Initialize the index structure:
```javascript
{
  version: 1,
  updated: Date.now(),
  files: {}
}
```

For each file found:

1. Read file content using Read tool

2. Extract exports using these patterns:
   - Named exports: `export\s*\{([^}]+)\}`
   - Declaration exports: `export\s+(?:const|let|var|function\*?|async\s+function|class)\s+(\w+)`
   - Default exports: `export\s+default\s+(?:function\s*\*?\s*|class\s+)?(\w+)?`
   - CommonJS object: `module\.exports\s*=\s*\{([^}]+)\}`
   - CommonJS single: `module\.exports\s*=\s*(\w+)\s*[;\n]`
   - TypeScript: `export\s+(?:type|interface)\s+(\w+)`

3. Extract imports using these patterns:
   - ES6: `import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]`
   - Side-effect: `import\s+['"]([^'"]+)['"]` (not preceded by 'from')
   - CommonJS: `require\s*\(\s*['"]([^'"]+)['"]\s*\)`

4. Store in index:
   ```javascript
   index.files[absolutePath] = {
     exports: [],  // Array of export names
     imports: [],  // Array of import sources
     indexed: Date.now()
   }
   ```

## Step 4: Detect conventions

Analyze the collected index for patterns.

**Naming conventions** (require 5+ exports, 70%+ match rate):
- camelCase: `^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+$` or single lowercase `^[a-z][a-z0-9]*$`
- PascalCase: `^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*$` or single `^[A-Z][a-z0-9]+$`
- snake_case: `^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$`
- SCREAMING_SNAKE: `^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$` or single `^[A-Z][A-Z0-9]*$`
- Skip 'default' when counting (it's a keyword, not naming convention)

**Directory patterns** (use lookup table):
```
components -> UI components
hooks -> React/custom hooks
utils, lib -> Utility functions
services -> Service layer
api, routes -> API endpoints
types -> TypeScript types
models -> Data models
tests, __tests__, test, spec -> Test files
controllers -> Controllers
middleware -> Middleware
config -> Configuration
constants -> Constants
pages -> Page components
views -> View templates
```

**Suffix patterns** (require 5+ occurrences):
```
.test.*, .spec.* -> Test files
.service.* -> Service layer
.controller.* -> Controllers
.model.* -> Data models
.util.*, .utils.* -> Utility functions
.helper.*, .helpers.* -> Helper functions
.config.* -> Configuration
.types.*, .type.* -> TypeScript types
.hook.*, .hooks.* -> React/custom hooks
.context.* -> React context
.store.* -> State store
.slice.* -> Redux slice
.reducer.* -> Redux reducer
.action.*, .actions.* -> Redux actions
.api.* -> API layer
.route.*, .routes.* -> Route definitions
.middleware.* -> Middleware
.schema.* -> Schema definitions
.mock.*, .mocks.* -> Mock data
.fixture.*, .fixtures.* -> Test fixtures
```

## Step 5: Write index.json

Write to `.planning/intel/index.json`:
```javascript
{
  "version": 1,
  "updated": 1737360330000,
  "files": {
    "/absolute/path/to/file.js": {
      "exports": ["functionA", "ClassB"],
      "imports": ["react", "./utils"],
      "indexed": 1737360330000
    }
  }
}
```

## Step 6: Write conventions.json

Write to `.planning/intel/conventions.json`:
```javascript
{
  "version": 1,
  "updated": 1737360330000,
  "naming": {
    "exports": {
      "dominant": "camelCase",
      "count": 42,
      "percentage": 85
    }
  },
  "directories": {
    "components": { "purpose": "UI components", "files": 15 },
    "hooks": { "purpose": "React/custom hooks", "files": 8 }
  },
  "suffixes": {
    ".test.js": { "purpose": "Test files", "count": 12 }
  }
}
```

## Step 7: Generate summary.md

Write to `.planning/intel/summary.md`:

```markdown
# Codebase Intelligence Summary

Last updated: [ISO timestamp]
Indexed files: [N]

## Naming Conventions

- Export naming: [case] ([percentage]% of [count] exports)

## Key Directories

- `[dir]/`: [purpose] ([N] files)
- ... (top 5)

## File Patterns

- `*[suffix]`: [purpose] ([count] files)
- ... (top 3)

Total exports: [N]
```

Target: < 500 tokens. Keep concise for context injection.

## Step 8: Report completion

Display summary statistics:

```
Codebase Analysis Complete

Files indexed: [N]
Exports found: [N]
Imports found: [N]

Conventions detected:
- Naming: [dominant case] ([percentage]%)
- Directories: [list]
- Patterns: [list]

Files created:
- .planning/intel/index.json
- .planning/intel/conventions.json
- .planning/intel/summary.md

Next: Intel hooks will continue incremental learning as you code.
```

</process>

<output>
- .planning/intel/index.json - File index with exports and imports
- .planning/intel/conventions.json - Detected naming and structural patterns
- .planning/intel/summary.md - Concise summary for context injection
</output>

<success_criteria>
- [ ] .planning/intel/ directory created
- [ ] All JS/TS files scanned (excluding node_modules, dist, build, .git, vendor, coverage)
- [ ] index.json populated with exports and imports for each file
- [ ] conventions.json has detected patterns (naming, directories, suffixes)
- [ ] summary.md is concise (< 500 tokens)
- [ ] Statistics reported to user
</success_criteria>
