'use strict';
const { acceptPrepare } = require('../../../bin/bench-buggy-legendary-pbft-prepare-view.cjs');
let failed = 0;
function assert(label, actual, expected, info) {
  if (actual !== expected) {
    process.stderr.write('FAIL ' + label + ': expected=' + expected + ' actual=' + actual + (info ? ' ' + info : '') + '\n');
    failed++;
  }
}

// Message from wrong view must be rejected even if seqNum is valid
assert('wrong view rejected', acceptPrepare({view:1, seqNum:5, digest:'x'}, 2, 3), false);
assert('correct view accepted', acceptPrepare({view:2, seqNum:5, digest:'x'}, 2, 3), true);
assert('old seqNum rejected', acceptPrepare({view:2, seqNum:2, digest:'x'}, 2, 3), false);
assert('old view + old seq rejected', acceptPrepare({view:1, seqNum:2, digest:'x'}, 2, 3), false);
assert('equal seqNum rejected (must be strictly greater)', acceptPrepare({view:2, seqNum:3, digest:'x'}, 2, 3), false);

process.exit(failed > 0 ? 1 : 0);
