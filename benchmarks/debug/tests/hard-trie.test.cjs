'use strict';
const { f } = require('../../../bin/bench-buggy-hard-trie.cjs');
let failed = 0;
var _i = 0;
function assert(label, actual, expected) {
  _i++;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL t' + _i + '\n'); failed++; }
}

var t = new f();
t.insert('hello');
assert('full word found', t.search('hello'), true);
assert('prefix not found', t.search('hell'), false); // buggy: returns true
assert('nonexistent not found', t.search('world'), false);
assert('empty not found', t.search(''), false);

process.exit(failed > 0 ? 1 : 0);
