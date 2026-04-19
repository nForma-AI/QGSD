'use strict';
const { pick } = require('../../../bin/bench-buggy-medium-pick.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var result = pick({a:1, b:2}, ['a', 'c']);
assert('existing key', result.a, 1);
assert('missing key absent', ('c' in result), false);

process.exit(failed > 0 ? 1 : 0);
