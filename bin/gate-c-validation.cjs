#!/usr/bin/env node
'use strict';

/**
 * gate-c-validation.cjs — Gate C L3-to-test-recipe coverage verification.
 *
 * Verifies every L3 failure mode maps to at least one test recipe.
 * Reports gate_c_score and gap list for uncovered failure modes.
 *
 * Requirements: GATE-03
 *
 * Usage:
 *   node bin/gate-c-validation.cjs            # print summary to stdout
 *   node bin/gate-c-validation.cjs --json     # print full results JSON to stdout
 */

const fs   = require('fs');
const path = require('path');

const ROOT = process.env.PROJECT_ROOT
  || (process.argv.find(a => a.startsWith('--project-root=')) || '').replace('--project-root=', '')
  || path.join(__dirname, '..');
const FORMAL = path.join(ROOT, '.planning', 'formal');
const REASONING_DIR = path.join(FORMAL, 'reasoning');
const RECIPES_DIR = path.join(FORMAL, 'test-recipes');
const GATES_DIR = path.join(FORMAL, 'gates');
const OUT_FILE = path.join(GATES_DIR, 'gate-c-validation.json');

const JSON_FLAG = process.argv.includes('--json');

// ── Gate C computation ───────────────────────────────────────────────────

function computeGateC(failureModes, recipes) {
  if (failureModes.length === 0) {
    return {
      schema_version: '1',
      generated: new Date().toISOString(),
      gate_c_score: 0,
      total_entries: 0,
      validated_entries: 0,
      unvalidated_entries: 0,
      gaps: [],
      target: 0.8,
      target_met: false,
    };
  }

  // Build lookup: failure_mode_id -> recipe[]
  const recipeMap = new Map();
  for (const r of recipes) {
    const fmId = r.failure_mode_id;
    if (!recipeMap.has(fmId)) recipeMap.set(fmId, []);
    recipeMap.get(fmId).push(r);
  }

  let validated = 0;
  const gaps = [];

  for (const fm of failureModes) {
    if (recipeMap.has(fm.id) && recipeMap.get(fm.id).length > 0) {
      validated++;
    } else {
      gaps.push({
        failure_mode_id: fm.id,
        state: fm.state,
        event: fm.event,
        failure_mode: fm.failure_mode,
        severity_class: fm.severity_class,
      });
    }
  }

  const score = validated / failureModes.length;

  return {
    schema_version: '1',
    generated: new Date().toISOString(),
    gate_c_score: Math.round(score * 10000) / 10000,
    total_entries: failureModes.length,
    validated_entries: validated,
    unvalidated_entries: gaps.length,
    gaps,
    target: 0.8,
    target_met: score >= 0.8,
  };
}

// ── Entry point ──────────────────────────────────────────────────────────

function main() {
  const startMs = Date.now();

  // Load failure-mode-catalog
  const fmPath = path.join(REASONING_DIR, 'failure-mode-catalog.json');
  if (!fs.existsSync(fmPath)) {
    console.error('ERROR: failure-mode-catalog.json not found at', fmPath);
    process.exit(1);
  }
  const fmData = JSON.parse(fs.readFileSync(fmPath, 'utf8'));
  const failureModes = fmData.failure_modes || [];

  // Load test-recipes
  const trPath = path.join(RECIPES_DIR, 'test-recipes.json');
  if (!fs.existsSync(trPath)) {
    console.error('ERROR: test-recipes.json not found at', trPath);
    console.error('Run bin/test-recipe-gen.cjs first to generate recipes.');
    process.exit(1);
  }
  const trData = JSON.parse(fs.readFileSync(trPath, 'utf8'));
  const recipes = trData.recipes || [];

  const result = computeGateC(failureModes, recipes);
  const runtimeMs = Date.now() - startMs;

  // Write output
  fs.mkdirSync(GATES_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2) + '\n');

  // Emit check result
  try {
    const { writeCheckResult } = require(path.join(__dirname, 'write-check-result.cjs'));
    writeCheckResult({
      tool: 'gate-c-validation',
      formalism: 'trace',
      result: result.target_met ? 'pass' : 'fail',
      check_id: 'gate-c:recipe-coverage',
      surface: 'trace',
      property: `Gate C test recipe coverage: ${(result.gate_c_score * 100).toFixed(1)}% (target: 80%)`,
      runtime_ms: runtimeMs,
      summary: `${result.target_met ? 'pass' : 'fail'}: coverage ${(result.gate_c_score * 100).toFixed(1)}%, ${result.validated_entries}/${result.total_entries} validated`,
      requirement_ids: ['GATE-03'],
      metadata: {
        gate_c_score: result.gate_c_score,
        target: result.target,
        target_met: result.target_met,
        gaps_count: result.unvalidated_entries,
      },
    });
  } catch (e) {
    // write-check-result.cjs not available; skip
  }

  if (JSON_FLAG) {
    process.stdout.write(JSON.stringify(result));
  } else {
    console.log('Gate C: L3-to-Test-Recipe Coverage');
    console.log(`  Score: ${(result.gate_c_score * 100).toFixed(1)}%`);
    console.log(`  Total entries: ${result.total_entries}`);
    console.log(`  Validated: ${result.validated_entries}`);
    console.log(`  Unvalidated: ${result.unvalidated_entries}`);
    console.log(`  Target met: ${result.target_met}`);
    if (result.gaps.length > 0) {
      console.log('  Gaps:');
      for (const g of result.gaps) {
        console.log(`    - ${g.failure_mode_id} (${g.failure_mode}/${g.severity_class})`);
      }
    }
    console.log(`  Output: ${OUT_FILE}`);
  }

  process.exit(result.target_met ? 0 : 1);
}

if (require.main === module) main();

module.exports = { computeGateC, main };
