'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-zab-epoch-order.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

// Same epoch must be rejected (old leader from epoch=5 cannot send to follower at epoch=5)
assert('same epoch a rejected', f({epoch:5, zxid:100}, 5), false);
assert('newer epoch accepted', f({epoch:6, zxid:1}, 5), true);
assert('older epoch rejected', f({epoch:4, zxid:200}, 5), false);

// Enumerate all pairs
for (var pe = 0; pe <= 4; pe++) {
  for (var fe = 0; fe <= 4; fe++) {
    var expected = pe > fe;
    var actual = f({epoch:pe,zxid:1}, fe);
    assert('epoch ordering pe='+pe+' fe='+fe, actual, expected);
  }
}

process.exit(failed > 0 ? 1 : 0);
