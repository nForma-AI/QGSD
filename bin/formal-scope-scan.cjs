#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SPEC_DIR = path.join(ROOT, '.planning', 'formal', 'spec');
const INDEX_PATH = path.join(ROOT, '.planning', 'formal', 'proximity-index.json');

function printHelp() {
  console.log(`Usage: node bin/formal-scope-scan.cjs --description "text" [options]

Options:
  --description "text"   Description to match against (required)
  --files file1,file2    Source files to check for overlap (optional)
  --format json|lines    Output format (default: json)
  --help                 Show this help message

Matching algorithm (layered — proximity index enriches scope.json matching):
  Layer 1 (scope.json — always runs):
    1. Source file overlap: --files matched against module source_files globs
    2. Concept matching: exact token match against curated concepts
    3. Module name match: exact token match against module directory name
  Layer 2 (proximity index — when proximity-index.json exists):
    4. Graph walk from --files code_file nodes to formal_module neighbors
    5. Enriches each match with: affected invariants, constants, requirements, proximity score

Examples:
  node bin/formal-scope-scan.cjs --description "fix quorum deliberation bug"
  node bin/formal-scope-scan.cjs --description "update breaker" --format lines
  node bin/formal-scope-scan.cjs --files "hooks/nf-stop.js" --description "something"
`);
}

function parseArgs(argv) {
  const args = { description: '', files: [], format: 'json', help: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      args.help = true;
    } else if (argv[i] === '--description' && argv[i + 1]) {
      args.description = argv[++i];
    } else if (argv[i] === '--files' && argv[i + 1]) {
      args.files = argv[++i].split(',').map(f => f.trim()).filter(Boolean);
    } else if (argv[i] === '--format' && argv[i + 1]) {
      args.format = argv[++i];
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

main();
