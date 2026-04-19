'use strict';
var { canReclaim } = require('../../../bin/bench-buggy-extreme-epoch-reclamation.cjs');
var failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}

// Formal invariant: canReclaim(readers, E) iff every reader's epoch > E.

// Reader AT the reclaim epoch — must NOT reclaim (reader could still be accessing object)
assert('cannot reclaim when reader at same epoch [5] E=5', canReclaim([5], 5) === false,
  'canReclaim([5],5) returned true — use-after-free: reader at epoch 5 can still access E=5 objects');

assert('cannot reclaim when one reader at epoch [5,6] E=5', canReclaim([5, 6], 5) === false,
  'canReclaim([5,6],5) returned true — reader at epoch 5 still present');

// All readers strictly above epoch — can reclaim
assert('can reclaim when all readers past epoch [6,7] E=5', canReclaim([6, 7], 5) === true,
  'got false');

assert('can reclaim single reader past [6] E=5', canReclaim([6], 5) === true, 'got false');

// One reader still at or below epoch — cannot reclaim
assert('cannot reclaim when any reader behind [6,4] E=5', canReclaim([6, 4], 5) === false,
  'got true');

assert('cannot reclaim when reader at epoch [5,4] E=4', canReclaim([5, 4], 4) === false,
  'canReclaim([5,4],4) returned true — reader at epoch 4 still active');

// Enumerate: single reader at each epoch, reclaim each epoch
for (var readerEpoch = 0; readerEpoch <= 6; readerEpoch++) {
  for (var reclaimEpoch = 0; reclaimEpoch <= 6; reclaimEpoch++) {
    var expected = readerEpoch > reclaimEpoch;
    var got = canReclaim([readerEpoch], reclaimEpoch);
    assert(
      'canReclaim([' + readerEpoch + '],' + reclaimEpoch + ')',
      got === expected,
      'expected ' + expected + ' got ' + got
    );
  }
}

// Multiple readers: all must be strictly past reclaim epoch
assert('multiple readers all past [3,4,5] E=2', canReclaim([3, 4, 5], 2) === true, 'got false');
assert('multiple readers one at [3,2,5] E=2', canReclaim([3, 2, 5], 2) === false,
  'canReclaim([3,2,5],2) returned true — reader at epoch 2 still present');

process.exit(failed > 0 ? 1 : 0);
