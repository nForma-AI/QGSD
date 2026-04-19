'use strict';
// bin/bench-buggy-clamp.cjs
// BUG: returns wrong bound (swapped — below min returns max, above max returns min)
// Fix: if(x<lo) return lo; if(x>hi) return hi;
function clamp(x, lo, hi) {
  if (x < lo) return hi;
  if (x > hi) return lo;
  return x;
}
module.exports = { clamp };
