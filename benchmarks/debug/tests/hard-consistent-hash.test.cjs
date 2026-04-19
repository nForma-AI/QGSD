'use strict';
const { consistentHash, simpleHash } = require('../../../bin/bench-buggy-hard-consistent-hash.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

// simpleHash('A') = 65, simpleHash('B') = 66, simpleHash('C') = 67
// simpleHash('~') = 126 (charCode 126)
// 126 > 67 → loop exhausts → buggy: returns null, correct: returns 'A' (ring[0], lowest hash)
var nodes = ['A', 'B', 'C'];
assert('high hash key wraps to first node', consistentHash(nodes, '~'), 'A');
assert('normal lookup works', consistentHash(nodes, 'A'), 'A'); // hash 65 >= 65 → 'A'
assert('key hashing between nodes', consistentHash(nodes, 'B'), 'B'); // hash 66 >= 66 → 'B'

// Verify the bug: a key with hash above all nodes should NOT return null
var result = consistentHash(nodes, '~');
assert('result is not null', result !== null, true);

process.exit(failed > 0 ? 1 : 0);
