'use strict';
// hooks/qgsd-spec-regen.js
// PostToolUse hook: when Claude writes to qgsd-workflow.machine.ts,
// automatically trigger generate-formal-specs.cjs to regenerate TLA+/Alloy specs.
//
// LOOP-02 (v0.21-03): Self-Calibrating Feedback Loops
//
// Input (stdin): Claude Code PostToolUse JSON payload
//   { tool_name, tool_input: { file_path }, tool_response, cwd, context_window }
//
// Output (stdout): JSON { hookSpecificOutput: { hookEventName, additionalContext } }
//   OR: no output (exit 0) when the hook is a no-op.
//
// Fail-open: exits 0 in ALL cases — never blocks the Write tool.

const { spawnSync } = require('child_process');
const path = require('path');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const toolName = input.tool_name || '';
    const filePath = (input.tool_input && input.tool_input.file_path) || '';

    // Only act on Write calls to qgsd-workflow.machine.ts
    if (toolName !== 'Write' || !filePath.includes('qgsd-workflow.machine.ts')) {
      process.exit(0); // No-op — not a machine file write
    }

    // Resolve generate-formal-specs.cjs relative to cwd (the project root)
    const cwd = input.cwd || process.cwd();
    const genScript = path.join(cwd, 'bin', 'generate-formal-specs.cjs');

    const result = spawnSync(process.execPath, [genScript], {
      encoding: 'utf8',
      cwd: cwd,
      timeout: 60000, // 60s: spec generation can take a moment
    });

    let msg;
    if (result.status === 0 && !result.error) {
      msg = '[spec-regen] Formal specs regenerated from XState machine (qgsd-workflow.machine.ts was updated).';
    } else {
      msg = '[spec-regen] WARNING: generate-formal-specs.cjs failed after machine file write. Run manually to regenerate specs.\n' +
            (result.stderr ? result.stderr.slice(0, 500) : '') +
            (result.error ? String(result.error) : '');
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: msg,
      },
    }));
    process.exit(0); // Always exit 0 — fail-open
  } catch (e) {
    // Malformed JSON or unexpected error — fail-open, no output
    process.exit(0);
  }
});
