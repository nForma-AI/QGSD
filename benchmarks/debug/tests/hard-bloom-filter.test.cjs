'use strict';
const { makeBloomFilter } = require('../../../bin/bench-buggy-hard-bloom-filter.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// add() sets bits using seeds 1,2,3 but has() checks seeds 0,1,2
// has() checks seed 0 first — never set by add() → always returns false for added items
var bf = makeBloomFilter(100, 3);
bf.add('hello');
bf.add('world');
assert('contains added item hello', bf.has('hello'), true); // buggy: false
assert('contains added item world', bf.has('world'), true); // buggy: false

var bf2 = makeBloomFilter(200, 1);
bf2.add('test');
assert('single hash: contains added item', bf2.has('test'), true); // buggy: false (checks seed 0, set seed 1)

process.exit(failed > 0 ? 1 : 0);
