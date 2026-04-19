'use strict';
// bin/bench-buggy-factorial.cjs
// BUG: base case returns 0 instead of 1, making all factorials 0
// Fix: change return 0 to return 1
function factorial(n) {
  if (n === 0) return 0;
  return n * factorial(n - 1);
}
module.exports = { factorial };
