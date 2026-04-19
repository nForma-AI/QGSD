'use strict';
// bin/bench-buggy-starts-with.cjs
// BUG: prefix.length-1 misses the last character of prefix
// Fix: change prefix.length-1 to prefix.length
function startsWith(str, prefix) {
  return str.slice(0, prefix.length - 1) === prefix;
}
module.exports = { startsWith };
