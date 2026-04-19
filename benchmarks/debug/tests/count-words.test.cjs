'use strict';
const { countWords } = require('../../../bin/bench-buggy-count-words.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('single spaces', countWords('hello world') === 2, 'got ' + countWords('hello world'));
assert('multiple spaces', countWords('hello  world  foo') === 3, 'got ' + countWords('hello  world  foo'));
assert('leading space', countWords('  hello') === 1, 'got ' + countWords('  hello'));
process.exit(failed > 0 ? 1 : 0);
