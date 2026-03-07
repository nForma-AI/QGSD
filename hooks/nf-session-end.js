'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Hard timeout: never block session exit longer than 5 seconds
const HARD_TIMEOUT = setTimeout(() => process.exit(0), 5000);
HARD_TIMEOUT.unref(); // do not keep process alive

/**
 * Locate learning-extractor.cjs — try installed global path first, then local dev path.
 */
function findLearningExtractor() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'nf-bin', 'learning-extractor.cjs'),
    path.join(__dirname, '..', 'bin', 'learning-extractor.cjs'),
  ];
  for (const p of candidates) {
    try { return require(p); } catch (_) {}
  }
  return null;
}

/**
 * Locate memory-store.cjs — try installed global path first, then local dev path.
 */
function findMemoryStore() {
  const candidates = [
    path.join(os.homedir(), '.claude', 'nf-bin', 'memory-store.cjs'),
    path.join(__dirname, '..', 'bin', 'memory-store.cjs'),
  ];
  for (const p of candidates) {
    try { return require(p); } catch (_) {}
  }
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const cwd = input.cwd || process.cwd();
    const transcriptPath = input.transcript_path;

    // Profile guard
    const { loadConfig, shouldRunHook } = require('./config-loader');
    const config = loadConfig(cwd);
    const profile = config.hook_profile || 'standard';
    if (!shouldRunHook('nf-session-end', profile)) {
      process.exit(0);
    }

    // Feature flag guard
    if (config.learning_enabled === false) {
      process.exit(0);
    }

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
      process.exit(0); // No transcript available
    }

    // Load extractor module
    const extractor = findLearningExtractor();
    if (!extractor) {
      process.exit(0);
    }

    // Load memory store module
    const memStore = findMemoryStore();
    if (!memStore) {
      process.exit(0);
    }

    // Read last N lines of transcript (avoid loading entire file)
    const lines = extractor.readLastLines(transcriptPath, 500);

    // LRNG-01: Extract error patterns
    const errorPatterns = extractor.extractErrorPatterns(lines);

    // LRNG-02: Extract user corrections (last 200 lines)
    const corrections = extractor.extractCorrections(lines.slice(-200));

    let errorCount = 0;
    let correctionCount = 0;

    // Persist error patterns via memory-store (dedup before appending)
    for (const ep of errorPatterns) {
      if (!memStore.isDuplicate(cwd, 'errors', 'symptom', ep.symptom)) {
        memStore.appendEntry(cwd, 'errors', ep);
        errorCount++;
      }
    }

    // Persist corrections via memory-store (dedup before appending)
    for (const cor of corrections) {
      if (!memStore.isDuplicate(cwd, 'corrections', 'wrong_approach', cor.wrong_approach)) {
        memStore.appendEntry(cwd, 'corrections', cor);
        correctionCount++;
      }
    }

    process.stderr.write('[nf-session-end] Extracted ' + errorCount + ' error patterns, ' + correctionCount + ' corrections\n');
  } catch (e) {
    process.stderr.write('[nf-session-end] Error: ' + e.message + '\n');
  }
  process.exit(0); // Always exit cleanly
});

// Export for unit testing
module.exports = { findLearningExtractor, findMemoryStore };
