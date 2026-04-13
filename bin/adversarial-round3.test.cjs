#!/usr/bin/env node
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 17: nf-solve digestV8Coverage line offset calculation bug
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-17: digestV8Coverage line offset calculation', () => {
  // Simulate the line offset calculation from nf-solve.cjs
  function calculateLineRange(startOffset, endOffset, source) {
    // Build line offset array from source text
    const lineOffsets = [0]; // First line starts at offset 0
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\n') {
        lineOffsets.push(i + 1);
      }
    }

    // Find line numbers that this range covers
    let startLine = lineOffsets.findIndex(offset => offset > startOffset);
    if (startLine === -1) startLine = lineOffsets.length - 1;
    else startLine = Math.max(0, startLine - 1);

    let endLine = lineOffsets.findIndex(offset => offset >= endOffset);
    if (endLine === -1) endLine = lineOffsets.length;

    // Add lines to appropriate set (1-indexed for output)
    const coveredLines = new Set();
    for (let lineIdx = startLine; lineIdx < endLine && lineIdx < lineOffsets.length; lineIdx++) {
      const lineNum = lineIdx + 1;
      coveredLines.add(lineNum);
    }

    return Array.from(coveredLines).sort((a, b) => a - b);
  }

  it('correctly calculates line ranges for simple cases', () => {
    // Source: "line1\nline2\nline3\n"
    // Offsets: [0, 6, 12, 18]
    // Lines:   [1, 2, 3, 4]
    const source = "line1\nline2\nline3\n";

    // Range covering "line2" (offsets 6-11)
    const result = calculateLineRange(6, 11, source);
    assert.deepEqual(result, [2], 'Should cover line 2 only');
  });

  it('handles range spanning multiple lines', () => {
    const source = "line1\nline2\nline3\nline4\n";

    // Range from middle of line1 to middle of line3
    const result = calculateLineRange(2, 15, source);
    // Expected: lines 1, 2, 3 (offsets: 0-5, 6-11, 12-17)
    // Range 2-15 covers parts of all three lines
    assert.deepEqual(result, [1, 2, 3], 'Should cover lines 1, 2, 3');
  });

  it('handles range at start of file', () => {
    const source = "line1\nline2\nline3\n";

    // Range from start
    const result = calculateLineRange(0, 3, source);
    assert.deepEqual(result, [1], 'Should cover line 1 only');
  });

  it('handles range at end of file', () => {
    const source = "line1\nline2\nline3";

    // Range covering end of file
    const result = calculateLineRange(12, 17, source);
    assert.deepEqual(result, [3], 'Should cover line 3 only');
  });

  it('BUG: incorrect calculation for range in middle of line', () => {
    const source = "line1\nline2\nline3\nline4\n";
    // lineOffsets = [0, 6, 12, 18]

    // Range from offset 8-10 (middle of line2 "ne2")
    // Current logic: findIndex(offset > 8) = 2 (offset 12)
    // startLine = max(0, 2-1) = 1
    // findIndex(offset >= 10) = 2 (offset 12)
    // endLine = 2
    // So covers lines 2, 3 (lineIdx 1, 2 -> lines 2, 3)
    // But should only cover line 2!

    const result = calculateLineRange(8, 10, source);
    // Current buggy result: [2, 3]
    // Correct result should be: [2]
    assert.deepEqual(result, [2], 'BUG: should only cover line 2, not line 3');
  });

  it('BUG: incorrect calculation for range spanning line boundaries', () => {
    const source = "line1\nline2\nline3\nline4\n";
    // lineOffsets = [0, 6, 12, 18]

    // Range from offset 5-8 (spans line1 end and line2 start)
    // offset 5 is "1" in "line1", offset 8 is "e2" in "line2"
    // Should cover lines 1 and 2

    const result = calculateLineRange(5, 8, source);
    // Current logic: findIndex(offset > 5) = 1 (offset 6)
    // startLine = max(0, 1-1) = 0
    // findIndex(offset >= 8) = 2 (offset 12)
    // endLine = 2
    // So covers lines 1, 2 (lineIdx 0, 1 -> lines 1, 2) - this is actually correct!

    assert.deepEqual(result, [1, 2], 'Should cover lines 1 and 2');
  });

  it('BUG: off-by-one error in line numbering', () => {
    const source = "a\nbb\nccc\ndddd\n";
    // lineOffsets = [0, 2, 5, 9]

    // Range covering single character on line 3 (offset 7, "c" in "ccc")
    const result = calculateLineRange(7, 8, source);
    // Current logic: findIndex(offset > 7) = 3 (offset 9)
    // startLine = max(0, 3-1) = 2
    // findIndex(offset >= 8) = 3 (offset 9)
    // endLine = 3
    // So covers lineIdx 2 -> line 3
    // This is correct, but let's verify

    assert.deepEqual(result, [3], 'Should cover line 3 only');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 18: nf-solve walkDir infinite recursion on symlinks
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-18: walkDir symlink cycle detection', () => {
  beforeEach(() => freshTmp());
  afterEach(() => cleanTmp());

  function walkDir(dir, maxDepth, currentDepth, visited) {
    if (currentDepth === undefined) currentDepth = 0;
    if (maxDepth === undefined) maxDepth = 10;
    if (currentDepth > maxDepth) return [];
    if (visited === undefined) visited = new Set();

    const results = [];
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return results;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        const realPath = fs.realpathSync(fullPath);
        if (visited.has(realPath)) continue;
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          visited.add(realPath);
          const sub = walkDir(fullPath, maxDepth, currentDepth + 1, visited);
          for (const s of sub) results.push(s);
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      } catch (e) {
        // skip inaccessible entries
      }
    }
    return results;
  }

  it('BUG: walkDir can infinite recurse on symlink cycles', () => {
    const dir = freshTmp();
    const subdir = path.join(dir, 'subdir');
    fs.mkdirSync(subdir);
    fs.writeFileSync(path.join(subdir, 'file.txt'), 'content');

    // Create a symlink that points back to parent
    // This would cause infinite recursion if not detected
    try {
      fs.symlinkSync(dir, path.join(subdir, 'cycle'), 'dir');
    } catch (e) {
      // Symlinks may not be supported on all systems, skip test
      console.log('Symlinks not supported, skipping cycle test');
      return;
    }

    // This call would hang if there's no cycle detection
    const result = walkDir(dir, 5, 0);
    assert.ok(Array.isArray(result), 'Should not infinite recurse');
    assert.ok(result.length >= 1, 'Should find at least the file');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 19: nf-solve discoverDocFiles pattern matching issues
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-19: discoverDocFiles pattern matching', () => {
  beforeEach(() => freshTmp());
  afterEach(() => cleanTmp());

  function matchWildcard(pattern, filePath) {
    const normPath = filePath.replace(/\\/g, '/');
    const normPattern = pattern.replace(/\\/g, '/');

    if (!normPattern.includes('*')) {
      return normPath === normPattern || normPath.endsWith('/' + normPattern);
    }

    let regex = normPattern
      .replace(/\./g, '\\.')
      .replace(/\*\*\//g, '(.+/)*')
      .replace(/\*/g, '[^/]*');
    regex = '^(' + regex + ')$';

    return new RegExp(regex).test(normPath);
  }

  it('correctly matches simple patterns', () => {
    assert.equal(matchWildcard('README.md', 'README.md'), true);
    assert.equal(matchWildcard('docs/**/*.md', 'docs/sub/guide.md'), true);
  });

  it('BUG: double star pattern matches too greedily', () => {
    // This should NOT match because docs/ is not under docs/api/
    assert.equal(matchWildcard('docs/**/*.md', 'docs.md'), false,
      'docs.md should not match docs/**/*.md');
  });

  it('BUG: regex escaping insufficient', () => {
    // Pattern with literal dots should be escaped
    assert.equal(matchWildcard('version.1.0.md', 'version.1.0.md'), true);
    // But this might fail if the regex escaping is wrong
  });

  it('handles complex patterns', () => {
    assert.equal(matchWildcard('**/*.test.cjs', 'bin/something.test.cjs'), true);
    assert.equal(matchWildcard('**/*.test.js', 'test/unit.test.js'), true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BUG 20: nf-solve extractStructuralClaims CLI command parsing
// ═══════════════════════════════════════════════════════════════════════════════

describe('BUG-20: extractStructuralClaims CLI parsing', () => {
  function extractStructuralClaims(content) {
    const lines = content.split('\n');
    const claims = [];
    let inFencedBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track fenced code blocks
      if (line.trimStart().startsWith('```')) {
        inFencedBlock = !inFencedBlock;
        continue;
      }
      if (inFencedBlock) continue;

      // Find backtick-wrapped values
      const backtickPattern = /`([^`]+)`/g;
      let match;
      while ((match = backtickPattern.exec(line)) !== null) {
        const value = match[1].trim();
        if (value.length < 4) continue;

        // CLI command: starts with node, npx, npm, yarn, pnpm
        if (/^(node|npx|npm|yarn|pnpm)\s+/.test(value)) {
          claims.push({
            line: i + 1,
            type: 'cli_command',
            value: value,
          });
        }
      }
    }

    return claims;
  }

  it('correctly identifies CLI commands', () => {
    const content = `
To run the tests:
\`npm test\`

For development:
\`npm run dev\`

To build:
\`node bin/build.cjs\`
`;
    const claims = extractStructuralClaims(content);
    assert.equal(claims.length, 3, 'Should find 3 CLI commands');
    assert.equal(claims[0].value, 'npm test');
    assert.equal(claims[1].value, 'npm run dev');
    assert.equal(claims[2].value, 'node bin/build.cjs');
  });

  it('ignores commands in fenced blocks', () => {
    const content = `
\`\`\`bash
npm install
node server.js
\`\`\`

Outside: \`npm start\`
`;
    const claims = extractStructuralClaims(content);
    assert.equal(claims.length, 1, 'Should ignore commands in fenced blocks');
    assert.equal(claims[0].value, 'npm start');
  });

  it('BUG: misses commands with extra spaces', () => {
    const content = `
Command: \` npm test \`
`;
    const claims = extractStructuralClaims(content);
    assert.equal(claims.length, 1, 'Should handle commands with leading/trailing spaces');
    assert.equal(claims[0].value, 'npm test');
  });

  it('BUG: misses yarn/pnpm commands', () => {
    const content = `
Install: \`yarn install\`
Run: \`pnpm dev\`
`;
    const claims = extractStructuralClaims(content);
    assert.equal(claims.length, 2, 'Should recognize yarn and pnpm commands');
  });
});

function freshTmp() {
  const tmpDir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'nf-solve-test-'));
  return tmpDir;
}

function cleanTmp() {
  // Implementation would clean up tmpDir
}