'use strict';
const { shouldAcceptWrite } = require('../../../bin/bench-buggy-legendary-kafka-producer-epoch.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

assert('same epoch accepted (producer registered at this epoch)', shouldAcceptWrite(5, 5), true);
assert('higher epoch accepted', shouldAcceptWrite(6, 5), true);
assert('lower epoch rejected', shouldAcceptWrite(4, 5), false);

// A just-registered producer (epoch == registeredEpoch) must be able to write
for (var e = 1; e <= 5; e++) {
  assert('producer can write at its own epoch (e='+e+')', shouldAcceptWrite(e, e), true);
}

// Zero epoch
assert('epoch 0 accepted when registered=0', shouldAcceptWrite(0, 0), true);

process.exit(failed > 0 ? 1 : 0);
