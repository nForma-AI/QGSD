'use strict';
const { pick } = require('../../../bin/bench-buggy-medium-pick.cjs');
let failed = 0;
function assert(label, got, expected) {
  if (got !== expected) { process.stderr.write('FAIL ' + label + ': got ' + JSON.stringify(got) + ', expected ' + JSON.stringify(expected) + '\n'); failed++; }
}

var result = pick({a:1, b:2}, ['a', 'c']);
assert('existing key', result.a, 1);
assert('missing key absent', ('c' in result), false);

process.exit(failed > 0 ? 1 : 0);
