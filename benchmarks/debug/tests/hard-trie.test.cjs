'use strict';
const { Trie } = require('../../../bin/bench-buggy-hard-trie.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var t = new Trie();
t.insert('hello');
assert('full word found', t.search('hello'), true);
assert('prefix not found', t.search('hell'), false); // buggy: returns true
assert('nonexistent not found', t.search('world'), false);
assert('empty not found', t.search(''), false);

process.exit(failed > 0 ? 1 : 0);
