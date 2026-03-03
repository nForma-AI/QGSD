#!/usr/bin/env node
'use strict';
// bin/generate-traceability-matrix.cjs
// Generates formal/traceability-matrix.json — a bidirectional index linking
// requirements to formal properties and vice versa, with coverage statistics.
//
// Data sources:
//   1. extract-annotations.cjs output (primary — property-level)
//   2. formal/model-registry.json (fallback — model-level)
//   3. formal/check-results.ndjson (verification status)
//   4. formal/requirements.json (total requirement inventory)
//
// Usage:
//   node bin/generate-traceability-matrix.cjs            # write to formal/traceability-matrix.json
//   node bin/generate-traceability-matrix.cjs --json     # print JSON to stdout
//   node bin/generate-traceability-matrix.cjs --quiet    # suppress summary output
//
// Requirements: TRACE-01, TRACE-02, TRACE-04, ANNOT-05

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TAG = '[generate-traceability-matrix]';
const ROOT = path.resolve(__dirname, '..');

const ANNOTATIONS_SCRIPT = path.join(__dirname, 'extract-annotations.cjs');
const REGISTRY_PATH      = path.join(ROOT, 'formal', 'model-registry.json');
const NDJSON_PATH        = path.join(ROOT, 'formal', 'check-results.ndjson');
const REQUIREMENTS_PATH  = path.join(ROOT, 'formal', 'requirements.json');
const OUTPUT_PATH        = path.join(ROOT, 'formal', 'traceability-matrix.json');

// ── CLI flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonMode  = args.includes('--json');
const quietMode = args.includes('--quiet');

// ── Data Loading ────────────────────────────────────────────────────────────

/**
 * Load annotations from extract-annotations.cjs (primary source).
 * Returns { model_file: [{ property, requirement_ids }] } or {} on failure.
 */
function loadAnnotations() {
  try {
    const result = spawnSync(process.execPath, [ANNOTATIONS_SCRIPT], {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 30000,
    });
    if (result.status !== 0) {
      process.stderr.write(TAG + ' warn: extract-annotations.cjs exited ' + result.status + '\n');
      if (result.stderr) process.stderr.write(TAG + ' stderr: ' + result.stderr.trim() + '\n');
      return {};
    }
    return JSON.parse(result.stdout);
  } catch (err) {
    process.stderr.write(TAG + ' warn: extract-annotations.cjs failed: ' + err.message + '\n');
    return {};
  }
}

/**
 * Load model-registry.json (fallback source).
 * Returns { models: { file: { requirements: [...] } } } or throws on missing.
 */
function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    process.stderr.write(TAG + ' FATAL: model-registry.json not found at ' + REGISTRY_PATH + '\n');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

/**
 * Load check-results.ndjson (verification status).
 * Returns array of parsed check result objects, or [] if missing/empty.
 */
function loadCheckResults() {
  if (!fs.existsSync(NDJSON_PATH)) return [];
  const content = fs.readFileSync(NDJSON_PATH, 'utf8').trim();
  if (!content) return [];
  const entries = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch (err) {
      process.stderr.write(TAG + ' warn: skipping invalid NDJSON line\n');
    }
  }
  return entries;
}

/**
 * Load requirements.json (reference for coverage stats).
 * Returns array of requirement objects, or [] if missing.
 */
function loadRequirements() {
  if (!fs.existsSync(REQUIREMENTS_PATH)) {
    process.stderr.write(TAG + ' warn: requirements.json not found — coverage stats will show 0 total\n');
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(REQUIREMENTS_PATH, 'utf8'));
    return data.requirements || [];
  } catch (err) {
    process.stderr.write(TAG + ' warn: requirements.json parse error: ' + err.message + '\n');
    return [];
  }
}

// ── Check Result Matching ───────────────────────────────────────────────────

/**
 * Build a map of requirement_id -> latest check result from NDJSON entries.
 * For each check result, distribute its result to all its requirement_ids.
 * Last entry wins for a given check_id.
 */
function buildCheckResultMap(checkResults) {
  // Deduplicate by check_id (last entry wins)
  const byCheckId = new Map();
  for (const entry of checkResults) {
    if (entry.check_id) {
      byCheckId.set(entry.check_id, entry);
    }
  }

  // Map: requirement_id -> { result, check_id }
  const reqMap = new Map();
  for (const entry of byCheckId.values()) {
    const reqIds = entry.requirement_ids || [];
    for (const reqId of reqIds) {
      reqMap.set(reqId, {
        result: entry.result,
        check_id: entry.check_id,
      });
    }
  }
  return reqMap;
}

// ── Bidirectional Validation (TRACE-04) ─────────────────────────────────────

/**
 * Cross-validate model-registry requirements arrays against requirements.json
 * formal_models arrays. Detects asymmetric links and stale references.
 *
 * @param {Object} registry — parsed model-registry.json
 * @param {Array} requirements — array of requirement objects from requirements.json
 * @returns {{ asymmetric_links: Array, stale_links: Array, summary: Object }}
 */
function validateBidirectionalLinks(registry, requirements) {
  const asymmetricLinks = [];
  const staleLinks = [];
  const checkedPairs = new Set(); // "modelFile|reqId" to deduplicate

  // Build maps
  const registryReqs = {}; // modelFile -> Set<reqId>
  for (const [modelFile, entry] of Object.entries(registry.models || {})) {
    const reqs = entry.requirements || [];
    if (reqs.length > 0) {
      registryReqs[modelFile] = new Set(reqs);
    }
  }

  const reqModels = {}; // reqId -> Set<modelFile>
  const reqIdSet = new Set();
  for (const req of requirements) {
    reqIdSet.add(req.id);
    const models = req.formal_models || [];
    if (models.length > 0) {
      reqModels[req.id] = new Set(models);
    }
  }

  // Direction 1: model claims requirement — check if requirement claims model back
  for (const [modelFile, reqIds] of Object.entries(registryReqs)) {
    for (const reqId of reqIds) {
      const pairKey = modelFile + '|' + reqId;
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      // Check if requirement ID exists at all
      if (!reqIdSet.has(reqId)) {
        staleLinks.push({
          type: 'unknown_requirement_id',
          reference: reqId,
          referenced_by: 'model-registry ' + modelFile + ' requirements',
        });
        process.stderr.write(TAG + ' warn: stale link — model-registry ' + modelFile + ' references requirement ' + reqId + ' which does not exist in requirements.json\n');
        continue;
      }

      // Check if requirement's formal_models lists this model
      const modelsForReq = reqModels[reqId];
      if (!modelsForReq || !modelsForReq.has(modelFile)) {
        asymmetricLinks.push({
          model_file: modelFile,
          requirement_id: reqId,
          direction: 'model_claims_requirement',
          detail: 'model-registry lists ' + reqId + ' for ' + modelFile + ' but requirements.json ' + reqId + ' does not list ' + modelFile + ' in formal_models',
        });
        process.stderr.write(TAG + ' warn: asymmetric link — model-registry lists ' + reqId + ' for ' + modelFile + ' but requirements.json ' + reqId + ' does not list ' + modelFile + ' in formal_models\n');
      }
    }
  }

  // Direction 2: requirement claims model — check if model claims requirement back
  for (const [reqId, modelFiles] of Object.entries(reqModels)) {
    for (const modelFile of modelFiles) {
      const pairKey = modelFile + '|' + reqId;
      if (checkedPairs.has(pairKey)) {
        // Already checked from direction 1 — skip
        continue;
      }
      checkedPairs.add(pairKey);

      // Check if model file exists in registry
      if (!registry.models || !registry.models[modelFile]) {
        // Check if file exists on disk
        const diskPath = path.join(ROOT, modelFile);
        if (!fs.existsSync(diskPath)) {
          staleLinks.push({
            type: 'missing_model_file',
            reference: modelFile,
            referenced_by: 'requirements.json ' + reqId + ' formal_models',
          });
          process.stderr.write(TAG + ' warn: stale link — requirements.json ' + reqId + ' references ' + modelFile + ' but file does not exist\n');
        } else {
          // File exists on disk but not in registry
          asymmetricLinks.push({
            model_file: modelFile,
            requirement_id: reqId,
            direction: 'requirement_claims_model',
            detail: 'requirements.json ' + reqId + ' lists ' + modelFile + ' in formal_models but model file is not in model-registry.json',
          });
          process.stderr.write(TAG + ' warn: asymmetric link — requirements.json ' + reqId + ' lists ' + modelFile + ' in formal_models but model file is not in model-registry.json\n');
        }
        continue;
      }

      // Model is in registry — check if it claims this requirement back
      const regsForModel = registryReqs[modelFile];
      if (!regsForModel || !regsForModel.has(reqId)) {
        asymmetricLinks.push({
          model_file: modelFile,
          requirement_id: reqId,
          direction: 'requirement_claims_model',
          detail: 'requirements.json ' + reqId + ' lists ' + modelFile + ' in formal_models but model-registry ' + modelFile + ' does not list ' + reqId + ' in requirements',
        });
        process.stderr.write(TAG + ' warn: asymmetric link — requirements.json ' + reqId + ' lists ' + modelFile + ' in formal_models but model-registry ' + modelFile + ' does not list ' + reqId + ' in requirements\n');
      }
    }
  }

  const totalChecked = checkedPairs.size;
  const asymmetricCount = asymmetricLinks.length;
  const staleCount = staleLinks.length;

  return {
    asymmetric_links: asymmetricLinks,
    stale_links: staleLinks,
    summary: {
      total_checked: totalChecked,
      asymmetric_count: asymmetricCount,
      stale_count: staleCount,
      clean: asymmetricCount === 0 && staleCount === 0,
    },
  };
}

// ── Matrix Construction ─────────────────────────────────────────────────────

function buildMatrix() {
  // Load all data sources
  const annotations  = loadAnnotations();
  const registry     = loadRegistry();
  const checkResults = loadCheckResults();
  const requirements = loadRequirements();

  const checkMap = buildCheckResultMap(checkResults);

  // Track which files had annotations vs fallback
  const annotatedFiles = new Set(Object.keys(annotations));
  let fallbackCount = 0;

  // Bidirectional indexes
  const requirementsIndex = {}; // reqId -> { id, properties: [...] }
  const propertiesIndex   = {}; // "file::property" -> { ... }

  // Track all covered requirement IDs
  const coveredReqIds = new Set();

  // ── Process annotation-sourced properties ──

  let totalAnnotationProps = 0;

  for (const [modelFile, props] of Object.entries(annotations)) {
    for (const { property, requirement_ids } of props) {
      totalAnnotationProps++;
      const key = modelFile + '::' + property;

      // Find check result for this property (match by any shared requirement_id)
      let latestResult = null;
      let checkId = null;
      for (const reqId of requirement_ids) {
        const cr = checkMap.get(reqId);
        if (cr) {
          latestResult = cr.result;
          checkId = cr.check_id;
          break; // use first match
        }
      }

      // Build property entry
      const propEntry = {
        model_file: modelFile,
        property_name: property,
        requirement_ids: requirement_ids,
        source: 'annotation',
        latest_result: latestResult,
        check_id: checkId,
      };
      propertiesIndex[key] = propEntry;

      // Add to requirements index
      for (const reqId of requirement_ids) {
        coveredReqIds.add(reqId);
        if (!requirementsIndex[reqId]) {
          requirementsIndex[reqId] = { id: reqId, properties: [] };
        }
        requirementsIndex[reqId].properties.push({
          model_file: modelFile,
          property_name: property,
          source: 'annotation',
          latest_result: latestResult,
          check_id: checkId,
        });
      }

      // Detect orphan
      if (requirement_ids.length === 0) {
        // Property with no requirements — will be counted as orphan
      }
    }
  }

  // ── Process model-registry fallback ──

  const registryFiles = Object.keys(registry.models || {});

  for (const modelFile of registryFiles) {
    if (annotatedFiles.has(modelFile)) continue; // annotations exist — skip fallback

    const entry = registry.models[modelFile];
    const reqs = entry.requirements || [];
    if (reqs.length === 0) continue; // no requirements in registry either

    fallbackCount++;
    process.stderr.write(TAG + ' warn: No annotations for ' + modelFile + ', using model-registry fallback\n');

    const key = modelFile + '::(model-level)';

    // Find check result by requirement overlap
    let latestResult = null;
    let checkId = null;
    for (const reqId of reqs) {
      const cr = checkMap.get(reqId);
      if (cr) {
        latestResult = cr.result;
        checkId = cr.check_id;
        break;
      }
    }

    const propEntry = {
      model_file: modelFile,
      property_name: '(model-level)',
      requirement_ids: reqs,
      source: 'model-registry',
      latest_result: latestResult,
      check_id: checkId,
    };
    propertiesIndex[key] = propEntry;

    for (const reqId of reqs) {
      coveredReqIds.add(reqId);
      if (!requirementsIndex[reqId]) {
        requirementsIndex[reqId] = { id: reqId, properties: [] };
      }
      requirementsIndex[reqId].properties.push({
        model_file: modelFile,
        property_name: '(model-level)',
        source: 'model-registry',
        latest_result: latestResult,
        check_id: checkId,
      });
    }
  }

  // ── Coverage Summary ──

  const allReqIds = requirements.map(r => r.id);
  const totalRequirements = allReqIds.length;
  const coveredCount = allReqIds.filter(id => coveredReqIds.has(id)).length;
  const coveragePercentage = totalRequirements > 0
    ? Math.round((coveredCount / totalRequirements) * 1000) / 10
    : 0;

  const uncoveredRequirements = allReqIds
    .filter(id => !coveredReqIds.has(id))
    .sort();

  // Orphan detection: properties with empty requirement_ids
  const orphanProperties = [];
  for (const [key, prop] of Object.entries(propertiesIndex)) {
    if (!prop.requirement_ids || prop.requirement_ids.length === 0) {
      orphanProperties.push(key);
    }
  }

  // ── Bidirectional validation (TRACE-04) ──

  const bidirectionalValidation = validateBidirectionalLinks(registry, requirements);

  // ── Build matrix ──

  const matrix = {
    metadata: {
      generated_at: new Date().toISOString(),
      generator_version: '1.1',
      data_sources: {
        annotations: {
          file_count: annotatedFiles.size,
          property_count: totalAnnotationProps,
        },
        model_registry: {
          file_count: registryFiles.length,
          used_as_fallback: fallbackCount,
        },
        check_results: {
          entry_count: checkResults.length,
        },
      },
    },
    requirements: requirementsIndex,
    properties: propertiesIndex,
    coverage_summary: {
      total_requirements: totalRequirements,
      covered_count: coveredCount,
      coverage_percentage: coveragePercentage,
      uncovered_requirements: uncoveredRequirements,
      orphan_properties: orphanProperties,
    },
    bidirectional_validation: bidirectionalValidation,
  };

  return matrix;
}

// ── Output ──────────────────────────────────────────────────────────────────

function main() {
  const matrix = buildMatrix();
  const jsonStr = JSON.stringify(matrix, null, 2);

  if (jsonMode) {
    process.stdout.write(jsonStr + '\n');
    return;
  }

  // Write to file
  fs.writeFileSync(OUTPUT_PATH, jsonStr + '\n', 'utf8');

  if (!quietMode) {
    const cs = matrix.coverage_summary;
    const ds = matrix.metadata.data_sources;
    const matchedChecks = new Set();
    for (const prop of Object.values(matrix.properties)) {
      if (prop.check_id) matchedChecks.add(prop.check_id);
    }

    const bv = matrix.bidirectional_validation.summary;

    process.stdout.write(TAG + ' Generated formal/traceability-matrix.json\n');
    process.stdout.write(TAG + '   Requirements: ' + cs.covered_count + ' covered / ' + cs.total_requirements + ' total (' + cs.coverage_percentage + '%)\n');
    process.stdout.write(TAG + '   Properties: ' + ds.annotations.property_count + ' (' + ds.annotations.file_count + ' files)\n');
    process.stdout.write(TAG + '   Orphan properties: ' + cs.orphan_properties.length + '\n');
    process.stdout.write(TAG + '   Check results matched: ' + matchedChecks.size + '\n');
    process.stdout.write(TAG + '   Bidirectional validation: ' + bv.asymmetric_count + ' asymmetric, ' + bv.stale_count + ' stale (' + bv.total_checked + ' pairs checked)\n');
  }
}

main();
