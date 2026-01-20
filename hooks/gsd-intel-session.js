#!/usr/bin/env node
// Codebase Intelligence - SessionStart Context Injection Hook
// Injects codebase summary into Claude's context at session start

const fs = require('fs');
const path = require('path');

/**
 * Generate concise codebase summary for context injection
 * Target: < 500 tokens to minimize context usage
 */
function generateSummary(index, conventions) {
  const lines = [];

  // File count
  const fileCount = Object.keys(index.files || {}).length;
  if (fileCount === 0) return null;

  lines.push(`Indexed files: ${fileCount}`);

  // Naming conventions (if detected with confidence)
  if (conventions.naming?.exports?.dominant) {
    const n = conventions.naming.exports;
    lines.push(`Export naming: ${n.dominant} (${n.percentage}%)`);
  }

  // Key directories (top 5)
  const dirs = Object.entries(conventions.directories || {});
  if (dirs.length > 0) {
    lines.push('');
    lines.push('Key directories:');
    for (const [dir, info] of dirs.slice(0, 5)) {
      lines.push(`  ${dir}: ${info.purpose} (${info.files} files)`);
    }
  }

  // Suffix patterns (top 3)
  const suffixes = Object.entries(conventions.suffixes || {});
  if (suffixes.length > 0) {
    lines.push('');
    lines.push('File patterns:');
    for (const [suffix, info] of suffixes.slice(0, 3)) {
      lines.push(`  ${suffix}: ${info.purpose} (${info.count} files)`);
    }
  }

  // Key exports overview (categorize if enough data)
  const allExports = [];
  for (const [filePath, fileData] of Object.entries(index.files || {})) {
    for (const exp of fileData.exports || []) {
      if (exp !== 'default') {
        allExports.push(exp);
      }
    }
  }

  if (allExports.length > 0) {
    lines.push('');
    lines.push(`Total exports: ${allExports.length}`);
    // List a few example exports if available
    if (allExports.length <= 10) {
      lines.push(`Exports: ${allExports.join(', ')}`);
    }
  }

  return lines.join('\n');
}

// Read JSON from stdin (standard hook pattern)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Only inject on startup or resume
    if (!['startup', 'resume'].includes(data.source)) {
      process.exit(0);
    }

    // Check for intel files
    const intelDir = path.join(process.cwd(), '.planning', 'intel');
    const indexPath = path.join(intelDir, 'index.json');

    if (!fs.existsSync(indexPath)) {
      process.exit(0);  // No intel, skip silently
    }

    // Read intel files
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

    let conventions = { naming: {}, directories: {}, suffixes: {} };
    const conventionsPath = path.join(intelDir, 'conventions.json');
    if (fs.existsSync(conventionsPath)) {
      conventions = JSON.parse(fs.readFileSync(conventionsPath, 'utf8'));
    }

    // Generate and output summary
    const summary = generateSummary(index, conventions);
    if (summary) {
      process.stdout.write(`<codebase-intelligence>\n${summary}\n</codebase-intelligence>`);
    }

    process.exit(0);
  } catch (error) {
    // Silent failure - never block Claude
    process.exit(0);
  }
});
