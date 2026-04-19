'use strict';
const { shouldAcceptProposal } = require('../../../bin/bench-buggy-legendary-zab-epoch-order.cjs');
let failed = 0;
function assert(label, actual, expected, info) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected=' + expected + ' actual=' + actual + (info ? ' ' + info : '') + '\n');
    failed++;
  }
}

// Same epoch must be rejected (old leader from epoch=5 cannot send to follower at epoch=5)
assert('same epoch proposal rejected', shouldAcceptProposal({epoch:5, zxid:100}, 5), false);
assert('newer epoch accepted', shouldAcceptProposal({epoch:6, zxid:1}, 5), true);
assert('older epoch rejected', shouldAcceptProposal({epoch:4, zxid:200}, 5), false);

// Enumerate all pairs
for (var pe = 0; pe <= 4; pe++) {
  for (var fe = 0; fe <= 4; fe++) {
    var expected = pe > fe;
    var actual = shouldAcceptProposal({epoch:pe,zxid:1}, fe);
    assert('epoch ordering pe='+pe+' fe='+fe, actual, expected);
  }
}

process.exit(failed > 0 ? 1 : 0);
