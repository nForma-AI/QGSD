#!/usr/bin/env node
'use strict';

/**
 * Solution Simulation Loop Module
 * Orchestrates the solution simulation pipeline: normalize fix intent, generate consequence models,
 * run convergence gates, and display iteration progress with automatic escalation.
 *
 * Phase 4.5 of model-driven-fix workflow.
 *
 * Module exports: { simulateSolutionLoop }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

/**
 * Simulate solution in model space through iterating cycles.
 *
 * @param {Object} input
 *   - fixIdea: string (natural language, constraints, or code sketch)
 *   - bugDescription: string (description of the bug being fixed)
 *   - reproducingModelPath: string (path to bug-reproducing model)
 *   - neighborModelPaths: array (paths to neighbor models for regression testing)
 *   - bugTracePath: string (path to ITF bug trace)
 *   - maxIterations: number (default from config.json or 3)
 *   - formalism: 'tla'|'alloy' (model formalism)
 *
 * @param {Object} deps (optional)
 *   - normalizer: { normalizeFixIntent(intent, context) } for dependency injection
 *   - generator: { generateConsequenceModel(model, mutations, options) }
 *   - gateRunner: { runConvergenceGates(models, config, checkerFns) }
 *
 * @returns {Promise<{
 *   converged: boolean,
 *   iterations: Array<{iteration, invariants, bugResolved, neighbors, status}>,
 *   finalVerdict: Object,
 *   escalationReason: string|null,
 *   sessionId: string
 * }>}
 */
async function simulateSolutionLoop(input, deps) {
  const {
    fixIdea,
    bugDescription,
    reproducingModelPath,
    neighborModelPaths = [],
    bugTracePath,
    maxIterations: inputMaxIterations,
    formalism
  } = input;

  // Step 0: Validate inputs
  if (!fixIdea || typeof fixIdea !== 'string') {
    throw new Error('fixIdea must be a non-empty string');
  }
  if (!reproducingModelPath || !fs.existsSync(reproducingModelPath)) {
    throw new Error(`reproducingModelPath not found: ${reproducingModelPath}`);
  }
  if (!bugTracePath) {
    throw new Error('bugTracePath is required');
  }
  if (!formalism || (formalism !== 'tla' && formalism !== 'alloy')) {
    throw new Error('formalism must be "tla" or "alloy"');
  }

  // Step 1: Initialize
  // Generate sessionId with 8 bytes (96-bit entropy)
  const sessionId = crypto.randomBytes(8).toString('hex');

  // Read maxIterations from config, fall back to input or default 3
  let maxIterations = inputMaxIterations;
  if (!maxIterations) {
    try {
      const configPath = path.join(process.cwd(), '.planning', 'config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        maxIterations = config.max_iterations || 3;
      } else {
        maxIterations = 3;
      }
    } catch (e) {
      maxIterations = 3;
    }
  }

  // Truncate fix idea for banner display (80 chars)
  const fixIdeaBanner = fixIdea.length > 80
    ? fixIdea.slice(0, 80) + '...'
    : fixIdea;

  // Display banner
  console.log('');
  console.log('=== Solution Simulation (Phase 4.5) ===');
  console.log(`Max iterations: ${maxIterations}`);
  console.log(`Fix idea: ${fixIdeaBanner}`);
  console.log(`Session: ${sessionId}`);
  console.log('');

  // Step 2: Set up dependency injection (use provided modules or require real ones)
  const normalizer = deps?.normalizer || require('./intent-normalizer.cjs');
  const generator = deps?.generator || require('./consequence-model-generator.cjs');
  const gateRunner = deps?.gateRunner || require('./convergence-gate-runner.cjs');

  const iterations = [];
  let converged = false;
  let escalationReason = null;
  let finalVerdict = null;

  // Step 3: Main iteration loop
  for (let i = 1; i <= maxIterations; i++) {
    // 3a: Normalize fix intent
    let normalizedIntent;
    try {
      normalizedIntent = normalizer.normalizeFixIntent(fixIdea, {
        bugDescription,
        reproducingModelPath
      });
    } catch (e) {
      escalationReason = `Intent normalization failed at iteration ${i}: ${e.message}`;
      break;
    }

    // Reuse mutations from prior iterations, or use freshly normalized ones
    const mutations = normalizedIntent.mutations;

    // 3b: Generate consequence model
    let consequenceResult;
    try {
      consequenceResult = generator.generateConsequenceModel(
        reproducingModelPath,
        mutations,
        { sessionId, formalism }
      );
    } catch (e) {
      escalationReason = `Consequence model generation failed at iteration ${i}: ${e.message}`;
      break;
    }

    // 3c: Run convergence gates
    let verdict;
    try {
      verdict = await gateRunner.runConvergenceGates(
        {
          consequenceModelPath: consequenceResult.consequenceModelPath,
          reproducingModelPath,
          neighborModelPaths
        },
        {
          bugTrace: bugTracePath,
          sessionId,
          formalism
        }
      );
    } catch (e) {
      // Gate runner threw an error (not an unavailability signal)
      if (e.message && e.message.includes('ResolvedAtWriteOnce')) {
        // This is a formal invariant violation
        escalationReason = `Formal invariant violation: ${e.message}`;
      } else {
        escalationReason = `Convergence gate execution failed at iteration ${i}: ${e.message}`;
      }
      break;
    }

    // 3d: Display iteration row
    const invariantsStatus = verdict.gate1_invariants?.passed === true ? 'PASS'
      : verdict.gate1_invariants?.passed === false ? 'FAIL' : '--';
    const bugResolvedStatus = verdict.gate2_bug_resolved?.passed === true ? 'PASS'
      : verdict.gate2_bug_resolved?.passed === false ? 'FAIL' : '--';
    const neighborsStatus = verdict.gate3_neighbors?.passed === true ? 'PASS'
      : verdict.gate3_neighbors?.passed === false ? 'FAIL' : '--';

    let status = 'FAILED';
    if (verdict.converged === true) {
      status = 'CONVERGED';
    } else if (verdict.unavailable === true) {
      status = 'UNAVAILABLE';
    }

    const iterationRecord = {
      iteration: i,
      invariants: invariantsStatus,
      bugResolved: bugResolvedStatus,
      neighbors: neighborsStatus,
      status,
      verdict
    };

    iterations.push(iterationRecord);

    console.log(`Iteration ${i}/${maxIterations}: Invariants (${invariantsStatus}) | Bug Resolved (${bugResolvedStatus}) | Neighbors (${neighborsStatus}) | ${status}`);

    // 3e: Check outcome
    if (verdict.converged === true) {
      // Convergence achieved
      converged = true;
      finalVerdict = verdict;
      break;
    } else if (verdict.unavailable === true) {
      // HaikuUnavailableNoCorruption: dependency became unavailable
      escalationReason = `Dependency unavailable: ${verdict.gate1_invariants?.details || 'external service'}. Simulation paused. All state preserved.`;
      finalVerdict = verdict;
      break;
    } else if (i === maxIterations) {
      // Last iteration and not converged
      const failedGates = [];
      if (!verdict.gate1_invariants?.passed) failedGates.push('Invariants');
      if (!verdict.gate2_bug_resolved?.passed) failedGates.push('Bug Resolved');
      if (!verdict.gate3_neighbors?.passed) failedGates.push(`Neighbors (${verdict.gate3_neighbors?.regressions?.length || 0} regressions)`);

      escalationReason = `Max iterations (${maxIterations}) exhausted. Gates still failing: ${failedGates.join(', ')}`;
      finalVerdict = verdict;
    }
  }

  // Step 4: Display summary table
  console.log('');
  console.log('=== Simulation Results ===');
  console.log('| Attempt | Invariants | Bug Resolved | Neighbors | Status    |');
  console.log('|---------|-----------|-------------|-----------|-----------|');

  for (const iter of iterations) {
    const row = `| ${iter.iteration.toString().padEnd(7)} | ${iter.invariants.padEnd(10)} | ${iter.bugResolved.padEnd(12)} | ${iter.neighbors.padEnd(9)} | ${iter.status.padEnd(9)} |`;
    console.log(row);
  }

  // Step 5: Display final verdict
  console.log('');
  if (converged) {
    console.log(`✓ Fix CONVERGED after ${iterations.length} iteration(s). Consequence model verified at: ${finalVerdict?.writeOnceTimestamp || 'verified'}`);
  } else if (escalationReason && escalationReason.includes('unavailable')) {
    console.log(`⏸ PAUSED: ${escalationReason}`);
    console.log('');
    console.log('All accumulated state preserved. Resume when dependency recovers.');
  } else if (escalationReason) {
    console.log(`⚠ ESCALATION: ${escalationReason}`);
    console.log('');
    console.log('Suggestions:');
    console.log('- Review gate failure details above');
    console.log('- Refine fix idea with more specific constraints');
    console.log('- Check model assumptions against bug trace');
  }

  // Step 6: Write iteration history to session directory
  const sessionDir = path.join(os.tmpdir(), 'nf-cycle2-simulations', sessionId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const historyPath = path.join(sessionDir, 'iteration-history.json');
  const history = {
    sessionId,
    timestamp: new Date().toISOString(),
    fixIdea,
    converged,
    totalIterations: iterations.length,
    maxIterations,
    escalationReason,
    iterations: iterations.map(iter => ({
      iteration: iter.iteration,
      invariants: iter.invariants,
      bugResolved: iter.bugResolved,
      neighbors: iter.neighbors,
      status: iter.status,
      timestamp: iter.verdict?.writeOnceTimestamp || new Date().toISOString()
    }))
  };

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');

  console.log('');
  console.log(`Session history written to: ${historyPath}`);
  console.log('');

  return {
    converged,
    iterations,
    finalVerdict: finalVerdict || null,
    escalationReason,
    sessionId
  };
}

module.exports = { simulateSolutionLoop };
