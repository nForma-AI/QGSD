'use strict';
// bin/bench-buggy-medium-dedup.cjs
// BUG: uses seen.indexOf with loose equality path — actually uses a Set but
// initializes it from a stringified key, causing numeric strings "1" and 1
// to be treated as duplicates when they should not be (wrong toString coercion).
// Fix: use String(x) only for string inputs; use identity for numbers.
function buggyDedup(arr) {
  const seen = new Set();
  return arr.filter(function(x) {
    const key = '' + x;  // BUG: coerces 1 and "1" to same key
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
module.exports = { buggyDedup };
