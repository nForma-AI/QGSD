'use strict';
// bin/adapters/detect.cjs
// Auto-detection registry — runs all adapters to identify the framework of a source file.

const ADAPTER_IDS = [
  'xstate-v5',
  'xstate-v4',
  'jsm',
  'robot',
  'asl',
  'stately',
  'python-transitions',
  'sismic',
  'looplab-fsm',
  'qmuntal-stateless',
];

const ADAPTER_FILES = {
  'xstate-v5':         './xstate-v5.cjs',
  'xstate-v4':         './xstate-v4.cjs',
  'jsm':               './jsm.cjs',
  'robot':             './robot.cjs',
  'asl':               './asl.cjs',
  'stately':           './stately.cjs',
  'python-transitions':'./python-transitions.cjs',
  'sismic':            './sismic.cjs',
  'looplab-fsm':       './looplab-fsm.cjs',
  'qmuntal-stateless': './qmuntal-stateless.cjs',
};

/**
 * Lazily load all available adapters.
 * @returns {Array<Object>} adapter modules
 */
function listAdapters() {
  const adapters = [];
  for (const id of ADAPTER_IDS) {
    try {
      adapters.push(require(ADAPTER_FILES[id]));
    } catch (e) {
      // Adapter not yet created — fail-open with warning
      process.stderr.write('[detect] Warning: adapter "' + id + '" not loadable: ' + e.message + '\n');
    }
  }
  return adapters;
}

/**
 * Auto-detect the framework of a source file.
 * @param {string} filePath
 * @param {string} content
 * @returns {{ adapter: Object, confidence: number } | null}
 */
function detectFramework(filePath, content) {
  const adapters = listAdapters();
  let best = null;
  let bestConfidence = 0;

  for (const adapter of adapters) {
    try {
      const confidence = adapter.detect(filePath, content);
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        best = adapter;
      }
    } catch (_) {
      // Skip broken adapters
    }
  }

  if (best && bestConfidence >= 60) {
    return { adapter: best, confidence: bestConfidence };
  }
  return null;
}

/**
 * Get adapter by framework id.
 * @param {string} frameworkId
 * @returns {Object}
 */
function getAdapter(frameworkId) {
  const file = ADAPTER_FILES[frameworkId];
  if (!file) {
    throw new Error('Unknown framework: "' + frameworkId + '". Available: ' + ADAPTER_IDS.join(', '));
  }
  return require(file);
}

module.exports = { listAdapters, detectFramework, getAdapter };
