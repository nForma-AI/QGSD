'use strict';
const { isPalindrome } = require('../../../bin/bench-buggy-is-palindrome.cjs');
let failed = 0;
function assert(label, cond, info) {
  if (!cond) { process.stderr.write('FAIL ' + label + (info ? ': ' + info : '') + '\n'); failed++; }
}
assert('racecar', isPalindrome('racecar') === true, 'got ' + isPalindrome('racecar'));
assert('abba', isPalindrome('abba') === true, 'got ' + isPalindrome('abba'));
assert('hello', isPalindrome('hello') === false, 'got ' + isPalindrome('hello'));
process.exit(failed > 0 ? 1 : 0);
