'use strict';

function isPalindrome(s) {
  return s.split('').every(function(c, i) { return c === s[s.length - i]; });
}
module.exports = { isPalindrome };
