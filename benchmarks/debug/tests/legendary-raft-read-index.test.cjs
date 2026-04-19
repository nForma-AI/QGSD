'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-raft-read-index.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Stale leader: claims leadership but no heartbeat confirmation — must not serve reads
assert('requires heartbeat confirmation', f(true, 10, 10, false), false);
assert('confirmed leader can serve', f(true, 10, 10, true), true);
assert('not leader cannot serve', f(false, 10, 10, true), false);
assert('applied must reach c', f(true, 9, 10, true), false);
assert('not leader + no heartbeat', f(false, 10, 10, false), false);
assert('applied ahead + confirmed', f(true, 15, 10, true), true);

process.exit(failed > 0 ? 1 : 0);
