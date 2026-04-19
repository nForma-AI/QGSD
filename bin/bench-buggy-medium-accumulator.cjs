'use strict';

function buggyProduct(arr) {
  return arr.reduce(function(acc, x) { return acc + x; }, 1);
}
module.exports = { buggyProduct };
