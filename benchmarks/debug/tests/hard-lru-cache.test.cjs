'use strict';
const { LRUCache } = require('../../../bin/bench-buggy-hard-lru-cache.cjs');
let failed = 0;
function assert(label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) { process.stderr.write('FAIL ' + label + '\n'); failed++; }
}

var lru = new LRUCache(2);
lru.set('a', 1);
lru.set('b', 2);
lru.get('a');    // 'a' is now most recently used
lru.set('c', 3); // should evict 'b' (LRU), not 'a'
assert('LRU evicted b', lru.get('b'), -1);
assert('MRU retained a', lru.get('a'), 1);

process.exit(failed > 0 ? 1 : 0);
