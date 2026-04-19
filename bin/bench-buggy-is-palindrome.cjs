'use strict';
// bin/bench-buggy-is-palindrome.cjs
// BUG: s[s.length-0] = s[s.length] = undefined, always returns false for non-empty strings
// Fix: change s[s.length-i] to s[s.length-1-i]
function isPalindrome(s) {
  return s.split('').every(function(c, i) { return c === s[s.length - i]; });
}
module.exports = { isPalindrome };
