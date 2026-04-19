'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-kafka-producer-epoch.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

assert('same epoch accepted (producer registered at this epoch)', f(5, 5), true);
assert('higher epoch accepted', f(6, 5), true);
assert('lower epoch rejected', f(4, 5), false);

// A just-registered producer (epoch == b) must be able to write
for (var e = 1; e <= 5; e++) {
  assert('producer can write at its own epoch (e='+e+')', f(e, e), true);
}

// Zero epoch
assert('epoch 0 accepted when registered=0', f(0, 0), true);

process.exit(failed > 0 ? 1 : 0);
