'use strict';
const { f } = require('../../../bin/bench-buggy-legendary-mvcc-snapshot-read.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var a = [{value:'v1',commitTs:1},{value:'v2',commitTs:3},{value:'v3',commitTs:5}];
assert('reads newest at snapshot=5', f(a, 5), 'v3');
assert('reads newest at snapshot=3', f(a, 3), 'v2');
assert('reads nothing before any commit', f(a, 0), null);
assert('reads v1 at snapshot=1', f(a, 1), 'v1');
assert('reads v2 at snapshot=4', f(a, 4), 'v2');
assert('reads v3 at snapshot=100', f(a, 100), 'v3');

process.exit(failed > 0 ? 1 : 0);
