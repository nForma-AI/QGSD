'use strict';
// hooks/nf-post-edit-format.js
// PostToolUse hook: auto-formats JS/TS files after Edit operations.
//
// Detects prettier or biome in node_modules/.bin/ and runs the formatter
// with --write on the edited file. Fails open in all cases.
//
// Input (stdin): Claude Code PostToolUse JSON payload
//   { tool_name, tool_input: { file_path }, tool_response, cwd, context_window }
//
// Output (stdout): JSON { hookSpecificOutput: { hookEventName, additionalContext } }
//   OR: no output (exit 0) when the hook is a no-op.
//
// Fail-open: exits 0 in ALL cases — never blocks the Edit tool.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { loadConfig, shouldRunHook, validateHookInput } = require('./config-loader');

const JS_TS_RE = /\.(js|ts|cjs|mjs|jsx|tsx)$/;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const _eventType = input.hook_event_name || input.hookEventName || 'PostToolUse';
    const _validation = validateHookInput(_eventType, input);
    if (!_validation.valid) {
      process.stderr.write('[nf] WARNING: nf-post-edit-format: invalid input: ' + JSON.stringify(_validation.errors) + '\n');
      process.exit(0); // Fail-open
    }

    // Profile guard — exit early if this hook is not active for the current profile
    const config = loadConfig(input.cwd || process.cwd());
    const profile = config.hook_profile || 'standard';
    if (!shouldRunHook('nf-post-edit-format', profile)) {
      process.exit(0);
    }

    // Only act on Edit tool calls
    if (input.tool_name !== 'Edit') {
      process.exit(0);
    }

    // Extract file path from tool input
    const filePath = (input.tool_input && input.tool_input.file_path) || '';
    if (!JS_TS_RE.test(filePath)) {
      process.exit(0); // Not a JS/TS file — no-op
    }

    // Auto-detect formatter in project's node_modules
    const cwd = input.cwd || process.cwd();
    const prettierBin = path.join(cwd, 'node_modules', '.bin', 'prettier');
    const biomeBin = path.join(cwd, 'node_modules', '.bin', 'biome');

    let formatter = null;
    let args = [];

    if (fs.existsSync(prettierBin)) {
      formatter = prettierBin;
      args = ['--write', filePath];
    } else if (fs.existsSync(biomeBin)) {
      formatter = biomeBin;
      args = ['format', '--write', filePath];
    } else {
      process.exit(0); // No formatter available — fail-open
    }

    const result = spawnSync(formatter, args, {
      encoding: 'utf8',
      cwd: cwd,
      timeout: 10000, // 10s timeout
    });

    const filename = path.basename(filePath);
    const formatterName = formatter.includes('prettier') ? 'prettier' : 'biome';

    if (result.status === 0 && !result.error) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `[auto-format] Formatted ${filename} with ${formatterName}`,
        },
      }));
    } else {
      // Formatter failed — warn on stderr, still exit 0 (fail-open)
      process.stderr.write(`[nf] WARNING: ${formatterName} failed on ${filename}: ${(result.stderr || '').slice(0, 200)}\n`);
    }

    process.exit(0); // Always exit 0 — fail-open
  } catch (e) {
    if (e instanceof SyntaxError) {
      process.stderr.write('[nf] WARNING: nf-post-edit-format: malformed JSON on stdin: ' + e.message + '\n');
    }
    // Malformed JSON or unexpected error — fail-open, no output
    process.exit(0);
  }
});
