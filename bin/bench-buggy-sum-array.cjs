'use strict';

function sumArray(arr) {
  return arr.reduce(function(s, x) { return s + x; }, 1);
}
module.exports = { sumArray };
