'use strict';
// bin/bench-buggy-medium-accumulator.cjs
// BUG: uses + (addition) instead of * (multiplication) for running product
// Fix: change + to *
function buggyProduct(arr) {
  return arr.reduce(function(acc, x) { return acc + x; }, 1);
}
module.exports = { buggyProduct };
