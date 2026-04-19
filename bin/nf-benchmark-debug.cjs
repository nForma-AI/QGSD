#!/usr/bin/env node
'use strict';
// bin/nf-benchmark-debug.cjs
// Standalone scorer for the nf:debug autonomy benchmark.
// Runs all 7 buggy stubs through nf-debug-runner.cjs and reports a 0-100 score.
//
// Usage:
//   node bin/nf-benchmark-debug.cjs
//   node bin/nf-benchmark-debug.cjs --dry-run
//   node bin/nf-benchmark-debug.cjs --dry-run --json
//   node bin/nf-benchmark-debug.cjs --json
//   node bin/nf-benchmark-debug.cjs --verbose
//   node bin/nf-benchmark-debug.cjs --timeout 120000

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const jsonOutput = args.includes('--json');
const verbose = args.includes('--verbose');
const timeoutIdx = args.indexOf('--timeout');
const runnerTimeout = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : 180000;

const ROOT = process.cwd();
const NF_DEBUG_RUNNER = path.join(__dirname, 'nf-debug-runner.cjs');

const STUBS = [
  // ── easy (20) ─────────────────────────────────────────────────────────────
  { id: 'sort',              tier: 'easy',      stub: 'bin/bench-buggy-sort.cjs',                                         test: 'benchmarks/debug/tests/sort.test.cjs' },
  { id: 'filter',            tier: 'easy',      stub: 'bin/bench-buggy-filter.cjs',                                       test: 'benchmarks/debug/tests/filter.test.cjs' },
  { id: 'counter',           tier: 'easy',      stub: 'bin/bench-buggy-counter.cjs',                                      test: 'benchmarks/debug/tests/counter.test.cjs' },
  { id: 'max-value',         tier: 'easy',      stub: 'bin/bench-buggy-max-value.cjs',                                    test: 'benchmarks/debug/tests/max-value.test.cjs' },
  { id: 'sum-array',         tier: 'easy',      stub: 'bin/bench-buggy-sum-array.cjs',                                    test: 'benchmarks/debug/tests/sum-array.test.cjs' },
  { id: 'string-reverse',    tier: 'easy',      stub: 'bin/bench-buggy-string-reverse.cjs',                               test: 'benchmarks/debug/tests/string-reverse.test.cjs' },
  { id: 'find-index',        tier: 'easy',      stub: 'bin/bench-buggy-find-index.cjs',                                   test: 'benchmarks/debug/tests/find-index.test.cjs' },
  { id: 'clamp',             tier: 'easy',      stub: 'bin/bench-buggy-clamp.cjs',                                        test: 'benchmarks/debug/tests/clamp.test.cjs' },
  { id: 'factorial',         tier: 'easy',      stub: 'bin/bench-buggy-factorial.cjs',                                    test: 'benchmarks/debug/tests/factorial.test.cjs' },
  { id: 'is-palindrome',     tier: 'easy',      stub: 'bin/bench-buggy-is-palindrome.cjs',                                test: 'benchmarks/debug/tests/is-palindrome.test.cjs' },
  { id: 'count-occurrences', tier: 'easy',      stub: 'bin/bench-buggy-count-occurrences.cjs',                            test: 'benchmarks/debug/tests/count-occurrences.test.cjs' },
  { id: 'average',           tier: 'easy',      stub: 'bin/bench-buggy-average.cjs',                                      test: 'benchmarks/debug/tests/average.test.cjs' },
  { id: 'last-element',      tier: 'easy',      stub: 'bin/bench-buggy-last-element.cjs',                                 test: 'benchmarks/debug/tests/last-element.test.cjs' },
  { id: 'range',             tier: 'easy',      stub: 'bin/bench-buggy-range.cjs',                                        test: 'benchmarks/debug/tests/range.test.cjs' },
  { id: 'capitalize',        tier: 'easy',      stub: 'bin/bench-buggy-capitalize.cjs',                                   test: 'benchmarks/debug/tests/capitalize.test.cjs' },
  { id: 'chunk',             tier: 'easy',      stub: 'bin/bench-buggy-chunk.cjs',                                        test: 'benchmarks/debug/tests/chunk.test.cjs' },
  { id: 'starts-with',       tier: 'easy',      stub: 'bin/bench-buggy-starts-with.cjs',                                  test: 'benchmarks/debug/tests/starts-with.test.cjs' },
  { id: 'remove-falsy',      tier: 'easy',      stub: 'bin/bench-buggy-remove-falsy.cjs',                                 test: 'benchmarks/debug/tests/remove-falsy.test.cjs' },
  { id: 'min-value',         tier: 'easy',      stub: 'bin/bench-buggy-min-value.cjs',                                    test: 'benchmarks/debug/tests/min-value.test.cjs' },
  { id: 'count-words',       tier: 'easy',      stub: 'bin/bench-buggy-count-words.cjs',                                  test: 'benchmarks/debug/tests/count-words.test.cjs' },
  // ── medium (20) ───────────────────────────────────────────────────────────
  { id: 'dedup',             tier: 'medium',    stub: 'bin/bench-buggy-medium-dedup.cjs',                                 test: 'benchmarks/debug/tests/dedup.test.cjs' },
  { id: 'accumulator',       tier: 'medium',    stub: 'bin/bench-buggy-medium-accumulator.cjs',                           test: 'benchmarks/debug/tests/accumulator.test.cjs' },
  { id: 'deep-equal',        tier: 'medium',    stub: 'bin/bench-buggy-medium-deep-equal.cjs',                            test: 'benchmarks/debug/tests/medium-deep-equal.test.cjs' },
  { id: 'memoize',           tier: 'medium',    stub: 'bin/bench-buggy-medium-memoize.cjs',                               test: 'benchmarks/debug/tests/medium-memoize.test.cjs' },
  { id: 'deep-clone',        tier: 'medium',    stub: 'bin/bench-buggy-medium-deep-clone.cjs',                            test: 'benchmarks/debug/tests/medium-deep-clone.test.cjs' },
  { id: 'flatten-deep',      tier: 'medium',    stub: 'bin/bench-buggy-medium-flatten-deep.cjs',                          test: 'benchmarks/debug/tests/medium-flatten-deep.test.cjs' },
  { id: 'group-by',          tier: 'medium',    stub: 'bin/bench-buggy-medium-group-by.cjs',                              test: 'benchmarks/debug/tests/medium-group-by.test.cjs' },
  { id: 'once',              tier: 'medium',    stub: 'bin/bench-buggy-medium-once.cjs',                                  test: 'benchmarks/debug/tests/medium-once.test.cjs' },
  { id: 'pipe',              tier: 'medium',    stub: 'bin/bench-buggy-medium-pipe.cjs',                                  test: 'benchmarks/debug/tests/medium-pipe.test.cjs' },
  { id: 'pick',              tier: 'medium',    stub: 'bin/bench-buggy-medium-pick.cjs',                                  test: 'benchmarks/debug/tests/medium-pick.test.cjs' },
  { id: 'zip',               tier: 'medium',    stub: 'bin/bench-buggy-medium-zip.cjs',                                   test: 'benchmarks/debug/tests/medium-zip.test.cjs' },
  { id: 'intersection',      tier: 'medium',    stub: 'bin/bench-buggy-medium-intersection.cjs',                          test: 'benchmarks/debug/tests/medium-intersection.test.cjs' },
  { id: 'difference',        tier: 'medium',    stub: 'bin/bench-buggy-medium-difference.cjs',                            test: 'benchmarks/debug/tests/medium-difference.test.cjs' },
  { id: 'curry',             tier: 'medium',    stub: 'bin/bench-buggy-medium-curry.cjs',                                 test: 'benchmarks/debug/tests/medium-curry.test.cjs' },
  { id: 'partition',         tier: 'medium',    stub: 'bin/bench-buggy-medium-partition.cjs',                             test: 'benchmarks/debug/tests/medium-partition.test.cjs' },
  { id: 'map-values',        tier: 'medium',    stub: 'bin/bench-buggy-medium-map-values.cjs',                            test: 'benchmarks/debug/tests/medium-map-values.test.cjs' },
  { id: 'throttle',          tier: 'medium',    stub: 'bin/bench-buggy-medium-throttle.cjs',                              test: 'benchmarks/debug/tests/medium-throttle.test.cjs' },
  { id: 'unique-by',         tier: 'medium',    stub: 'bin/bench-buggy-medium-unique-by.cjs',                             test: 'benchmarks/debug/tests/medium-unique-by.test.cjs' },
  { id: 'compact-object',    tier: 'medium',    stub: 'bin/bench-buggy-medium-compact-object.cjs',                        test: 'benchmarks/debug/tests/medium-compact-object.test.cjs' },
  { id: 'insert-sorted',     tier: 'medium',    stub: 'bin/bench-buggy-medium-insert-sorted.cjs',                         test: 'benchmarks/debug/tests/medium-insert-sorted.test.cjs' },
  // ── hard (20) ─────────────────────────────────────────────────────────────
  { id: 'parser',            tier: 'hard',      stub: 'bin/bench-buggy-hard-parser.cjs',                                  test: 'benchmarks/debug/tests/parser.test.cjs' },
  { id: 'scheduler',         tier: 'hard',      stub: 'bin/bench-buggy-hard-scheduler.cjs',                               test: 'benchmarks/debug/tests/scheduler.test.cjs' },
  { id: 'lru-cache',         tier: 'hard',      stub: 'bin/bench-buggy-hard-lru-cache.cjs',                               test: 'benchmarks/debug/tests/hard-lru-cache.test.cjs' },
  { id: 'binary-search',     tier: 'hard',      stub: 'bin/bench-buggy-hard-binary-search.cjs',                           test: 'benchmarks/debug/tests/hard-binary-search.test.cjs' },
  { id: 'trie',              tier: 'hard',      stub: 'bin/bench-buggy-hard-trie.cjs',                                    test: 'benchmarks/debug/tests/hard-trie.test.cjs' },
  { id: 'bfs',               tier: 'hard',      stub: 'bin/bench-buggy-hard-bfs.cjs',                                     test: 'benchmarks/debug/tests/hard-bfs.test.cjs' },
  { id: 'topological-sort',  tier: 'hard',      stub: 'bin/bench-buggy-hard-topological-sort.cjs',                        test: 'benchmarks/debug/tests/hard-topological-sort.test.cjs' },
  { id: 'merge-sort',        tier: 'hard',      stub: 'bin/bench-buggy-hard-merge-sort.cjs',                              test: 'benchmarks/debug/tests/hard-merge-sort.test.cjs' },
  { id: 'edit-distance',     tier: 'hard',      stub: 'bin/bench-buggy-hard-edit-distance.cjs',                           test: 'benchmarks/debug/tests/hard-edit-distance.test.cjs' },
  { id: 'interval-merge',    tier: 'hard',      stub: 'bin/bench-buggy-hard-interval-merge.cjs',                          test: 'benchmarks/debug/tests/hard-interval-merge.test.cjs' },
  { id: 'min-heap',          tier: 'hard',      stub: 'bin/bench-buggy-hard-min-heap.cjs',                                test: 'benchmarks/debug/tests/hard-min-heap.test.cjs' },
  { id: 'sliding-window-max',tier: 'hard',      stub: 'bin/bench-buggy-hard-sliding-window-max.cjs',                      test: 'benchmarks/debug/tests/hard-sliding-window-max.test.cjs' },
  { id: 'kmp-search',        tier: 'hard',      stub: 'bin/bench-buggy-hard-kmp-search.cjs',                              test: 'benchmarks/debug/tests/hard-kmp-search.test.cjs' },
  { id: 'dijkstra',          tier: 'hard',      stub: 'bin/bench-buggy-hard-dijkstra.cjs',                                test: 'benchmarks/debug/tests/hard-dijkstra.test.cjs' },
  { id: 'union-find',        tier: 'hard',      stub: 'bin/bench-buggy-hard-union-find.cjs',                              test: 'benchmarks/debug/tests/hard-union-find.test.cjs' },
  { id: 'reservoir-sample',  tier: 'hard',      stub: 'bin/bench-buggy-hard-reservoir-sample.cjs',                        test: 'benchmarks/debug/tests/hard-reservoir-sample.test.cjs' },
  { id: 'consistent-hash',   tier: 'hard',      stub: 'bin/bench-buggy-hard-consistent-hash.cjs',                         test: 'benchmarks/debug/tests/hard-consistent-hash.test.cjs' },
  { id: 'segment-tree',      tier: 'hard',      stub: 'bin/bench-buggy-hard-segment-tree.cjs',                            test: 'benchmarks/debug/tests/hard-segment-tree.test.cjs' },
  { id: 'bloom-filter',      tier: 'hard',      stub: 'bin/bench-buggy-hard-bloom-filter.cjs',                            test: 'benchmarks/debug/tests/hard-bloom-filter.test.cjs' },
  { id: 'quick-select',      tier: 'hard',      stub: 'bin/bench-buggy-hard-quick-select.cjs',                            test: 'benchmarks/debug/tests/hard-quick-select.test.cjs' },
  // ── extreme (20) ──────────────────────────────────────────────────────────
  { id: 'lamport',                  tier: 'extreme',   stub: 'bin/bench-buggy-extreme-lamport.cjs',                       test: 'benchmarks/debug/tests/lamport.test.cjs' },
  { id: 'quorum',                   tier: 'extreme',   stub: 'bin/bench-buggy-extreme-quorum.cjs',                        test: 'benchmarks/debug/tests/quorum.test.cjs' },
  { id: 'vector-clock',             tier: 'extreme',   stub: 'bin/bench-buggy-extreme-vector-clock.cjs',                  test: 'benchmarks/debug/tests/vector-clock.test.cjs' },
  { id: 'monotonic-clock',          tier: 'extreme',   stub: 'bin/bench-buggy-extreme-monotonic-clock.cjs',               test: 'benchmarks/debug/tests/extreme-monotonic-clock.test.cjs' },
  { id: 'crdt-gcounter',            tier: 'extreme',   stub: 'bin/bench-buggy-extreme-crdt-gcounter.cjs',                 test: 'benchmarks/debug/tests/extreme-crdt-gcounter.test.cjs' },
  { id: 'snapshot-isolation',       tier: 'extreme',   stub: 'bin/bench-buggy-extreme-snapshot-isolation.cjs',            test: 'benchmarks/debug/tests/extreme-snapshot-isolation.test.cjs' },
  { id: 'distributed-lock-ttl',     tier: 'extreme',   stub: 'bin/bench-buggy-extreme-distributed-lock-ttl.cjs',          test: 'benchmarks/debug/tests/extreme-distributed-lock-ttl.test.cjs' },
  { id: 'paxos-promise',            tier: 'extreme',   stub: 'bin/bench-buggy-extreme-paxos-promise.cjs',                 test: 'benchmarks/debug/tests/extreme-paxos-promise.test.cjs' },
  { id: 'two-phase-locking',        tier: 'extreme',   stub: 'bin/bench-buggy-extreme-two-phase-locking.cjs',             test: 'benchmarks/debug/tests/extreme-two-phase-locking.test.cjs' },
  { id: 'read-your-writes',         tier: 'extreme',   stub: 'bin/bench-buggy-extreme-read-your-writes.cjs',              test: 'benchmarks/debug/tests/extreme-read-your-writes.test.cjs' },
  { id: 'monotonic-reads',          tier: 'extreme',   stub: 'bin/bench-buggy-extreme-monotonic-reads.cjs',               test: 'benchmarks/debug/tests/extreme-monotonic-reads.test.cjs' },
  { id: 'causal-broadcast',         tier: 'extreme',   stub: 'bin/bench-buggy-extreme-causal-broadcast.cjs',              test: 'benchmarks/debug/tests/extreme-causal-broadcast.test.cjs' },
  { id: 'fencing-token',            tier: 'extreme',   stub: 'bin/bench-buggy-extreme-fencing-token.cjs',                 test: 'benchmarks/debug/tests/extreme-fencing-token.test.cjs' },
  { id: 'raft-term',                tier: 'extreme',   stub: 'bin/bench-buggy-extreme-raft-term.cjs',                     test: 'benchmarks/debug/tests/extreme-raft-term.test.cjs' },
  { id: 'gossip-idempotency',       tier: 'extreme',   stub: 'bin/bench-buggy-extreme-gossip-idempotency.cjs',            test: 'benchmarks/debug/tests/extreme-gossip-idempotency.test.cjs' },
  { id: 'epoch-reclamation',        tier: 'extreme',   stub: 'bin/bench-buggy-extreme-epoch-reclamation.cjs',             test: 'benchmarks/debug/tests/extreme-epoch-reclamation.test.cjs' },
  { id: 'lease-validity',           tier: 'extreme',   stub: 'bin/bench-buggy-extreme-lease-validity.cjs',                test: 'benchmarks/debug/tests/extreme-lease-validity.test.cjs' },
  { id: 'write-skew',               tier: 'extreme',   stub: 'bin/bench-buggy-extreme-write-skew.cjs',                    test: 'benchmarks/debug/tests/extreme-write-skew.test.cjs' },
  { id: 'causal-consistency',       tier: 'extreme',   stub: 'bin/bench-buggy-extreme-causal-consistency.cjs',            test: 'benchmarks/debug/tests/extreme-causal-consistency.test.cjs' },
  { id: 'total-order-broadcast',    tier: 'extreme',   stub: 'bin/bench-buggy-extreme-total-order-broadcast.cjs',         test: 'benchmarks/debug/tests/extreme-total-order-broadcast.test.cjs' },
  // ── legendary (20) ────────────────────────────────────────────────────────
  { id: 'raft-commit-safety',                    tier: 'legendary', stub: 'bin/bench-buggy-legendary-raft-commit-safety.cjs',                    test: 'benchmarks/debug/tests/legendary-raft-commit-safety.test.cjs' },
  { id: 'paxos-chosen-value',                    tier: 'legendary', stub: 'bin/bench-buggy-legendary-paxos-chosen-value.cjs',                    test: 'benchmarks/debug/tests/legendary-paxos-chosen-value.test.cjs' },
  { id: 'two-pc-recovery',                       tier: 'legendary', stub: 'bin/bench-buggy-legendary-two-pc-recovery.cjs',                       test: 'benchmarks/debug/tests/legendary-two-pc-recovery.test.cjs' },
  { id: 'chandy-lamport-snapshot',               tier: 'legendary', stub: 'bin/bench-buggy-legendary-chandy-lamport-snapshot.cjs',               test: 'benchmarks/debug/tests/legendary-chandy-lamport-snapshot.test.cjs' },
  { id: 'bft-quorum-size',                       tier: 'legendary', stub: 'bin/bench-buggy-legendary-bft-quorum-size.cjs',                       test: 'benchmarks/debug/tests/legendary-bft-quorum-size.test.cjs' },
  { id: 'hlc-receive',                           tier: 'legendary', stub: 'bin/bench-buggy-legendary-hlc-receive.cjs',                           test: 'benchmarks/debug/tests/legendary-hlc-receive.test.cjs' },
  { id: 'viewstamped-replication-state-transfer',tier: 'legendary', stub: 'bin/bench-buggy-legendary-viewstamped-replication-state-transfer.cjs',test: 'benchmarks/debug/tests/legendary-viewstamped-replication-state-transfer.test.cjs' },
  { id: 'spanner-external-consistency',          tier: 'legendary', stub: 'bin/bench-buggy-legendary-spanner-external-consistency.cjs',          test: 'benchmarks/debug/tests/legendary-spanner-external-consistency.test.cjs' },
  { id: 'percolator-write-conflict',             tier: 'legendary', stub: 'bin/bench-buggy-legendary-percolator-write-conflict.cjs',             test: 'benchmarks/debug/tests/legendary-percolator-write-conflict.test.cjs' },
  { id: 'raft-read-index',                       tier: 'legendary', stub: 'bin/bench-buggy-legendary-raft-read-index.cjs',                       test: 'benchmarks/debug/tests/legendary-raft-read-index.test.cjs' },
  { id: 'pbft-prepare-view',                     tier: 'legendary', stub: 'bin/bench-buggy-legendary-pbft-prepare-view.cjs',                     test: 'benchmarks/debug/tests/legendary-pbft-prepare-view.test.cjs' },
  { id: 'ssi-conflict',                          tier: 'legendary', stub: 'bin/bench-buggy-legendary-ssi-conflict.cjs',                          test: 'benchmarks/debug/tests/legendary-ssi-conflict.test.cjs' },
  { id: 'chain-replication-ack',                 tier: 'legendary', stub: 'bin/bench-buggy-legendary-chain-replication-ack.cjs',                 test: 'benchmarks/debug/tests/legendary-chain-replication-ack.test.cjs' },
  { id: 'kafka-producer-epoch',                  tier: 'legendary', stub: 'bin/bench-buggy-legendary-kafka-producer-epoch.cjs',                  test: 'benchmarks/debug/tests/legendary-kafka-producer-epoch.test.cjs' },
  { id: 'distributed-snapshot-fifo',             tier: 'legendary', stub: 'bin/bench-buggy-legendary-distributed-snapshot-fifo.cjs',             test: 'benchmarks/debug/tests/legendary-distributed-snapshot-fifo.test.cjs' },
  { id: 'zab-epoch-order',                       tier: 'legendary', stub: 'bin/bench-buggy-legendary-zab-epoch-order.cjs',                       test: 'benchmarks/debug/tests/legendary-zab-epoch-order.test.cjs' },
  { id: 'raft-election-safety',                  tier: 'legendary', stub: 'bin/bench-buggy-legendary-raft-election-safety.cjs',                  test: 'benchmarks/debug/tests/legendary-raft-election-safety.test.cjs' },
  { id: 'mvcc-snapshot-read',                    tier: 'legendary', stub: 'bin/bench-buggy-legendary-mvcc-snapshot-read.cjs',                    test: 'benchmarks/debug/tests/legendary-mvcc-snapshot-read.test.cjs' },
  { id: 'linearizability-checker',               tier: 'legendary', stub: 'bin/bench-buggy-legendary-linearizability-checker.cjs',               test: 'benchmarks/debug/tests/legendary-linearizability-checker.test.cjs' },
  { id: 'consistent-cut-termination',            tier: 'legendary', stub: 'bin/bench-buggy-legendary-consistent-cut-termination.cjs',            test: 'benchmarks/debug/tests/legendary-consistent-cut-termination.test.cjs' },
];

if (dryRun) {
  if (jsonOutput) {
    const result = {
      score: 0,
      total: STUBS.length,
      fixed: 0,
      dry_run: true,
      by_tier: { easy: { total: 20, fixed: 0 }, medium: { total: 20, fixed: 0 }, hard: { total: 20, fixed: 0 }, extreme: { total: 20, fixed: 0 }, legendary: { total: 20, fixed: 0 } },
      stubs: STUBS.map(function(s) { return { id: s.id, tier: s.tier, fixed: false, stub: s.stub, test: s.test }; })
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write('nf:debug autonomy benchmark — DRY RUN\n');
    process.stdout.write('Stubs (' + STUBS.length + '):\n');
    STUBS.forEach(function(s) {
      process.stdout.write('  [' + s.tier.padEnd(6) + '] ' + s.id.padEnd(12) + '  stub: ' + s.stub + '\n');
      process.stdout.write('                       test: ' + s.test + '\n');
    });
    process.stdout.write('\nScore: 0/100 (dry run — no AI invoked)\n');
  }
  process.exit(0);
}

// Live run — invoke nf-debug-runner.cjs per stub with stub restoration guarantee
const results = [];
let fixedCount = 0;

STUBS.forEach(function(entry) {
  const absStubPath = path.join(ROOT, entry.stub);
  const absTestPath = path.join(ROOT, entry.test);

  // Save original stub source for restoration guarantee
  let originalSource = null;
  try {
    originalSource = fs.readFileSync(absStubPath, 'utf8');
  } catch (e) {
    process.stderr.write('[nf-benchmark-debug] WARNING: could not read stub ' + absStubPath + ': ' + e.message + '\n');
    results.push({ id: entry.id, tier: entry.tier, fixed: false, error: 'stub_not_found' });
    return;
  }

  let fixed = false;
  let errorCode = null;

  try {
    const runnerArgs = ['--stub', absStubPath, '--test', absTestPath];
    if (verbose) runnerArgs.push('--verbose');

    const runResult = spawnSync('node', [NF_DEBUG_RUNNER].concat(runnerArgs), {
      encoding: 'utf8',
      timeout: runnerTimeout,
      cwd: ROOT,
      maxBuffer: 4 * 1024 * 1024
    });

    if (runResult.signal === 'SIGTERM' || (runResult.error && runResult.error.code === 'ETIMEDOUT')) {
      errorCode = 'timeout';
      process.stderr.write('[nf-benchmark-debug] runner timed out for stub: ' + entry.id + '\n');
    } else if (runResult.status === 0) {
      fixed = true;
    } else {
      // Try to parse error from runner stdout
      try {
        const parsed = JSON.parse(runResult.stdout || '{}');
        // parsed.error is set for infrastructure failures (no_code_block, invalid_syntax, etc.)
        // No error field means fix was applied but test still failed — that's an AI failure
        errorCode = parsed.error || 'ai_failed';
      } catch (_) {
        errorCode = 'runner_failed';
      }
    }

    if (verbose && runResult.stderr) {
      process.stderr.write(runResult.stderr);
    }
  } catch (e) {
    errorCode = 'exception';
    process.stderr.write('[nf-benchmark-debug] exception for stub ' + entry.id + ': ' + e.message + '\n');
  } finally {
    // Always restore original stub source — idempotency guarantee
    try {
      fs.writeFileSync(absStubPath, originalSource, 'utf8');
    } catch (restoreErr) {
      process.stderr.write('[nf-benchmark-debug] WARNING: could not restore stub ' + absStubPath + ': ' + restoreErr.message + '\n');
    }
  }

  if (fixed) fixedCount++;
  results.push({ id: entry.id, tier: entry.tier, fixed, error: errorCode || null });
});

const score = Math.round((fixedCount / STUBS.length) * 100);

const byTier = {
  easy: { total: 0, fixed: 0 },
  medium: { total: 0, fixed: 0 },
  hard: { total: 0, fixed: 0 },
  extreme: { total: 0, fixed: 0 },
  legendary: { total: 0, fixed: 0 }
};
results.forEach(function(r) {
  if (byTier[r.tier]) {
    byTier[r.tier].total++;
    if (r.fixed) byTier[r.tier].fixed++;
  }
});

if (jsonOutput) {
  const out = {
    score,
    total: STUBS.length,
    fixed: fixedCount,
    by_tier: byTier,
    stubs: results
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
} else {
  process.stdout.write('\nnf:debug autonomy benchmark results\n');
  process.stdout.write('=====================================\n');
  process.stdout.write('ID           Tier     Fixed\n');
  process.stdout.write('------------ -------- -----\n');
  results.forEach(function(r) {
    const status = r.fixed ? 'PASS' : ('FAIL' + (r.error ? ' (' + r.error + ')' : ''));
    process.stdout.write((r.id).padEnd(13) + r.tier.padEnd(9) + status + '\n');
  });
  process.stdout.write('\nScore: ' + score + '/100 (' + fixedCount + '/' + STUBS.length + ' fixed)\n');
  process.stdout.write('By tier: easy=' + byTier.easy.fixed + '/' + byTier.easy.total +
    ' medium=' + byTier.medium.fixed + '/' + byTier.medium.total +
    ' hard=' + byTier.hard.fixed + '/' + byTier.hard.total +
    ' extreme=' + byTier.extreme.fixed + '/' + byTier.extreme.total +
    ' legendary=' + byTier.legendary.fixed + '/' + byTier.legendary.total + '\n');
}

process.exit(0);
