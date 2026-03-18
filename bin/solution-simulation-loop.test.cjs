#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const { simulateSolutionLoop } = require('./solution-simulation-loop.cjs');

// Helper: Create temporary directory for test isolation
function createTempDir() {
  const tmpRoot = path.join(os.tmpdir(), 'solution-sim-test-' + Date.now());
  if (!fs.existsSync(tmpRoot)) {
    fs.mkdirSync(tmpRoot, { recursive: true });
  }
  return tmpRoot;
}

// Helper: Clean up temporary directory
function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Helper: Create mock module files with simple reproducers
function setupTestEnv(tmpDir) {
  // Create .planning directory structure
  const planningDir = path.join(tmpDir, '.planning');
  const formalDir = path.join(planningDir, 'formal');
  const simDir = path.join(formalDir, 'cycle2-simulations');

  fs.mkdirSync(simDir, { recursive: true });

  // Create config.json with max_iterations
  const configPath = path.join(planningDir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify({ max_iterations: 3 }, null, 2), 'utf-8');

  // Create a dummy reproducing model file
  const reproducingModelPath = path.join(tmpDir, 'reproducing.tla');
  const modelContent = `---- MODULE reproducing ----
VARIABLE x
Init == x = 0
Next == x' = x + 1
Spec == Init /\\ [][Next]_x
====`;
  fs.writeFileSync(reproducingModelPath, modelContent, 'utf-8');

  // Create dummy bug trace file
  const bugTracePath = path.join(tmpDir, 'bug.itf');
  fs.writeFileSync(bugTracePath, JSON.stringify({ trace: 'dummy' }, null, 2), 'utf-8');

  return { planningDir, formalDir, simDir, reproducingModelPath, bugTracePath, configPath };
}

// Helper: Create mock dependencies
function createMockDeps(options = {}) {
  const {
    normalizeReturns = { mutations: [{ type: 'add_invariant', target: 'test', content: 'x > 0', reasoning: 'test' }], confidence: 1.0, ambiguities: [] },
    generateReturns = { consequenceModelPath: '/tmp/consequence.tla', appliedMutations: [], sessionDir: '/tmp/sess', diagnostics: { totalMutations: 1, appliedCount: 1, skippedCount: 0 } },
    gateVerdictConverged = false,
    gateVerdictUnavailable = false,
    normalizeThrows = null,
    generateThrows = null,
    gateThrows = null
  } = options;

  return {
    normalizer: {
      normalizeFixIntent: (intent, context) => {
        if (normalizeThrows) throw normalizeThrows;
        return normalizeReturns;
      }
    },
    generator: {
      generateConsequenceModel: (model, mutations, opts) => {
        if (generateThrows) throw generateThrows;
        return generateReturns;
      }
    },
    gateRunner: {
      runConvergenceGates: async (models, config, checkers) => {
        if (gateThrows) throw gateThrows;
        return {
          gate1_invariants: { passed: !gateVerdictConverged ? false : true, details: 'test' },
          gate2_bug_resolved: { passed: !gateVerdictConverged ? false : true, details: 'test' },
          gate3_neighbors: { passed: !gateVerdictConverged ? false : true, regressions: [], details: 'test' },
          converged: gateVerdictConverged,
          unavailable: gateVerdictUnavailable,
          preservedState: gateVerdictUnavailable,
          iteration: 1,
          writeOnceTimestamp: new Date().toISOString()
        };
      }
    }
  };
}

// Test 1: Convergence on first iteration
test('simulateSolutionLoop: convergence on first iteration', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);

    const mockDeps = createMockDeps({ gateVerdictConverged: true });

    const result = await simulateSolutionLoop(
      {
        fixIdea: 'add invariant when x > 0 then x > -1',
        bugDescription: 'x can go negative',
        reproducingModelPath,
        neighborModelPaths: [],
        bugTracePath,
        formalism: 'tla',
        maxIterations: 3
      },
      mockDeps
    );

    assert.strictEqual(result.converged, true, 'should converge on first iteration');
    assert.strictEqual(result.iterations.length, 1, 'should have 1 iteration');
    assert.strictEqual(result.escalationReason, null, 'should have no escalation reason');
    assert.ok(result.sessionId, 'should have sessionId');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 2: Convergence on second iteration
test('simulateSolutionLoop: convergence on second iteration', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);

    let callCount = 0;
    const mockDeps = createMockDeps({
      gateVerdictConverged: false
    });

    // Override gate runner to converge on iteration 2
    mockDeps.gateRunner.runConvergenceGates = async (models, config) => {
      callCount++;
      const converged = callCount >= 2;
      return {
        gate1_invariants: { passed: converged, details: 'test' },
        gate2_bug_resolved: { passed: converged, details: 'test' },
        gate3_neighbors: { passed: converged, regressions: [], details: 'test' },
        converged,
        unavailable: false,
        preservedState: false,
        iteration: callCount,
        writeOnceTimestamp: new Date().toISOString()
      };
    };

    const result = await simulateSolutionLoop(
      {
        fixIdea: 'add invariant when x > 0 then x > -1',
        bugDescription: 'x can go negative',
        reproducingModelPath,
        neighborModelPaths: [],
        bugTracePath,
        formalism: 'tla',
        maxIterations: 3
      },
      mockDeps
    );

    assert.strictEqual(result.converged, true, 'should converge on second iteration');
    assert.strictEqual(result.iterations.length, 2, 'should have 2 iterations');
    assert.strictEqual(result.escalationReason, null, 'should have no escalation reason');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 3: Max iterations exhausted (no convergence)
test('simulateSolutionLoop: max iterations exhausted', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);

    const mockDeps = createMockDeps({ gateVerdictConverged: false });

    const result = await simulateSolutionLoop(
      {
        fixIdea: 'add invariant',
        bugDescription: 'test bug',
        reproducingModelPath,
        neighborModelPaths: [],
        bugTracePath,
        formalism: 'tla',
        maxIterations: 2
      },
      mockDeps
    );

    assert.strictEqual(result.converged, false, 'should not converge');
    assert.strictEqual(result.iterations.length, 2, 'should have 2 iterations');
    assert.ok(result.escalationReason, 'should have escalation reason');
    assert.ok(result.escalationReason.includes('Max iterations'), 'escalation reason should mention max iterations');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 4: Dependency failure (unavailable)
test('simulateSolutionLoop: dependency failure with state preservation', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);

    const mockDeps = createMockDeps({ gateVerdictUnavailable: true });

    const result = await simulateSolutionLoop(
      {
        fixIdea: 'add invariant',
        bugDescription: 'test bug',
        reproducingModelPath,
        neighborModelPaths: [],
        bugTracePath,
        formalism: 'tla',
        maxIterations: 3
      },
      mockDeps
    );

    assert.strictEqual(result.converged, false, 'should not converge');
    assert.strictEqual(result.iterations.length, 1, 'should have 1 iteration (stopped early)');
    assert.ok(result.escalationReason, 'should have escalation reason');
    assert.ok(result.escalationReason.includes('unavailable'), 'escalation reason should mention unavailability');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 5: Iteration history written to session directory
test('simulateSolutionLoop: writes iteration history to disk', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);

    const mockDeps = createMockDeps({ gateVerdictConverged: true });

    const result = await simulateSolutionLoop(
      {
        fixIdea: 'add invariant',
        bugDescription: 'test bug',
        reproducingModelPath,
        neighborModelPaths: [],
        bugTracePath,
        formalism: 'tla',
        maxIterations: 3
      },
      mockDeps
    );

    const historyPath = path.join(
      tmpDir,
      '.planning',
      'formal',
      'cycle2-simulations',
      result.sessionId,
      'iteration-history.json'
    );

    assert.ok(fs.existsSync(historyPath), 'iteration history file should exist');

    const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    assert.strictEqual(history.sessionId, result.sessionId, 'history should match sessionId');
    assert.strictEqual(history.converged, true, 'history should mark converged');
    assert.strictEqual(history.totalIterations, 1, 'history should record iteration count');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 6: Default maxIterations read from config.json
test('simulateSolutionLoop: reads maxIterations from config.json', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath, configPath } = setupTestEnv(tmpDir);

    // Update config with custom maxIterations
    fs.writeFileSync(configPath, JSON.stringify({ max_iterations: 5 }, null, 2), 'utf-8');

    let iterationCount = 0;
    const mockDeps = createMockDeps({ gateVerdictConverged: false });

    // Count how many times gate runner is called
    mockDeps.gateRunner.runConvergenceGates = async () => {
      iterationCount++;
      return {
        gate1_invariants: { passed: false, details: 'test' },
        gate2_bug_resolved: { passed: false, details: 'test' },
        gate3_neighbors: { passed: false, regressions: [], details: 'test' },
        converged: false,
        unavailable: false,
        preservedState: false,
        iteration: iterationCount,
        writeOnceTimestamp: new Date().toISOString()
      };
    };

    const result = await simulateSolutionLoop(
      {
        fixIdea: 'add invariant',
        bugDescription: 'test bug',
        reproducingModelPath,
        neighborModelPaths: [],
        bugTracePath,
        formalism: 'tla'
        // Note: NOT specifying maxIterations, should read from config
      },
      mockDeps
    );

    assert.strictEqual(result.iterations.length, 5, 'should use maxIterations from config.json');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 7: Fix idea truncated in banner at 80 chars
test('simulateSolutionLoop: truncates fix idea in banner display', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);

    const longFixIdea = 'a'.repeat(100); // 100 chars, should be truncated

    const mockDeps = createMockDeps({ gateVerdictConverged: true });

    // Capture console output
    let consoleOutput = '';
    const originalLog = console.log;
    console.log = (msg) => {
      consoleOutput += msg + '\n';
      originalLog(msg);
    };

    try {
      const result = await simulateSolutionLoop(
        {
          fixIdea: longFixIdea,
          bugDescription: 'test bug',
          reproducingModelPath,
          neighborModelPaths: [],
          bugTracePath,
          formalism: 'tla',
          maxIterations: 1
        },
        mockDeps
      );

      // Check that output contains truncated version
      assert.ok(consoleOutput.includes('aaa...'), 'banner should contain truncated fix idea with ellipsis');
      assert.ok(!consoleOutput.includes('a'.repeat(100)), 'banner should not contain full 100-char fix idea');
    } finally {
      console.log = originalLog;
    }
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 8: Session ID uses crypto.randomBytes
test('simulateSolutionLoop: generates session ID with crypto.randomBytes', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);

    const mockDeps = createMockDeps({ gateVerdictConverged: true });

    const result1 = await simulateSolutionLoop(
      {
        fixIdea: 'fix idea 1',
        bugDescription: 'bug 1',
        reproducingModelPath,
        neighborModelPaths: [],
        bugTracePath,
        formalism: 'tla',
        maxIterations: 1
      },
      mockDeps
    );

    const result2 = await simulateSolutionLoop(
      {
        fixIdea: 'fix idea 2',
        bugDescription: 'bug 2',
        reproducingModelPath,
        neighborModelPaths: [],
        bugTracePath,
        formalism: 'tla',
        maxIterations: 1
      },
      mockDeps
    );

    assert.notStrictEqual(result1.sessionId, result2.sessionId, 'session IDs should be different (random)');
    assert.strictEqual(result1.sessionId.length, 16, 'session ID should be 16 hex chars (8 bytes)');
    assert.strictEqual(result2.sessionId.length, 16, 'session ID should be 16 hex chars (8 bytes)');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 9: Summary table includes all iterations
test('simulateSolutionLoop: summary table includes all iterations', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);

    let callCount = 0;
    const mockDeps = createMockDeps({ gateVerdictConverged: false });

    mockDeps.gateRunner.runConvergenceGates = async () => {
      callCount++;
      return {
        gate1_invariants: { passed: callCount === 3, details: 'test' },
        gate2_bug_resolved: { passed: false, details: 'test' },
        gate3_neighbors: { passed: false, regressions: [], details: 'test' },
        converged: false,
        unavailable: false,
        preservedState: false,
        iteration: callCount,
        writeOnceTimestamp: new Date().toISOString()
      };
    };

    // Capture console output
    let consoleOutput = '';
    const originalLog = console.log;
    console.log = (msg) => {
      consoleOutput += msg + '\n';
      originalLog(msg);
    };

    try {
      const result = await simulateSolutionLoop(
        {
          fixIdea: 'add invariant',
          bugDescription: 'test bug',
          reproducingModelPath,
          neighborModelPaths: [],
          bugTracePath,
          formalism: 'tla',
          maxIterations: 3
        },
        mockDeps
      );

      // Verify all 3 iterations appear in output
      assert.ok(consoleOutput.includes('Iteration 1/3'), 'output should show iteration 1');
      assert.ok(consoleOutput.includes('Iteration 2/3'), 'output should show iteration 2');
      assert.ok(consoleOutput.includes('Iteration 3/3'), 'output should show iteration 3');

      // Verify table header exists
      assert.ok(consoleOutput.includes('Simulation Results'), 'output should show results table');
      assert.ok(consoleOutput.includes('| Attempt |'), 'output should show table header');
    } finally {
      console.log = originalLog;
    }
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// Test 10: Invalid inputs throw errors
test('simulateSolutionLoop: rejects invalid inputs', async () => {
  const tmpDir = createTempDir();
  process.chdir(tmpDir);

  try {
    const { reproducingModelPath, bugTracePath } = setupTestEnv(tmpDir);
    const mockDeps = createMockDeps({ gateVerdictConverged: true });

    // Test: missing fixIdea
    await assert.rejects(
      () => simulateSolutionLoop(
        {
          fixIdea: '', // empty
          bugDescription: 'test bug',
          reproducingModelPath,
          neighborModelPaths: [],
          bugTracePath,
          formalism: 'tla'
        },
        mockDeps
      ),
      { message: /fixIdea must be a non-empty string/ },
      'should reject empty fixIdea'
    );

    // Test: invalid formalism
    await assert.rejects(
      () => simulateSolutionLoop(
        {
          fixIdea: 'fix idea',
          bugDescription: 'test bug',
          reproducingModelPath,
          neighborModelPaths: [],
          bugTracePath,
          formalism: 'invalid' // bad formalism
        },
        mockDeps
      ),
      { message: /formalism must be "tla" or "alloy"/ },
      'should reject invalid formalism'
    );

    // Test: missing bugTracePath
    await assert.rejects(
      () => simulateSolutionLoop(
        {
          fixIdea: 'fix idea',
          bugDescription: 'test bug',
          reproducingModelPath,
          neighborModelPaths: [],
          bugTracePath: '', // empty
          formalism: 'tla'
        },
        mockDeps
      ),
      { message: /bugTracePath is required/ },
      'should reject empty bugTracePath'
    );
  } finally {
    cleanupTempDir(tmpDir);
  }
});
