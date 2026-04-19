'use strict';
const { canServeRead } = require('../../../bin/bench-buggy-legendary-raft-read-index.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// Stale leader: claims leadership but no heartbeat confirmation — must not serve reads
assert('requires heartbeat confirmation', canServeRead(true, 10, 10, false), false);
assert('confirmed leader can serve', canServeRead(true, 10, 10, true), true);
assert('not leader cannot serve', canServeRead(false, 10, 10, true), false);
assert('applied must reach readIndex', canServeRead(true, 9, 10, true), false);
assert('not leader + no heartbeat', canServeRead(false, 10, 10, false), false);
assert('applied ahead + confirmed', canServeRead(true, 15, 10, true), true);

process.exit(failed > 0 ? 1 : 0);
