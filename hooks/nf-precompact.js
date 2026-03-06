#!/usr/bin/env node
// hooks/nf-precompact.js
// PreCompact hook — injects nForma session state as additionalContext before context compaction.
// Reads .planning/STATE.md "Current Position" section and any pending task files.
// Output survives compaction and appears in the first message of the compacted context.
// Fails open on all errors — never blocks compaction.

'use strict';

const fs   = require('fs');
const path = require('path');

// Extract the "## Current Position" section from STATE.md content.
// Returns the trimmed text between "## Current Position" and the next "## " header.
// Returns null if the section is not found.
function extractCurrentPosition(stateContent) {
  const startMarker = '## Current Position';
  const startIdx = stateContent.indexOf(startMarker);
  if (startIdx === -1) return null;

  const afterStart = startIdx + startMarker.length;
  // Find the next section header (## followed by a space at start of line)
  const nextHeaderMatch = stateContent.slice(afterStart).search(/\n## /);
  let section;
  if (nextHeaderMatch === -1) {
    section = stateContent.slice(afterStart);
  } else {
    section = stateContent.slice(afterStart, afterStart + nextHeaderMatch);
  }
  return section.trim() || null;
}

// Read pending task files without consuming them (unlike nf-prompt.js's consumePendingTask).
// Checks .claude/pending-task.txt and .claude/pending-task-*.txt files.
// Returns an array of { filename, content } objects for each file found.
function readPendingTasks(cwd) {
  const claudeDir = path.join(cwd, '.claude');
  const results = [];

  if (!fs.existsSync(claudeDir)) return results;

  // Check generic pending-task.txt first
  const genericFile = path.join(claudeDir, 'pending-task.txt');
  if (fs.existsSync(genericFile)) {
    try {
      const content = fs.readFileSync(genericFile, 'utf8').trim();
      if (content) results.push({ filename: 'pending-task.txt', content });
    } catch (e) {
      process.stderr.write('[nf-precompact] Could not read ' + genericFile + ': ' + e.message + '\n');
    }
  }

  // Check session-scoped pending-task-*.txt files
  try {
    const entries = fs.readdirSync(claudeDir);
    for (const entry of entries) {
      if (entry.startsWith('pending-task-') && entry.endsWith('.txt') && !entry.endsWith('.claimed')) {
        const filePath = path.join(claudeDir, entry);
        try {
          const content = fs.readFileSync(filePath, 'utf8').trim();
          if (content) results.push({ filename: entry, content });
        } catch (e) {
          process.stderr.write('[nf-precompact] Could not read ' + filePath + ': ' + e.message + '\n');
        }
      }
    }
  } catch (e) {
    process.stderr.write('[nf-precompact] Could not read .claude dir: ' + e.message + '\n');
  }

  return results;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const cwd = input.cwd || process.cwd();

    const statePath = path.join(cwd, '.planning', 'STATE.md');

    let additionalContext;

    if (!fs.existsSync(statePath)) {
      // No STATE.md — minimal context
      additionalContext = 'nForma session resumed after compaction. Run `cat .planning/STATE.md` for project state.';
    } else {
      let stateContent;
      try {
        stateContent = fs.readFileSync(statePath, 'utf8');
      } catch (e) {
        process.stderr.write('[nf-precompact] Could not read STATE.md: ' + e.message + '\n');
        additionalContext = 'nForma session resumed after compaction. Run `cat .planning/STATE.md` for project state.';
        emitOutput(additionalContext);
        return;
      }

      const currentPosition = extractCurrentPosition(stateContent);
      const pendingTasks = readPendingTasks(cwd);

      const lines = [
        'nForma CONTINUATION CONTEXT (auto-injected at compaction)',
        '',
        '## Current Position',
        currentPosition || '(Could not extract Current Position section — run `cat .planning/STATE.md` for full state.)',
      ];

      if (pendingTasks.length > 0) {
        lines.push('');
        lines.push('## Pending Task');
        // Include the first pending task found (generic file takes priority)
        lines.push(pendingTasks[0].content);
        if (pendingTasks.length > 1) {
          process.stderr.write('[nf-precompact] Multiple pending task files found; injecting first: ' + pendingTasks[0].filename + '\n');
        }
      }

      lines.push('');
      lines.push('## Resume Instructions');
      lines.push('You are mid-session on a nForma project. The context above shows where you were.');
      lines.push('- If a PLAN.md is in progress, continue executing from the current plan.');
      lines.push('- If a pending task is shown above, execute it next.');
      lines.push('- Run `cat .planning/STATE.md` to get full project state if needed.');
      lines.push('- All project rules in CLAUDE.md still apply (quorum required for planning commands).');

      additionalContext = lines.join('\n');
    }

    emitOutput(additionalContext);

  } catch (e) {
    process.stderr.write('[nf-precompact] Fatal error: ' + e.message + '\n');
    process.exit(0); // Fail open — never block compaction
  }
});

function emitOutput(additionalContext) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreCompact',
      additionalContext,
    },
  }));
  process.exit(0);
}

// Export helpers for unit testing (tree-shaken at runtime — no cost)
// The file is a script and exits via process.exit() before reaching this line in normal operation.
// When require()d by tests, the stdin handler is registered but never fires, so module.exports is set.
if (typeof module !== 'undefined') {
  module.exports = module.exports || {};
  module.exports.extractCurrentPosition = extractCurrentPosition;
  module.exports.readPendingTasks = readPendingTasks;
}
