'use strict';
// bin/bench-buggy-string-reverse.cjs
// BUG: slice(1) drops the first character of the reversed string
// Fix: remove .slice(1) so reversed array is fully joined
function reverseString(s) {
  return s.split('').reverse().slice(1).join('');
}
module.exports = { reverseString };
