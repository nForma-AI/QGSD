'use strict';
const { readMVCC } = require('../../../bin/bench-buggy-legendary-mvcc-snapshot-read.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var versions = [{value:'v1',commitTs:1},{value:'v2',commitTs:3},{value:'v3',commitTs:5}];
assert('reads newest at snapshot=5', readMVCC(versions, 5), 'v3');
assert('reads newest at snapshot=3', readMVCC(versions, 3), 'v2');
assert('reads nothing before any commit', readMVCC(versions, 0), null);
assert('reads v1 at snapshot=1', readMVCC(versions, 1), 'v1');
assert('reads v2 at snapshot=4', readMVCC(versions, 4), 'v2');
assert('reads v3 at snapshot=100', readMVCC(versions, 100), 'v3');

process.exit(failed > 0 ? 1 : 0);
