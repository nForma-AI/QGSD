# Codebase Intelligence System

## Vision

A living, breathing knowledge system that learns your codebase patterns as you build, provides real-time advisory during execution, and injects accumulated wisdom into every Claude session—without API calls, without manual maintenance, without going stale.

**The experience:** By session 5, Claude knows where services go, what naming conventions you use, and what patterns have emerged—because it learned from watching you build.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Design Principles](#design-principles)
3. [Architecture Overview](#architecture-overview)
4. [Hook System](#hook-system)
5. [Data Structures](#data-structures)
6. [Pattern Detection Engine](#pattern-detection-engine)
7. [Convention Learning](#convention-learning)
8. [GSD Integration](#gsd-integration)
9. [User Experience](#user-experience)
10. [Implementation Plan](#implementation-plan)
11. [Future Extensions](#future-extensions)

---

## Problem Statement

### Current State: `map-codebase`

The existing GSD approach to codebase understanding has fundamental limitations:

| Issue | Impact |
|-------|--------|
| **Point-in-time snapshots** | 7 markdown docs generated once, immediately stale |
| **Human-readable but not machine-actionable** | Claude re-parses prose every time |
| **Passive consumption** | Docs sit idle; planners/executors may not load them |
| **No feedback loop** | Learnings during execution don't flow back |
| **Heavy upfront cost** | 4 parallel agents do deep analysis before any code exists |
| **Brownfield-first design** | Assumes existing code to analyze; awkward for greenfield |

### The Mental Model Problem

`map-codebase` treats codebase understanding as a **document generation task**—a one-time survey that produces static artifacts.

The correct mental model: codebase understanding is a **living knowledge system** that evolves with the code.

### User Feedback

Users report `map-codebase` isn't effective because:
- Output is verbose but not actionable
- Planners don't consistently use the generated docs
- No way to correct or refine the understanding
- Manual refresh required after significant changes
- Greenfield projects get no benefit until substantial code exists

---

## Design Principles

### 1. Build Incrementally, Not Upfront

For greenfield projects (primary GSD use case), there's nothing to map at start. Intelligence should build as code is written:

```
Phase 1: Creates src/services/user.service.ts
Phase 2: Creates src/services/auth.service.ts
Phase 3: Claude should KNOW "services go in src/services/*.service.ts"
```

### 2. Zero API Calls for Core Functionality

The intelligence system must work:
- Offline
- Without cost
- Without latency
- Without external dependencies

Core operations use only:
- Tree-sitter (local AST parsing)
- JSON file manipulation
- Algorithmic pattern detection

### 3. Hooks as Infrastructure

Claude Code's hook system provides the integration points:
- **PostToolUse**: Observe what Claude writes
- **PreToolUse**: Advise before Claude writes
- **SessionStart**: Inject accumulated knowledge

No custom tooling required—leverage existing infrastructure.

### 4. Advisory, Not Blocking

Following GSD philosophy ("no checkpoints for automatable work"), convention checks are advisory:
- Show the deviation
- Let Claude proceed
- Record the decision
- Learn from exceptions

### 5. Confidence-Based Learning

Not all patterns are equal:
- 2 files matching: Coincidence (no rule)
- 3 files matching: Tentative pattern (60% confidence)
- 5+ files matching: Established convention (80%+ confidence)
- Exceptions reduce confidence; consistency increases it

### 6. Greenfield-First, Brownfield-Compatible

Optimize for projects starting from scratch. Support existing codebases through optional deep scan.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Codebase Intelligence System                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐                           ┌────────────────────┐    │
│  │    Claude      │                           │    intel-index.js  │    │
│  │    Session     │                           │    (PostToolUse)   │    │
│  │                │                           │                    │    │
│  │  Write tool ───┼─── PostToolUse hook ────► │  • Parse AST       │    │
│  │  executes      │         (async)           │  • Extract exports │    │
│  │                │                           │  • Update indices  │    │
│  │                │                           │  • Detect patterns │    │
│  └────────────────┘                           └─────────┬──────────┘    │
│          │                                              │               │
│          │                                              ▼               │
│          │                              ┌───────────────────────────┐   │
│          │                              │   .planning/intel/        │   │
│          │                              │                           │   │
│          │                              │  ┌─────────────────────┐  │   │
│          │                              │  │   structure.json    │  │   │
│          │                              │  │   (files, exports)  │  │   │
│          │                              │  └─────────────────────┘  │   │
│          │                              │                           │   │
│          │ Query                        │  ┌─────────────────────┐  │   │
│          │                              │  │  conventions.json   │  │   │
│          │                              │  │  (rules+confidence) │  │   │
│          │                              │  └─────────────────────┘  │   │
│          │                              │                           │   │
│          │                              │  ┌─────────────────────┐  │   │
│          │                              │  │    summary.md       │  │   │
│          │                              │  │  (human-readable)   │  │   │
│          │                              │  └─────────────────────┘  │   │
│          │                              │                           │   │
│          │                              │  ┌─────────────────────┐  │   │
│          │                              │  │   semantic.db       │  │   │
│          │                              │  │   (optional)        │  │   │
│          │                              │  └─────────────────────┘  │   │
│          │                              └───────────────────────────┘   │
│          │                                              ▲               │
│          │                                              │               │
│  ┌───────┴────────┐                           ┌────────┴───────────┐   │
│  │    Claude      │                           │  intel-advise.js   │   │
│  │    Session     │                           │   (PreToolUse)     │   │
│  │                │                           │                    │   │
│  │  Write tool ◄──┼─── PreToolUse hook ────── │  • Check path      │   │
│  │  about to      │        (sync)             │  • Match patterns  │   │
│  │  execute       │                           │  • Return advisory │   │
│  │                │                           │                    │   │
│  └────────────────┘                           └────────────────────┘   │
│          ▲                                                              │
│          │                                                              │
│  ┌───────┴────────┐                           ┌────────────────────┐   │
│  │   Session      │                           │   intel-init.js    │   │
│  │   Starts       │◄── SessionStart hook ──── │   (SessionStart)   │   │
│  │                │                           │                    │   │
│  │  Context now   │        injects            │  • Read summary.md │   │
│  │  includes      │     <codebase-intel>      │  • Output to ctx   │   │
│  │  conventions   │                           │                    │   │
│  └────────────────┘                           └────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Write     │     │   Parse     │     │   Update    │     │  Regenerate │
│   File      │────►│   AST       │────►│   Indices   │────►│   Summary   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Extract    │     │   Detect    │
                    │  Exports    │     │  Patterns   │
                    └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │   Update    │
                                       │ Confidence  │
                                       └─────────────┘
```

---

## Hook System

### Overview

Three hooks work together to create the intelligence loop:

| Hook | Trigger | Mode | Purpose |
|------|---------|------|---------|
| `intel-index.js` | PostToolUse (Write/Edit) | Async | Index new code, detect patterns |
| `intel-advise.js` | PreToolUse (Write) | Sync | Advisory on convention deviations |
| `intel-init.js` | SessionStart | Sync | Inject knowledge into context |

### Hook 1: intel-index.js (PostToolUse)

**Trigger:** After every Write or Edit tool execution

**Purpose:** Extract structure and update indices

**Process:**
1. Receive tool execution details via stdin (JSON)
2. Skip non-code files
3. Parse file content with tree-sitter
4. Extract exports, imports, patterns
5. Update `structure.json`
6. Run pattern detection
7. Update `conventions.json` if new patterns found
8. Regenerate `summary.md`

**Performance:** Async, non-blocking. Can take 100-500ms without affecting Claude.

```javascript
#!/usr/bin/env node
// ~/.claude/hooks/intel-index.js

const fs = require('fs');
const path = require('path');
const Parser = require('tree-sitter');
const TypeScript = require('tree-sitter-typescript').typescript;
const JavaScript = require('tree-sitter-javascript');
const Python = require('tree-sitter-python');

// Language configuration
const LANGUAGES = {
  '.ts': TypeScript,
  '.tsx': TypeScript,
  '.js': JavaScript,
  '.jsx': JavaScript,
  '.py': Python,
};

const CODE_EXTENSIONS = Object.keys(LANGUAGES);

// Main execution
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  try {
    await processHookEvent(JSON.parse(input));
  } catch (err) {
    // Silent failure - never break Claude's workflow
    if (process.env.INTEL_DEBUG) {
      console.error('Intel indexer error:', err.message);
    }
  }
  process.exit(0);
});

async function processHookEvent(event) {
  // Only process Write and Edit tools
  if (!['Write', 'Edit'].includes(event.tool_name)) {
    return;
  }

  const filePath = event.tool_input.file_path;
  const content = event.tool_input.content || event.tool_input.new_string;

  // Skip non-code files
  if (!isCodeFile(filePath)) {
    return;
  }

  // Find project root
  const projectRoot = findProjectRoot(filePath);
  if (!projectRoot) {
    return; // Not a GSD project
  }

  const intelDir = path.join(projectRoot, '.planning', 'intel');
  ensureIntelDir(intelDir);

  // For Edit tool, we need to read the full file content
  let fullContent = content;
  if (event.tool_name === 'Edit') {
    try {
      fullContent = fs.readFileSync(filePath, 'utf8');
    } catch {
      return; // File doesn't exist yet or read error
    }
  }

  // Extract information from the file
  const fileInfo = extractFileInfo(filePath, fullContent);

  // Update indices
  updateStructure(intelDir, filePath, fileInfo);
  updateConventions(intelDir);
  regenerateSummary(intelDir);
}

function isCodeFile(filePath) {
  return CODE_EXTENSIONS.includes(path.extname(filePath));
}

function findProjectRoot(filePath) {
  let dir = path.isAbsolute(filePath) ? path.dirname(filePath) : process.cwd();
  const maxDepth = 10;
  let depth = 0;

  while (dir !== '/' && depth < maxDepth) {
    if (fs.existsSync(path.join(dir, '.planning'))) {
      return dir;
    }
    dir = path.dirname(dir);
    depth++;
  }
  return null;
}

function ensureIntelDir(intelDir) {
  if (!fs.existsSync(intelDir)) {
    fs.mkdirSync(intelDir, { recursive: true });
  }
}

function extractFileInfo(filePath, content) {
  const ext = path.extname(filePath);
  const language = LANGUAGES[ext];

  if (!language) {
    return {
      exports: [],
      imports: [],
      directory: path.dirname(filePath),
      filename: path.basename(filePath),
      relativePath: filePath,
    };
  }

  const parser = new Parser();
  parser.setLanguage(language);

  let tree;
  try {
    tree = parser.parse(content);
  } catch {
    return {
      exports: [],
      imports: [],
      directory: path.dirname(filePath),
      filename: path.basename(filePath),
      relativePath: filePath,
    };
  }

  return {
    exports: extractExports(tree.rootNode, ext),
    imports: extractImports(tree.rootNode, ext),
    directory: path.dirname(filePath),
    filename: path.basename(filePath),
    relativePath: filePath,
    lineCount: content.split('\n').length,
  };
}

function extractExports(rootNode, ext) {
  const exports = [];

  // TypeScript/JavaScript exports
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    walkTree(rootNode, node => {
      // export class Foo
      if (node.type === 'export_statement') {
        const declaration = node.childForFieldName('declaration');
        if (declaration) {
          if (declaration.type === 'class_declaration') {
            const name = declaration.childForFieldName('name');
            if (name) {
              exports.push({
                name: name.text,
                type: 'class',
                line: node.startPosition.row + 1,
              });
            }
          } else if (declaration.type === 'function_declaration') {
            const name = declaration.childForFieldName('name');
            if (name) {
              exports.push({
                name: name.text,
                type: 'function',
                line: node.startPosition.row + 1,
              });
            }
          } else if (declaration.type === 'lexical_declaration') {
            // export const foo = ...
            for (const child of declaration.children) {
              if (child.type === 'variable_declarator') {
                const name = child.childForFieldName('name');
                if (name) {
                  exports.push({
                    name: name.text,
                    type: 'const',
                    line: node.startPosition.row + 1,
                  });
                }
              }
            }
          }
        }
      }

      // export default
      if (node.type === 'export_default_declaration') {
        exports.push({
          name: 'default',
          type: 'default',
          line: node.startPosition.row + 1,
        });
      }
    });
  }

  // Python exports (functions and classes at module level)
  if (ext === '.py') {
    for (const child of rootNode.children) {
      if (child.type === 'class_definition') {
        const name = child.childForFieldName('name');
        if (name && !name.text.startsWith('_')) {
          exports.push({
            name: name.text,
            type: 'class',
            line: child.startPosition.row + 1,
          });
        }
      } else if (child.type === 'function_definition') {
        const name = child.childForFieldName('name');
        if (name && !name.text.startsWith('_')) {
          exports.push({
            name: name.text,
            type: 'function',
            line: child.startPosition.row + 1,
          });
        }
      }
    }
  }

  return exports;
}

function extractImports(rootNode, ext) {
  const imports = [];

  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    walkTree(rootNode, node => {
      if (node.type === 'import_statement') {
        const source = node.childForFieldName('source');
        if (source) {
          imports.push({
            source: source.text.replace(/['"]/g, ''),
            line: node.startPosition.row + 1,
          });
        }
      }
    });
  }

  if (ext === '.py') {
    walkTree(rootNode, node => {
      if (node.type === 'import_statement' || node.type === 'import_from_statement') {
        const moduleName = node.childForFieldName('module_name');
        if (moduleName) {
          imports.push({
            source: moduleName.text,
            line: node.startPosition.row + 1,
          });
        }
      }
    });
  }

  return imports;
}

function walkTree(node, callback) {
  callback(node);
  for (const child of node.children) {
    walkTree(child, callback);
  }
}

function updateStructure(intelDir, filePath, fileInfo) {
  const structurePath = path.join(intelDir, 'structure.json');
  let structure = loadJSON(structurePath, {
    version: 1,
    lastUpdated: null,
    directories: {},
    files: {},
    exports: {},
  });

  // Get relative path from project root
  const projectRoot = path.dirname(path.dirname(intelDir));
  const relativePath = path.relative(projectRoot, filePath);
  const relativeDir = path.dirname(relativePath);

  // Update directory tracking
  if (!structure.directories[relativeDir]) {
    structure.directories[relativeDir] = {
      count: 0,
      files: [],
      patterns: [],
    };
  }

  const dirInfo = structure.directories[relativeDir];
  if (!dirInfo.files.includes(fileInfo.filename)) {
    dirInfo.files.push(fileInfo.filename);
    dirInfo.count = dirInfo.files.length;
  }

  // Update file tracking
  structure.files[relativePath] = {
    exports: fileInfo.exports.map(e => e.name),
    imports: fileInfo.imports.map(i => i.source),
    lineCount: fileInfo.lineCount,
    lastModified: new Date().toISOString(),
  };

  // Update exports index
  for (const exp of fileInfo.exports) {
    structure.exports[exp.name] = {
      file: relativePath,
      type: exp.type,
      line: exp.line,
    };
  }

  structure.lastUpdated = new Date().toISOString();
  saveJSON(structurePath, structure);
}

function updateConventions(intelDir) {
  const structurePath = path.join(intelDir, 'structure.json');
  const conventionsPath = path.join(intelDir, 'conventions.json');

  const structure = loadJSON(structurePath, { directories: {} });
  let conventions = loadJSON(conventionsPath, {
    version: 1,
    lastUpdated: null,
    rules: [],
    exceptions: [],
  });

  // Detect patterns in each directory
  for (const [dir, info] of Object.entries(structure.directories)) {
    if (info.count < 3) continue; // Need 3+ files for pattern

    const pattern = detectNamingPattern(info.files);
    if (!pattern) continue;

    const ruleId = generateRuleId(dir, pattern);
    const existingIndex = conventions.rules.findIndex(r => r.id === ruleId);

    const rule = {
      id: ruleId,
      directory: dir,
      pattern: pattern.pattern,
      patternType: pattern.type,
      confidence: calculateConfidence(info.files.length, pattern),
      examples: info.files.slice(0, 10), // Keep max 10 examples
      fileCount: info.count,
      lastUpdated: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Preserve exceptions from existing rule
      rule.exceptions = conventions.rules[existingIndex].exceptions || [];
      conventions.rules[existingIndex] = rule;
    } else {
      rule.exceptions = [];
      rule.learned = new Date().toISOString();
      conventions.rules.push(rule);
    }
  }

  // Sort by confidence (highest first)
  conventions.rules.sort((a, b) => b.confidence - a.confidence);
  conventions.lastUpdated = new Date().toISOString();

  saveJSON(conventionsPath, conventions);
}

function detectNamingPattern(files) {
  if (files.length < 3) return null;

  // Analyze extensions
  const extCounts = {};
  for (const file of files) {
    const ext = path.extname(file);
    extCounts[ext] = (extCounts[ext] || 0) + 1;
  }

  // Find dominant extension
  const dominantExt = Object.entries(extCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (!dominantExt || dominantExt[1] < files.length * 0.7) {
    return null; // No consistent extension
  }

  const ext = dominantExt[0];
  const filesWithExt = files.filter(f => f.endsWith(ext));
  const bases = filesWithExt.map(f => path.basename(f, ext));

  // Check for suffix patterns (*.service, *.controller, *.test, etc.)
  const suffixPattern = detectSuffixPattern(bases, ext);
  if (suffixPattern) return suffixPattern;

  // Check for casing patterns
  const casingPattern = detectCasingPattern(bases, ext);
  if (casingPattern) return casingPattern;

  // Fallback: just the extension
  return {
    type: 'extension',
    pattern: `*${ext}`,
    matchRate: filesWithExt.length / files.length,
  };
}

function detectSuffixPattern(bases, ext) {
  // Look for common suffixes like .service, .controller, .test, .spec
  const suffixCounts = {};

  for (const base of bases) {
    const parts = base.split('.');
    if (parts.length >= 2) {
      const suffix = parts[parts.length - 1];
      suffixCounts[suffix] = (suffixCounts[suffix] || 0) + 1;
    }
  }

  const dominantSuffix = Object.entries(suffixCounts)
    .filter(([suffix]) => suffix.length > 1) // Ignore single-char suffixes
    .sort((a, b) => b[1] - a[1])[0];

  if (dominantSuffix && dominantSuffix[1] >= bases.length * 0.7) {
    return {
      type: 'suffix',
      pattern: `*.${dominantSuffix[0]}${ext}`,
      suffix: dominantSuffix[0],
      matchRate: dominantSuffix[1] / bases.length,
    };
  }

  return null;
}

function detectCasingPattern(bases, ext) {
  const patterns = {
    PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
    camelCase: /^[a-z][a-zA-Z0-9]*$/,
    'kebab-case': /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
    SCREAMING_SNAKE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
  };

  for (const [name, regex] of Object.entries(patterns)) {
    const matches = bases.filter(b => regex.test(b));
    if (matches.length >= bases.length * 0.8) {
      return {
        type: 'casing',
        pattern: `${name}${ext}`,
        casing: name,
        matchRate: matches.length / bases.length,
      };
    }
  }

  return null;
}

function generateRuleId(dir, pattern) {
  const dirSlug = dir.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const patternSlug = pattern.pattern.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  return `${dirSlug}-${patternSlug}`.toLowerCase();
}

function calculateConfidence(fileCount, pattern) {
  // Base confidence from file count
  // 3 files: 0.60, 5 files: 0.70, 10 files: 0.85, 20+: 0.95
  let confidence = Math.min(0.95, 0.50 + (fileCount * 0.025));

  // Adjust for pattern match rate
  confidence *= pattern.matchRate;

  // Suffix patterns are more reliable than casing patterns
  if (pattern.type === 'suffix') {
    confidence = Math.min(0.98, confidence * 1.1);
  }

  return Math.round(confidence * 100) / 100;
}

function regenerateSummary(intelDir) {
  const structurePath = path.join(intelDir, 'structure.json');
  const conventionsPath = path.join(intelDir, 'conventions.json');
  const summaryPath = path.join(intelDir, 'summary.md');

  const structure = loadJSON(structurePath, { directories: {}, exports: {} });
  const conventions = loadJSON(conventionsPath, { rules: [] });

  let summary = `# Codebase Intelligence Summary\n\n`;
  summary += `*Auto-generated by GSD. Last updated: ${new Date().toISOString()}*\n\n`;

  // High-confidence conventions
  const highConfidence = conventions.rules.filter(r => r.confidence >= 0.70);
  if (highConfidence.length > 0) {
    summary += `## Detected Conventions\n\n`;
    for (const rule of highConfidence) {
      const pct = Math.round(rule.confidence * 100);
      summary += `- **\`${rule.directory}/\`**: \`${rule.pattern}\` `;
      summary += `(${rule.fileCount} files, ${pct}% confidence)\n`;

      if (rule.exceptions && rule.exceptions.length > 0) {
        summary += `  - Exceptions: ${rule.exceptions.map(e => e.file).join(', ')}\n`;
      }
    }
    summary += '\n';
  }

  // Lower confidence patterns (for awareness)
  const lowConfidence = conventions.rules.filter(r => r.confidence >= 0.50 && r.confidence < 0.70);
  if (lowConfidence.length > 0) {
    summary += `## Emerging Patterns\n\n`;
    for (const rule of lowConfidence) {
      const pct = Math.round(rule.confidence * 100);
      summary += `- \`${rule.directory}/\`: \`${rule.pattern}\` (${rule.fileCount} files, ${pct}%)\n`;
    }
    summary += '\n';
  }

  // Key exports (grouped by type)
  const exportsByType = {};
  for (const [name, info] of Object.entries(structure.exports)) {
    if (name === 'default') continue;
    if (!exportsByType[info.type]) {
      exportsByType[info.type] = [];
    }
    exportsByType[info.type].push(name);
  }

  if (Object.keys(exportsByType).length > 0) {
    summary += `## Key Exports\n\n`;
    for (const [type, names] of Object.entries(exportsByType)) {
      const displayNames = names.slice(0, 15).join(', ');
      const more = names.length > 15 ? ` (+${names.length - 15} more)` : '';
      summary += `- **${type}s**: ${displayNames}${more}\n`;
    }
    summary += '\n';
  }

  // Active directories
  const activeDirs = Object.entries(structure.directories)
    .filter(([_, info]) => info.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 15);

  if (activeDirs.length > 0) {
    summary += `## Directory Structure\n\n`;
    for (const [dir, info] of activeDirs) {
      summary += `- \`${dir}/\` — ${info.count} files\n`;
    }
    summary += '\n';
  }

  // Statistics
  const totalFiles = Object.keys(structure.files).length;
  const totalExports = Object.keys(structure.exports).length;
  const totalDirs = Object.keys(structure.directories).length;

  summary += `## Statistics\n\n`;
  summary += `- Files indexed: ${totalFiles}\n`;
  summary += `- Exports tracked: ${totalExports}\n`;
  summary += `- Directories: ${totalDirs}\n`;
  summary += `- Conventions detected: ${conventions.rules.length}\n`;

  fs.writeFileSync(summaryPath, summary);
}

function loadJSON(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {
    // Corrupted file, reset to default
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
```

### Hook 2: intel-advise.js (PreToolUse)

**Trigger:** Before Write tool execution

**Purpose:** Provide advisory if file placement deviates from conventions

**Process:**
1. Receive proposed file path
2. Check against high-confidence conventions
3. If deviation detected, return advisory message
4. Always allow proceed (never block)

**Performance:** Sync, must complete in <1000ms. Simple JSON lookup.

```javascript
#!/usr/bin/env node
// ~/.claude/hooks/intel-advise.js

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const result = processAdvisory(JSON.parse(input));
    console.log(JSON.stringify(result));
  } catch (err) {
    // On any error, just allow proceed
    console.log(JSON.stringify({ proceed: true }));
  }
  process.exit(0);
});

function processAdvisory(event) {
  // Only advise on Write tool
  if (event.tool_name !== 'Write') {
    return { proceed: true };
  }

  const filePath = event.tool_input.file_path;

  // Skip non-code files
  if (!isCodeFile(filePath)) {
    return { proceed: true };
  }

  const projectRoot = findProjectRoot(filePath);
  if (!projectRoot) {
    return { proceed: true };
  }

  const conventionsPath = path.join(projectRoot, '.planning', 'intel', 'conventions.json');
  if (!fs.existsSync(conventionsPath)) {
    return { proceed: true };
  }

  let conventions;
  try {
    conventions = JSON.parse(fs.readFileSync(conventionsPath, 'utf8'));
  } catch {
    return { proceed: true };
  }

  const advisory = checkConventions(filePath, projectRoot, conventions);

  if (advisory) {
    return {
      proceed: true, // Never block
      message: advisory,
    };
  }

  return { proceed: true };
}

function checkConventions(filePath, projectRoot, conventions) {
  const relativePath = path.relative(projectRoot, filePath);
  const relativeDir = path.dirname(relativePath);
  const filename = path.basename(filePath);

  // Only check high-confidence rules
  const activeRules = conventions.rules.filter(r => r.confidence >= 0.70);

  for (const rule of activeRules) {
    // Check if file SHOULD follow this rule but is in wrong location
    if (fileMatchesPattern(filename, rule)) {
      if (relativeDir !== rule.directory && !relativeDir.startsWith(rule.directory + '/')) {
        // Check if this is a known exception
        const isException = (rule.exceptions || []).some(
          e => e.file === relativePath || e.pattern && filename.match(new RegExp(e.pattern))
        );

        if (!isException) {
          const pct = Math.round(rule.confidence * 100);
          return `📍 Convention advisory: Files matching '${rule.pattern}' are typically in '${rule.directory}/' ` +
                 `(${rule.fileCount} files, ${pct}% confidence). ` +
                 `Current path: '${relativeDir}/'. Proceeding—this will be noted if intentional.`;
        }
      }
    }
  }

  // Check if writing to a directory with existing conventions
  const dirRule = activeRules.find(r =>
    relativeDir === r.directory || relativeDir.startsWith(r.directory + '/')
  );

  if (dirRule && !fileMatchesPattern(filename, dirRule)) {
    // File is in a convention directory but doesn't match pattern
    const isException = (dirRule.exceptions || []).some(
      e => e.file === relativePath || e.pattern && filename.match(new RegExp(e.pattern))
    );

    if (!isException) {
      const pct = Math.round(dirRule.confidence * 100);
      return `📍 Convention advisory: Files in '${dirRule.directory}/' typically match '${dirRule.pattern}' ` +
             `(${dirRule.fileCount} files, ${pct}% confidence). ` +
             `'${filename}' doesn't match. Proceeding—this will be noted if intentional.`;
    }
  }

  return null;
}

function fileMatchesPattern(filename, rule) {
  const pattern = rule.pattern;

  // Suffix pattern: *.service.ts
  if (pattern.startsWith('*.') && pattern.includes('.', 2)) {
    const suffix = pattern.slice(1); // .service.ts
    return filename.endsWith(suffix);
  }

  // Extension pattern: *.ts
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1);
    return filename.endsWith(ext);
  }

  // Casing pattern: PascalCase.tsx
  if (rule.patternType === 'casing') {
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);

    switch (rule.casing) {
      case 'PascalCase':
        return /^[A-Z][a-zA-Z0-9]*$/.test(base);
      case 'camelCase':
        return /^[a-z][a-zA-Z0-9]*$/.test(base);
      case 'kebab-case':
        return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(base);
      case 'snake_case':
        return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(base);
    }
  }

  return false;
}

function isCodeFile(filePath) {
  const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.swift', '.java', '.kt'];
  return codeExts.includes(path.extname(filePath));
}

function findProjectRoot(filePath) {
  let dir = path.isAbsolute(filePath) ? path.dirname(filePath) : process.cwd();
  const maxDepth = 10;
  let depth = 0;

  while (dir !== '/' && depth < maxDepth) {
    if (fs.existsSync(path.join(dir, '.planning'))) {
      return dir;
    }
    dir = path.dirname(dir);
    depth++;
  }
  return null;
}
```

### Hook 3: intel-init.js (SessionStart)

**Trigger:** When a Claude Code session starts

**Purpose:** Inject codebase intelligence into session context

**Process:**
1. Find project root from cwd
2. Read `summary.md`
3. Output wrapped in `<codebase-intelligence>` tags
4. Claude sees this in system context

**Performance:** Sync, should complete in <500ms. Simple file read.

```javascript
#!/usr/bin/env node
// ~/.claude/hooks/intel-init.js

const fs = require('fs');
const path = require('path');

const projectRoot = findProjectRoot(process.cwd());

if (!projectRoot) {
  // Not a GSD project
  process.exit(0);
}

const summaryPath = path.join(projectRoot, '.planning', 'intel', 'summary.md');

if (!fs.existsSync(summaryPath)) {
  // No intelligence gathered yet
  process.exit(0);
}

try {
  const summary = fs.readFileSync(summaryPath, 'utf8');

  // Check if summary has meaningful content
  const lines = summary.split('\n').filter(l => l.trim());
  if (lines.length < 5) {
    // Summary too sparse, skip injection
    process.exit(0);
  }

  // Output to Claude's context
  console.log(`<codebase-intelligence>
${summary}
</codebase-intelligence>`);

} catch (err) {
  // Silent failure
  if (process.env.INTEL_DEBUG) {
    console.error('Intel init error:', err.message);
  }
}

process.exit(0);

function findProjectRoot(dir) {
  const maxDepth = 10;
  let depth = 0;

  while (dir !== '/' && depth < maxDepth) {
    if (fs.existsSync(path.join(dir, '.planning'))) {
      return dir;
    }
    dir = path.dirname(dir);
    depth++;
  }
  return null;
}
```

---

## Data Structures

### Directory: `.planning/intel/`

```
.planning/
└── intel/
    ├── structure.json      # File/export index
    ├── conventions.json    # Detected patterns with confidence
    ├── summary.md          # Human-readable summary (auto-generated)
    └── semantic.db         # Optional: embeddings for semantic search
```

### structure.json

Tracks files, exports, and directory contents.

```json
{
  "version": 1,
  "lastUpdated": "2025-01-19T14:30:00Z",
  "directories": {
    "src/services": {
      "count": 5,
      "files": [
        "user.service.ts",
        "auth.service.ts",
        "email.service.ts",
        "payment.service.ts",
        "notification.service.ts"
      ],
      "patterns": []
    },
    "src/components": {
      "count": 12,
      "files": ["Button.tsx", "Card.tsx", "Modal.tsx", "..."],
      "patterns": []
    }
  },
  "files": {
    "src/services/user.service.ts": {
      "exports": ["UserService", "CreateUserDTO", "UpdateUserDTO"],
      "imports": ["@prisma/client", "./base.service"],
      "lineCount": 145,
      "lastModified": "2025-01-19T14:30:00Z"
    }
  },
  "exports": {
    "UserService": {
      "file": "src/services/user.service.ts",
      "type": "class",
      "line": 15
    },
    "Button": {
      "file": "src/components/Button.tsx",
      "type": "function",
      "line": 8
    }
  }
}
```

### conventions.json

Detected patterns with confidence scores and learning history.

```json
{
  "version": 1,
  "lastUpdated": "2025-01-19T14:30:00Z",
  "rules": [
    {
      "id": "src-services-service-ts",
      "directory": "src/services",
      "pattern": "*.service.ts",
      "patternType": "suffix",
      "suffix": "service",
      "confidence": 0.88,
      "examples": [
        "user.service.ts",
        "auth.service.ts",
        "email.service.ts",
        "payment.service.ts",
        "notification.service.ts"
      ],
      "fileCount": 5,
      "exceptions": [],
      "learned": "2025-01-15T10:00:00Z",
      "lastUpdated": "2025-01-19T14:30:00Z"
    },
    {
      "id": "src-components-pascalcase-tsx",
      "directory": "src/components",
      "pattern": "PascalCase.tsx",
      "patternType": "casing",
      "casing": "PascalCase",
      "confidence": 0.92,
      "examples": ["Button.tsx", "Card.tsx", "Modal.tsx"],
      "fileCount": 12,
      "exceptions": [
        {
          "file": "src/components/index.ts",
          "reason": "barrel export file",
          "added": "2025-01-16T11:00:00Z"
        }
      ],
      "learned": "2025-01-14T09:00:00Z",
      "lastUpdated": "2025-01-19T14:30:00Z"
    }
  ],
  "exceptions": []
}
```

### summary.md (Auto-generated)

Human-readable summary injected into Claude's context.

```markdown
# Codebase Intelligence Summary

*Auto-generated by GSD. Last updated: 2025-01-19T14:30:00Z*

## Detected Conventions

- **`src/services/`**: `*.service.ts` (5 files, 88% confidence)
- **`src/components/`**: `PascalCase.tsx` (12 files, 92% confidence)
  - Exceptions: index.ts
- **`src/app/api/`**: `*/route.ts` (8 files, 85% confidence)
- **`src/lib/`**: `kebab-case.ts` (6 files, 78% confidence)

## Emerging Patterns

- `src/hooks/`: `use*.ts` (2 files, 55%)
- `src/types/`: `*.types.ts` (2 files, 52%)

## Key Exports

- **classes**: UserService, AuthService, EmailService, PaymentService
- **functions**: Button, Card, Modal, Form, Input, useAuth, useUser
- **consts**: API_URL, DEFAULT_THEME, ROUTES

## Directory Structure

- `src/components/` — 12 files
- `src/app/api/` — 8 files
- `src/lib/` — 6 files
- `src/services/` — 5 files
- `src/hooks/` — 2 files

## Statistics

- Files indexed: 45
- Exports tracked: 78
- Directories: 12
- Conventions detected: 6
```

---

## Pattern Detection Engine

### Detection Algorithm

```
For each directory with 3+ files:
  1. Analyze file extensions
     → Find dominant extension (70%+ of files)

  2. Check for suffix patterns
     → *.service.ts, *.controller.ts, *.test.ts
     → Look at filename segments split by '.'

  3. Check for casing patterns
     → PascalCase, camelCase, kebab-case, snake_case
     → Analyze base filename (without extension)

  4. Calculate confidence
     → Base: 0.50 + (fileCount * 0.025)
     → Adjust for pattern match rate
     → Suffix patterns get 1.1x multiplier
     → Cap at 0.95 (never 100% certain)
```

### Confidence Scoring

| File Count | Base Confidence |
|------------|-----------------|
| 3 | 0.575 |
| 4 | 0.600 |
| 5 | 0.625 |
| 10 | 0.750 |
| 15 | 0.875 |
| 20+ | 0.950 (capped) |

Adjustments:
- Multiply by pattern match rate (e.g., 4/5 files match = 0.8)
- Suffix patterns: +10% (more reliable)
- Exceptions: Each exception reduces confidence by 0.02

### Supported Patterns

| Pattern Type | Example | Detection |
|--------------|---------|-----------|
| Suffix | `*.service.ts` | Dot-separated segments |
| Extension | `*.ts` | File extension only |
| PascalCase | `Button.tsx` | Regex: `/^[A-Z][a-zA-Z0-9]*$/` |
| camelCase | `userUtils.ts` | Regex: `/^[a-z][a-zA-Z0-9]*$/` |
| kebab-case | `user-service.ts` | Regex: `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/` |
| snake_case | `user_service.py` | Regex: `/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/` |

---

## Convention Learning

### Learning Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                    Convention Learning Loop                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Write file ──► PostToolUse ──► Update structure ──► Detect    │
│       │                                              patterns   │
│       │                                                  │       │
│       │         ┌──────────────────────────────────────┘       │
│       │         ▼                                               │
│       │    3+ files match?                                      │
│       │         │                                               │
│       │    Yes  │  No                                           │
│       │    ▼    └──► (no rule yet)                             │
│       │                                                         │
│       │    Create/update rule                                   │
│       │         │                                               │
│       │         ▼                                               │
│       │    Calculate confidence                                 │
│       │         │                                               │
│       │         ▼                                               │
│       │    Update conventions.json                              │
│       │         │                                               │
│       │         ▼                                               │
│       │    Regenerate summary.md                                │
│       │                                                         │
│       └──────────────────────────────────────────────────────── │
│                                                                  │
│  Next session starts ──► SessionStart ──► Inject summary        │
│                                                                  │
│  Write new file ──► PreToolUse ──► Check conventions            │
│       │                                 │                        │
│       │                            Advisory?                     │
│       │                            │      │                      │
│       │                           Yes     No                     │
│       │                            │      │                      │
│       │                     Show message  └──► Proceed           │
│       │                            │                             │
│       │                     Claude decides                       │
│       │                     │           │                        │
│       │                  Adjust      Proceed                     │
│       │                    path      anyway                      │
│       │                     │           │                        │
│       │                     │    PostToolUse notes               │
│       │                     │    potential exception             │
│       │                     │           │                        │
│       └─────────────────────┴───────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Exception Handling

When a file deviates from a convention:

1. **PreToolUse shows advisory**
2. **Claude proceeds anyway**
3. **PostToolUse records the file**
4. **If pattern persists** (same deviation 2+ times):
   - Option A: Lower rule confidence
   - Option B: Add as exception with inferred reason

Future: `/gsd:intel-correct` command to manually add exceptions with reasons.

### Confidence Evolution

```
Day 1: user.service.ts created
       → No pattern yet (need 3+ files)

Day 2: auth.service.ts, email.service.ts created
       → Pattern detected: *.service.ts
       → Confidence: 0.575 (3 files)

Day 3: payment.service.ts created
       → Confidence: 0.60 (4 files)

Day 5: notification.service.ts created
       → Confidence: 0.625 (5 files)

Day 7: crypto.ts created in services/ (deviation)
       → Advisory shown
       → Claude proceeds
       → Exception recorded
       → Confidence: 0.605 (5/6 files match)

Day 8: utils.ts created in services/ (another deviation)
       → Advisory shown
       → User manually corrects via /gsd:intel-correct
       → Exception added: "utility files don't need .service suffix"
       → Confidence stabilizes at 0.625 (5 services + 2 exceptions)
```

---

## GSD Integration

### Changes to Existing Commands

| Command | Change |
|---------|--------|
| `/gsd:new-project` | Creates `.planning/intel/` structure |
| `/gsd:execute-phase` | Hooks automatically index created files |
| `/gsd:plan-phase` | Planner sees conventions in context |
| `/gsd:map-codebase` | **Deprecated** → becomes `/gsd:analyze-codebase` |

### New Commands

| Command | Purpose |
|---------|---------|
| `/gsd:intel-status` | Show intelligence state, conventions, confidence |
| `/gsd:intel-refresh` | Force full re-index (after major refactor) |
| `/gsd:intel-correct` | Manually add/modify convention rules |
| `/gsd:analyze-codebase` | Deep scan for brownfield (optional) |

### Install Script Changes

`bin/install.js` registers hooks:

```javascript
// Hook registration added to settings.json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/intel-index.js",
            "timeout": 5000
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/intel-advise.js",
            "timeout": 1000
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/intel-init.js",
            "timeout": 2000
          }
        ]
      }
    ]
  }
}
```

### Dependencies Added

```json
{
  "dependencies": {
    "tree-sitter": "^0.21.0",
    "tree-sitter-typescript": "^0.21.0",
    "tree-sitter-javascript": "^0.21.0",
    "tree-sitter-python": "^0.21.0"
  }
}
```

Note: tree-sitter requires native compilation. May need to ship prebuilt binaries or use WASM versions for portability.

---

## User Experience

### Session 1 (New Project)

```
You: /gsd:new-project
...creates PROJECT.md, ROADMAP.md, etc...
...creates empty .planning/intel/ structure...

You: /gsd:execute-phase 1
...Claude creates files...

PostToolUse (silent):
  → Indexes src/services/user.service.ts
  → Indexes src/services/auth.service.ts
  → No patterns yet (only 2 files)

End of session:
  → structure.json has 2 services tracked
  → No conventions.json rules yet
```

### Session 2 (Building)

```
You: /gsd:execute-phase 2

SessionStart:
  → intel-init finds no summary yet (too sparse)
  → Nothing injected

...Claude creates more files...

PostToolUse (silent):
  → Indexes src/services/email.service.ts
  → Pattern detected! 3 files match *.service.ts
  → Rule created: src/services/*.service.ts (57% confidence)
  → Summary regenerated

End of session:
  → conventions.json has first rule
  → summary.md has "Detected Conventions" section
```

### Session 3 (Intelligence Active)

```
You: /gsd:execute-phase 3

SessionStart:
  → intel-init reads summary.md
  → Injects into Claude's context:

<codebase-intelligence>
# Codebase Intelligence Summary

## Detected Conventions
- **`src/services/`**: `*.service.ts` (3 files, 58% confidence)
- **`src/components/`**: `PascalCase.tsx` (5 files, 63% confidence)

## Key Exports
- classes: UserService, AuthService, EmailService
...
</codebase-intelligence>

Claude (planning):
"I need to create a payment service. Based on codebase conventions,
I'll create src/services/payment.service.ts"

...Claude creates file...

PostToolUse:
  → Indexes payment.service.ts
  → Confidence for services rule: 58% → 65%
```

### Session 5 (Deviation Scenario)

```
Claude about to write: src/services/crypto.ts

PreToolUse:
  → Checks: crypto.ts doesn't match *.service.ts
  → Returns advisory

Claude sees:
"📍 Convention advisory: Files in 'src/services/' typically match
'*.service.ts' (5 files, 78% confidence). 'crypto.ts' doesn't match.
Proceeding—this will be noted if intentional."

Claude: "I'm placing this here because crypto utilities are used by
multiple services. Proceeding with the deviation."

...file created...

PostToolUse:
  → Notes crypto.ts as potential exception
  → Confidence slightly reduced: 78% → 76%
```

### Session 10 (Mature Intelligence)

```
SessionStart injects:

<codebase-intelligence>
# Codebase Intelligence Summary

## Detected Conventions

- **`src/services/`**: `*.service.ts` (8 files, 91% confidence)
  - Exceptions: crypto.ts, constants.ts
- **`src/components/`**: `PascalCase.tsx` (15 files, 94% confidence)
- **`src/app/api/`**: `*/route.ts` (12 files, 89% confidence)
- **`src/lib/`**: `kebab-case.ts` (6 files, 82% confidence)
- **`src/hooks/`**: `use*.ts` (4 files, 75% confidence)

## Key Exports

- **classes**: UserService, AuthService, EmailService, PaymentService,
  OrderService, NotificationService, AnalyticsService, ReportService
- **functions**: Button, Card, Modal, Form, Input, Table, useAuth,
  useUser, useCart, useOrders
- **consts**: API_URL, ROUTES, THEMES, LIMITS

## Directory Structure

- `src/components/` — 15 files
- `src/app/api/` — 12 files
- `src/services/` — 8 files
- `src/lib/` — 6 files
- `src/hooks/` — 4 files
- `src/types/` — 3 files

## Statistics

- Files indexed: 67
- Exports tracked: 124
- Directories: 15
- Conventions detected: 8
</codebase-intelligence>

Claude now KNOWS:
- Where services go (and what naming to use)
- Component naming conventions
- API route structure
- That crypto.ts is a known exception

No manual configuration. No stale documentation.
The codebase taught Claude its own patterns.
```

---

## Implementation Plan

### Phase 1: Core Hooks (MVP)

**Deliverables:**
- `intel-index.js` with tree-sitter parsing
- `intel-init.js` for session injection
- `structure.json` and `summary.md` generation
- Basic pattern detection (suffix + casing)

**GSD changes:**
- Create `.planning/intel/` in `/gsd:new-project`
- Register hooks in `install.js`
- Add tree-sitter dependencies

**Timeline:** Foundation for all other features

### Phase 2: Advisory System

**Deliverables:**
- `intel-advise.js` PreToolUse hook
- `conventions.json` with confidence scoring
- Deviation detection and advisory messages

**GSD changes:**
- Register PreToolUse hook
- Update summary generation to include conventions

**Timeline:** Adds real-time guidance

### Phase 3: Brownfield Support

**Deliverables:**
- `/gsd:analyze-codebase` command (replaces map-codebase)
- Batch indexing for existing codebases
- Handle large codebases efficiently

**GSD changes:**
- Deprecate `/gsd:map-codebase`
- Add new command to `commands/gsd/`

**Timeline:** Supports existing projects

### Phase 4: Learning Refinement

**Deliverables:**
- `/gsd:intel-correct` command
- Manual exception management
- Confidence adjustment from corrections

**GSD changes:**
- Add new command
- Update conventions.json schema for manual entries

**Timeline:** User control over learning

### Phase 5: Semantic Search (Optional)

**Deliverables:**
- `semantic.db` with embeddings (sqlite-vec)
- voyage-code-3 integration (or local ollama)
- "Find code that handles X" queries

**GSD changes:**
- Optional `--deep` flag for analyze-codebase
- Query interface for planners

**Timeline:** Advanced capability, optional

---

## Future Extensions

### 1. Cross-Project Learning

Share conventions across related projects:
- Export conventions to `~/.gsd/conventions/`
- Import proven patterns into new projects
- "This looks like a Next.js project, applying common conventions"

### 2. Framework Detection

Automatically detect and apply framework conventions:
- Detect Next.js → suggest app router patterns
- Detect NestJS → suggest module/controller/service patterns
- Detect FastAPI → suggest router patterns

### 3. Team Conventions

For team settings:
- Central conventions repository
- Merge team rules with project-specific rules
- Higher confidence for team-wide patterns

### 4. Architectural Patterns

Beyond file naming:
- Detect dependency injection patterns
- Detect state management patterns
- Detect API design patterns

### 5. Refactoring Suggestions

Proactive improvement suggestions:
- "5 files in src/utils/ might be better as services"
- "Component X has grown large, consider splitting"
- "Inconsistent naming: authService.ts vs user.service.ts"

---

## Technical Considerations

### Performance

| Operation | Target | Approach |
|-----------|--------|----------|
| PostToolUse indexing | <500ms | Async, non-blocking |
| PreToolUse advisory | <100ms | Simple JSON lookup |
| SessionStart injection | <200ms | File read only |
| Pattern detection | <50ms | In-memory, algorithmic |

### Portability

Tree-sitter requires native binaries. Options:
1. **NPM postinstall** - compile on install
2. **Prebuilt binaries** - ship for common platforms
3. **WASM** - use web-tree-sitter (slower but universal)

Recommendation: Start with npm native, fall back to WASM.

### Storage

Typical project after 6 months:
- `structure.json`: ~50KB
- `conventions.json`: ~5KB
- `summary.md`: ~3KB
- Total: ~60KB (negligible)

With semantic.db (optional):
- ~1KB per function embedded
- 500 functions = ~500KB
- Still reasonable for local storage

### Error Handling

All hooks follow silent failure principle:
- Never break Claude's workflow
- Log errors only if `INTEL_DEBUG=1`
- Return `{ proceed: true }` on any error
- Corrupted files reset to defaults

---

## Summary

The Codebase Intelligence System transforms GSD from a planning/execution framework into a **learning system** that understands your codebase and gets smarter over time.

**Key innovations:**
1. **Hook-driven** - Uses Claude Code's native infrastructure
2. **Zero API calls** - Pure local computation
3. **Incremental** - Builds knowledge as you build code
4. **Advisory** - Guides without blocking
5. **Self-improving** - Learns from every session

**The result:** By session 5, Claude knows your codebase conventions without being told. By session 10, it's an expert in your project's patterns. No manual documentation. No stale snapshots. Just accumulated wisdom that grows with your code.
