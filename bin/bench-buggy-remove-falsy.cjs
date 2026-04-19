'use strict';
// bin/bench-buggy-remove-falsy.cjs
// BUG: only removes exact false, not other falsy values (0, '', null, undefined, NaN)
// Fix: change x!==false to Boolean(x) (or just x)
function removeFalsy(arr) {
  return arr.filter(function(x) { return x !== false; });
}
module.exports = { removeFalsy };
