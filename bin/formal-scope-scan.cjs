#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const crypto = require('crypto');

const ROOT = process.cwd();
const SPEC_DIR = path.join(ROOT, '.planning', 'formal', 'spec');
const INDEX_PATH = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');
const REGISTRY_PATH = path.join(ROOT, '.planning', 'formal', 'model-registry.json');
const BUG_GAPS_PATH = path.join(ROOT, '.planning', 'formal', 'bug-model-gaps.json');

function printHelp() {
  console.log(`Usage: node bin/formal-scope-scan.cjs --description "text" [options]

Options:
  --description "text"   Description to match against (required)
  --files file1,file2    Source files to check for overlap (optional)
  --format json|lines    Output format (default: json)
  --bug-mode             Bug-mode: match against model-registry.json with
                         formalism type and requirement coverage in output
  --persist-gap          With --bug-mode: persist lookup result to
                         bug-model-gaps.json for cross-session tracking
  --help                 Show this help message

Matching algorithm (layered — proximity index enriches scope.json matching):
  Layer 1 (scope.json — always runs):
    1. Source file overlap: --files matched against module source_files globs
    2. Concept matching: exact token match against curated concepts
    3. Module name match: exact token match against module directory name
  Layer 2 (proximity index — when proximity-index.json exists):
    4. Graph walk from --files code_file nodes to formal_module neighbors
    5. Enriches each match with: affected invariants, constants, requirements, proximity score

Bug-mode matching (--bug-mode):
  Scans model-registry.json entries using semantic/concept scoring:
    - Tokenizes bug description and matches against model path names
    - Scores requirement category prefix matches (e.g., "DETECT" in bug
      matches model with DETECT-01)
    - Returns formalism type (tla/alloy) and requirement coverage per match
    - Falls back to standard mode if model-registry.json is missing

Examples:
  node bin/formal-scope-scan.cjs --description "fix quorum deliberation bug"
  node bin/formal-scope-scan.cjs --description "update breaker" --format lines
  node bin/formal-scope-scan.cjs --files "hooks/nf-stop.js" --description "something"
  node bin/formal-scope-scan.cjs --bug-mode --description "circuit breaker timeout"
  node bin/formal-scope-scan.cjs --bug-mode --persist-gap --description "test bug"
`);
}

function parseArgs(argv) {
  const args = { description: '', files: [], format: 'json', help: false, bugMode: false, persistGap: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      args.help = true;
    } else if (argv[i] === '--description' && argv[i + 1]) {
      args.description = argv[++i];
    } else if (argv[i] === '--files' && argv[i + 1]) {
      args.files = argv[++i].split(',').map(f => f.trim()).filter(Boolean);
    } else if (argv[i] === '--format' && argv[i + 1]) {
      args.format = argv[++i];
    } else if (argv[i] === '--bug-mode') {
      args.bugMode = true;
    } else if (argv[i] === '--persist-gap') {
      args.persistGap = true;
    }
  }
  return args;
}

function globToRegex(glob) {
  let regex = '';
  let i = 0;
  while (i < glob.length) {
    if (glob[i] === '*' && glob[i + 1] === '*') {
      regex += '.*';
      i += 2;
      if (glob[i] === '/') i++; // skip trailing slash after **
    } else if (glob[i] === '*') {
      regex += '[^/]*';
      i++;
    } else if (glob[i] === '?') {
      regex += '[^/]';
      i++;
    } else if ('.+^${}()|[]\\'.includes(glob[i])) {
      regex += '\\' + glob[i];
      i++;
    } else {
      regex += glob[i];
      i++;
    }
  }
  return new RegExp('^' + regex + '$');
}

function matchesSourceFiles(providedFiles, moduleSourceFiles) {
  for (const pf of providedFiles) {
    for (const sf of moduleSourceFiles) {
      const re = globToRegex(sf);
      if (re.test(pf)) return true;
    }
  }
  return false;
}

function matchesConcepts(descLower, tokens, concepts) {
  for (const concept of concepts) {
    const conceptLower = concept.toLowerCase();
    // Exact token match
    if (tokens.includes(conceptLower)) return true;
    // Multi-word concept substring match against raw description
    if (conceptLower.includes('-') || conceptLower.includes(' ')) {
      if (descLower.includes(conceptLower)) return true;
    }
  }
  return false;
}

function matchesModuleName(tokens, moduleName) {
  return tokens.includes(moduleName.toLowerCase());
}

// ── Proximity Index Layer ─────────────────────────────────────────────────────

/**
 * Load the proximity index. Returns null if unavailable (fail-open).
 */
function loadProximityIndex() {
  try {
    if (!fs.existsSync(INDEX_PATH)) return null;
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (e) {
    process.stderr.write('Warning: Failed to load proximity-index.json: ' + e.message + '\n');
    return null;
  }
}

/**
 * BFS reach from a node, up to maxDepth hops, filtered by type.
 */
function reachFiltered(index, startKey, maxDepth, typeFilter) {
  const results = [];
  const visited = new Set([startKey]);
  let frontier = [{ key: startKey, depth: 0 }];

  while (frontier.length > 0) {
    const nextFrontier = [];
    for (const { key, depth } of frontier) {
      if (depth >= maxDepth) continue;
      const node = index.nodes[key];
      if (!node) continue;
      for (const edge of node.edges) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        const target = index.nodes[edge.to];
        if (!target) continue;
        const d = depth + 1;
        if (typeFilter.includes(target.type)) {
          results.push({ key: edge.to, type: target.type, rel: edge.rel, depth: d });
        }
        nextFrontier.push({ key: edge.to, depth: d });
      }
    }
    frontier = nextFrontier;
  }

  return results;
}

/**
 * Compute proximity score between two nodes using edge weights and decay.
 * Uses BFS with weighted propagation — first path found (shortest) wins.
 */
function proximityScore(index, fromKey, toKey) {
  const EDGE_WEIGHTS = {
    owns: 1.0, owned_by: 1.0,
    contains: 1.0, in_file: 1.0,
    emits: 0.9, emitted_by: 0.9,
    maps_to: 0.9, mapped_from: 0.9,
    declared_in: 0.9,
    modeled_by: 0.8, models: 0.8,
    declares: 0.8, declared_by: 0.8,
    verified_by: 0.8, verifies: 0.8,
    tested_by: 0.7, tests: 0.7,
    triggers: 0.7, triggered_by: 0.7,
    transitions: 0.6,
    describes: 0.5, described_by: 0.5,
    constrains: 0.5, constrained_by: 0.5,
    scores: 0.4, scored_by: 0.4,
    affects: 0.4, affected_by: 0.4
  };
  const DECAY = 0.7;

  if (fromKey === toKey) return 1.0;
  const visited = new Set([fromKey]);
  const queue = [{ key: fromKey, score: 1.0 }];

  while (queue.length > 0) {
    const { key, score } = queue.shift();
    const node = index.nodes[key];
    if (!node) continue;

    for (const edge of node.edges) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      const edgeWeight = EDGE_WEIGHTS[edge.rel] || 0.3;
      const nextScore = score * edgeWeight * DECAY;
      if (edge.to === toKey) return nextScore;
      if (nextScore > 0.01) {
        queue.push({ key: edge.to, score: nextScore });
      }
    }
  }

  return 0;
}

/**
 * Enrich scope-scan matches with proximity index data.
 * Also discovers modules missed by token matching via graph walks from --files.
 */
function enrichWithProximityIndex(matches, files, tokens) {
  const index = loadProximityIndex();
  if (!index || !index.nodes) return matches;

  const matchedModules = new Set(matches.map(m => m.module));

  // Walk from provided --files to discover formal_modules via graph
  if (files.length > 0) {
    for (const file of files) {
      const fileKey = 'code_file::' + file;
      if (!index.nodes[fileKey]) continue;

      const reachable = reachFiltered(index, fileKey, 2, ['formal_module']);
      for (const r of reachable) {
        const modName = r.key.replace('formal_module::', '');
        if (!matchedModules.has(modName)) {
          matchedModules.add(modName);
          const invariantsPath = '.planning/formal/spec/' + modName + '/invariants.md';
          matches.push({ module: modName, path: invariantsPath, matched_by: 'proximity_graph' });
        }
      }
    }
  }

  // Enrich each match with proximity data
  for (const match of matches) {
    const moduleKey = 'formal_module::' + match.module;
    if (!index.nodes[moduleKey]) continue;

    // Find affected invariants (depth 2)
    const invariants = reachFiltered(index, moduleKey, 2, ['invariant']);
    if (invariants.length > 0) {
      match.invariants = invariants.map(inv => inv.key.replace('invariant::', ''));
    }

    // Find affected requirements (depth 3)
    const requirements = reachFiltered(index, moduleKey, 3, ['requirement']);
    if (requirements.length > 0) {
      match.requirements = requirements.map(req => req.key.replace('requirement::', ''));
    }

    // Find constants at risk (depth 2)
    const constants = reachFiltered(index, moduleKey, 2, ['constant']);
    if (constants.length > 0) {
      const enrichedConstants = [];
      for (const c of constants) {
        const cNode = index.nodes[c.key];
        if (cNode && cNode.formal_value !== undefined) {
          enrichedConstants.push({ name: c.key.replace('constant::', ''), formal_value: cNode.formal_value });
        }
      }
      if (enrichedConstants.length > 0) match.constants = enrichedConstants;
    }

    // Compute proximity score from each --file to this module
    if (files.length > 0) {
      let maxScore = 0;
      for (const file of files) {
        const fileKey = 'code_file::' + file;
        if (!index.nodes[fileKey]) continue;
        const score = proximityScore(index, fileKey, moduleKey);
        if (score > maxScore) maxScore = score;
      }
      if (maxScore > 0) {
        match.proximity_score = Math.round(maxScore * 1000) / 1000;
      }
    }
  }

  // Sort: direct matches first (source_file > concept > module_name > proximity_graph), then by score
  matches.sort((a, b) => {
    const weights = { source_file: 3, concept: 2, module_name: 1, proximity_graph: 0 };
    const aWeight = weights[a.matched_by] || 0;
    const bWeight = weights[b.matched_by] || 0;
    if (aWeight !== bWeight) return bWeight - aWeight;
    return (b.proximity_score || 0) - (a.proximity_score || 0);
  });

  return matches;
}

// ── Bug-Mode Layer ──────────────────────────────────────────────────────────

/**
 * Load model-registry.json. Returns null if unavailable (fail-open).
 */
function loadModelRegistry(registryPath) {
  const p = registryPath || REGISTRY_PATH;
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    process.stderr.write('Warning: Failed to load model-registry.json: ' + e.message + '\n');
    return null;
  }
}

/**
 * Derive formalism type from model path key (e.g., ".planning/formal/tla/X.tla" -> "tla").
 */
function deriveFormalism(modelKey) {
  if (modelKey.endsWith('.tla')) return 'tla';
  if (modelKey.endsWith('.als')) return 'alloy';
  return 'unknown';
}

/**
 * Score concept match between a bug description and model metadata.
 * Tokenizes description, matches against model path name tokens and requirement category prefixes.
 */
function scoreConceptMatch(bugDescription, modelKey, modelMetadata) {
  const tokens = bugDescription.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (tokens.length === 0) return 0;
  let score = 0;

  // Extract descriptive tokens from model key path (e.g., "NFCircuitBreaker.tla" -> ["nfcircuitbreaker"])
  // Also split camelCase/PascalCase into individual words
  const baseName = path.basename(modelKey).replace(/\.(tla|als)$/, '');
  const modelNameTokens = baseName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter(t => t.length > 2);

  // Score model description tokens
  if (modelMetadata.description) {
    const descTokens = modelMetadata.description.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    for (const modelToken of descTokens) {
      if (tokens.includes(modelToken)) score += 0.1;
    }
  }

  // Score model name tokens
  for (const modelToken of modelNameTokens) {
    if (tokens.some(t => t === modelToken || modelToken.includes(t) || t.includes(modelToken))) {
      score += 0.1;
    }
  }

  // Score requirement category prefix matches (e.g., "DETECT" from "DETECT-01")
  for (const req of (modelMetadata.requirements || [])) {
    const category = req.split('-')[0].toLowerCase();
    if (category.length > 2 && tokens.some(t => category.includes(t) || t.includes(category))) {
      score += 0.2;
    }
  }

  return Math.min(score, 1.0);
}

/**
 * Run bug-mode matching: scan model-registry.json entries, score by concept match,
 * enrich with formalism type and requirement coverage.
 */
function runBugModeMatching(description, files, registryPath) {
  const registry = loadModelRegistry(registryPath);
  if (!registry || !registry.models) {
    process.stderr.write('Warning: model-registry.json not available, falling back to standard mode\n');
    return null; // signal caller to fall back
  }

  const matches = [];
  for (const [modelKey, modelMeta] of Object.entries(registry.models)) {
    const relevanceScore = scoreConceptMatch(description, modelKey, modelMeta);
    if (relevanceScore > 0) {
      matches.push({
        model: modelKey,
        path: modelKey,
        matched_by: 'bug_pattern',
        formalism: deriveFormalism(modelKey),
        requirement_coverage: modelMeta.requirements || [],
        bug_relevance_score: Math.round(relevanceScore * 1000) / 1000
      });
    }
  }

  // Rank by bug_relevance_score descending
  matches.sort((a, b) => b.bug_relevance_score - a.bug_relevance_score);

  return matches;
}

// ── Bug-Model Gaps Persistence ──────────────────────────────────────────────

/**
 * Generate a deterministic bug ID from description.
 */
function hashBugId(description) {
  return crypto.createHash('sha256').update(description).digest('hex').slice(0, 8);
}

/**
 * Load bug-model-gaps.json. Returns default structure if missing.
 */
function loadBugModelGaps(gapsPath) {
  const p = gapsPath || BUG_GAPS_PATH;
  try {
    if (!fs.existsSync(p)) return { version: '1.0', entries: [] };
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    process.stderr.write('Warning: Failed to load bug-model-gaps.json: ' + e.message + '\n');
    return { version: '1.0', entries: [] };
  }
}

/**
 * Save bug-model-gaps.json to disk.
 */
function saveBugModelGaps(data, gapsPath) {
  const p = gapsPath || BUG_GAPS_PATH;
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Persist a bug-mode lookup result to bug-model-gaps.json.
 * Deduplicates by exact description match.
 */
function persistBugGap(description, matches, gapsPath) {
  const data = loadBugModelGaps(gapsPath);
  const bugId = hashBugId(description);
  const timestamp = new Date().toISOString();
  const matchedModels = matches.map(m => m.model || m.path);
  const status = matchedModels.length > 0 ? 'no_reproduction' : 'no_coverage';

  // Check for existing entry with same description (dedup)
  const existingIdx = data.entries.findIndex(e => e.description === description);
  if (existingIdx >= 0) {
    // Update existing entry
    data.entries[existingIdx].timestamp = timestamp;
    data.entries[existingIdx].matched_models = matchedModels;
    data.entries[existingIdx].status = status;
  } else {
    // Append new entry
    data.entries.push({
      bug_id: bugId,
      description,
      timestamp,
      status,
      matched_models: matchedModels,
      checked_models: [],
      session_id: null
    });
  }

  saveBugModelGaps(data, gapsPath);
  return data;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (!args.description) {
    console.error('Error: --description is required');
    process.exit(1);
  }

  // Bug-mode: match against model-registry.json
  if (args.bugMode) {
    const bugMatches = runBugModeMatching(args.description, args.files);
    if (bugMatches !== null) {
      // Persist gap if requested
      if (args.persistGap) {
        persistBugGap(args.description, bugMatches);
      }

      if (args.format === 'lines') {
        for (const m of bugMatches) {
          console.log(m.model + '\t' + m.formalism + '\t' + m.bug_relevance_score);
        }
      } else {
        console.log(JSON.stringify(bugMatches, null, 2));
      }
      process.exit(0);
    }
    // bugMatches === null means registry unavailable, fall through to standard mode
  }

  // Fail-open: if spec dir doesn't exist, output empty
  if (!fs.existsSync(SPEC_DIR)) {
    if (args.format === 'lines') {
      // no output
    } else {
      console.log('[]');
    }
    process.exit(0);
  }

  const descLower = args.description.toLowerCase();
  const tokens = descLower.split(/[\s\-_]+/).filter(t => t.length > 0);

  const modules = fs.readdirSync(SPEC_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const matches = [];

  for (const mod of modules) {
    const scopePath = path.join(SPEC_DIR, mod, 'scope.json');
    if (!fs.existsSync(scopePath)) {
      process.stderr.write('Warning: ' + scopePath + ' not found, skipping module ' + mod + '\n');
      continue;
    }

    let scope;
    try {
      scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
    } catch (e) {
      process.stderr.write('Warning: Failed to parse ' + scopePath + ': ' + e.message + '\n');
      continue;
    }

    const invariantsPath = '.planning/formal/spec/' + mod + '/invariants.md';
    let matchedBy = null;

    // Priority 1: Source file overlap
    if (args.files.length > 0 && scope.source_files && matchesSourceFiles(args.files, scope.source_files)) {
      matchedBy = 'source_file';
    }

    // Priority 2: Concept matching
    if (!matchedBy && scope.concepts && matchesConcepts(descLower, tokens, scope.concepts)) {
      matchedBy = 'concept';
    }

    // Priority 3: Module name match (exact token only)
    if (!matchedBy && matchesModuleName(tokens, mod)) {
      matchedBy = 'module_name';
    }

    if (matchedBy) {
      matches.push({ module: mod, path: invariantsPath, matched_by: matchedBy });
    }
  }

  // Layer 2: Proximity index enrichment (fail-open)
  const enriched = enrichWithProximityIndex(matches, args.files, tokens);

  if (args.format === 'lines') {
    for (const m of enriched) {
      console.log(m.module + '\t' + m.path);
    }
  } else {
    console.log(JSON.stringify(enriched, null, 2));
  }

  process.exit(0);
}

// Export internals for testing
if (typeof module !== 'undefined') {
  module.exports = {
    parseArgs,
    scoreConceptMatch,
    deriveFormalism,
    runBugModeMatching,
    loadModelRegistry,
    hashBugId,
    loadBugModelGaps,
    saveBugModelGaps,
    persistBugGap
  };
}

// Only run main when executed directly (not required as module)
if (require.main === module) {
  main();
}
