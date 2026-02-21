#!/usr/bin/env node
'use strict';

/**
 * update-scoreboard.cjs
 *
 * CLI script to update .planning/quorum-scoreboard.json atomically.
 * Reads current JSON, applies score delta for one model/round, recalculates
 * all cumulative stats from scratch, writes back.
 *
 * Usage:
 *   node bin/update-scoreboard.cjs \
 *     --model <name> --result <code> --task <label> --round <n> --verdict <v> \
 *     [--scoreboard <path>]
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Score delta lookup
// ---------------------------------------------------------------------------

const SCORE_DELTAS = {
  TP:      1,
  TN:      5,
  FP:     -3,
  FN:     -1,
  'TP+':   3,   // +1 TP effectiveness + +2 improvement bonus
  UNAVAIL: 0,
  '':      0,
};

const VALID_MODELS   = ['claude', 'gemini', 'opencode', 'copilot', 'codex'];
const VALID_RESULTS  = ['TP', 'TN', 'FP', 'FN', 'TP+', 'UNAVAIL', ''];
const VALID_VERDICTS = ['APPROVE', 'BLOCK', 'DELIBERATE', 'CONSENSUS', 'GAPS_FOUND', '—'];

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      const name = key.slice(2);
      const value = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')
        ? argv[++i]
        : '';
      args[name] = value;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Usage / validation
// ---------------------------------------------------------------------------

const USAGE = `Usage: node bin/update-scoreboard.cjs --model <name> --result <code> --task <label> --round <n> --verdict <v> [--scoreboard <path>]
  --model     claude | gemini | opencode | copilot | codex
  --result    TP | TN | FP | FN | TP+ | UNAVAIL | (empty for not scored)
  --task      task label, e.g. "quick-25"
  --round     round number (integer)
  --verdict   APPROVE | BLOCK | DELIBERATE | CONSENSUS | GAPS_FOUND | —`;

function validate(args) {
  const errors = [];

  if (!args.model)   errors.push('--model is required');
  if (!args.task)    errors.push('--task is required');
  if (!args.round)   errors.push('--round is required');
  if (!args.verdict) errors.push('--verdict is required');
  // --result can be empty string (not scored), but must be present as key
  if (!('result' in args)) errors.push('--result is required (use empty string for not scored)');

  if (args.model && !VALID_MODELS.includes(args.model)) {
    errors.push(`--model must be one of: ${VALID_MODELS.join(', ')}`);
  }

  const result = args.result || '';
  if (!VALID_RESULTS.includes(result)) {
    errors.push(`--result must be one of: TP, TN, FP, FN, TP+, UNAVAIL, (empty)`);
  }

  const roundNum = parseInt(args.round, 10);
  if (isNaN(roundNum) || roundNum < 1) {
    errors.push('--round must be a positive integer');
  }

  if (errors.length > 0) {
    process.stderr.write(USAGE + '\n\nErrors:\n' + errors.map(e => '  ' + e).join('\n') + '\n');
    process.exit(1);
  }

  return {
    model:      args.model,
    result:     result,
    task:       args.task,
    round:      roundNum,
    verdict:    args.verdict,
    scoreboard: args.scoreboard || '.planning/quorum-scoreboard.json',
  };
}

// ---------------------------------------------------------------------------
// JSON schema helpers
// ---------------------------------------------------------------------------

function emptyModelStats() {
  return { score: 0, tp: 0, tn: 0, fp: 0, fn: 0, impr: 0 };
}

function emptyData() {
  return {
    models: {
      claude:   emptyModelStats(),
      gemini:   emptyModelStats(),
      opencode: emptyModelStats(),
      copilot:  emptyModelStats(),
      codex:    emptyModelStats(),
    },
    rounds: [],
  };
}

function loadData(scoreboard) {
  const absPath = path.resolve(process.cwd(), scoreboard);
  if (!fs.existsSync(absPath)) {
    return emptyData();
  }
  try {
    const raw = fs.readFileSync(absPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`[update-scoreboard] WARNING: could not parse ${absPath}: ${e.message}\n`);
    return emptyData();
  }
}

// ---------------------------------------------------------------------------
// Cumulative stats recompute (from-scratch to avoid drift)
// ---------------------------------------------------------------------------

function recomputeStats(data) {
  // Reset all model stats
  for (const model of VALID_MODELS) {
    if (!data.models[model]) data.models[model] = emptyModelStats();
    const m = data.models[model];
    m.score = 0;
    m.tp    = 0;
    m.tn    = 0;
    m.fp    = 0;
    m.fn    = 0;
    m.impr  = 0;
  }

  for (const round of data.rounds) {
    const votes = round.votes || {};
    for (const model of VALID_MODELS) {
      const vote = votes[model];
      if (!vote || vote === 'UNAVAIL' || vote === '') continue;

      const m = data.models[model];
      const delta = SCORE_DELTAS[vote];
      if (delta === undefined) continue; // unknown vote code — skip

      m.score += delta;

      if (vote === 'TP' || vote === 'TP+') m.tp += 1;
      if (vote === 'TN')                   m.tn += 1;
      if (vote === 'FP')                   m.fp += 1;
      if (vote === 'FN')                   m.fn += 1;
      if (vote === 'TP+')                  m.impr += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Today's date in MM-DD format
// ---------------------------------------------------------------------------

function todayMMDD() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const rawArgs = process.argv.slice(2);
  const parsed  = parseArgs(rawArgs);
  const cfg     = validate(parsed);

  const data = loadData(cfg.scoreboard);

  // Ensure all model keys exist
  for (const model of VALID_MODELS) {
    if (!data.models[model]) data.models[model] = emptyModelStats();
  }

  // Find existing round entry matching task + round number
  const existingIdx = data.rounds.findIndex(
    r => r.task === cfg.task && r.round === cfg.round
  );

  if (existingIdx !== -1) {
    // Update existing entry: set/overwrite the model's vote, preserve verdict
    data.rounds[existingIdx].votes = data.rounds[existingIdx].votes || {};
    data.rounds[existingIdx].votes[cfg.model] = cfg.result;
    // Allow verdict update too
    data.rounds[existingIdx].verdict = cfg.verdict;
  } else {
    // Append new round entry
    data.rounds.push({
      date:    todayMMDD(),
      task:    cfg.task,
      round:   cfg.round,
      votes:   { [cfg.model]: cfg.result },
      verdict: cfg.verdict,
    });
  }

  // Recompute all cumulative stats from scratch
  recomputeStats(data);

  // Write back
  const absPath = path.resolve(process.cwd(), cfg.scoreboard);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

  // Print confirmation
  const delta    = SCORE_DELTAS[cfg.result] || 0;
  const sign     = delta >= 0 ? '+' : '';
  const newScore = data.models[cfg.model].score;
  const deltaStr = cfg.result === '' ? '(not scored)' : `${cfg.result} (${sign}${delta})`;
  process.stdout.write(
    `[update-scoreboard] ${cfg.model}: ${deltaStr} → score: ${newScore} | ${cfg.task} R${cfg.round} ${cfg.verdict}\n`
  );
}

main();
