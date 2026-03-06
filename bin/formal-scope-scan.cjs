#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SPEC_DIR = path.join(process.cwd(), '.planning', 'formal', 'spec');

function printHelp() {
  console.log(`Usage: node bin/formal-scope-scan.cjs --description "text" [options]

Options:
  --description "text"   Description to match against (required)
  --files file1,file2    Source files to check for overlap (optional)
  --format json|lines    Output format (default: json)
  --help                 Show this help message

Matching algorithm (any signal fires):
  1. Source file overlap: --files matched against module source_files globs
  2. Concept matching: exact token match against curated concepts
  3. Module name match: exact token match against module directory name

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
      process.stderr.write(`Warning: ${scopePath} not found, skipping module ${mod}\n`);
      continue;
    }

    let scope;
    try {
      scope = JSON.parse(fs.readFileSync(scopePath, 'utf8'));
    } catch (e) {
      process.stderr.write(`Warning: Failed to parse ${scopePath}: ${e.message}\n`);
      continue;
    }

    const invariantsPath = `.planning/formal/spec/${mod}/invariants.md`;
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

  if (args.format === 'lines') {
    for (const m of matches) {
      console.log(`${m.module}\t${m.path}`);
    }
  } else {
    console.log(JSON.stringify(matches, null, 2));
  }

  process.exit(0);
}

main();
