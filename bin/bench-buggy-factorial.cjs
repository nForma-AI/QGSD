'use strict';

function factorial(n) {
  if (n === 0) return 0;
  return n * factorial(n - 1);
}
module.exports = { factorial };
