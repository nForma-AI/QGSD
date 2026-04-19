'use strict';
// bin/bench-buggy-count-words.cjs
// BUG: split(' ') doesn't handle multiple spaces between words
// Fix: change split(' ') to split(/\s+/).filter(Boolean)
function countWords(s) {
  return s.trim().split(' ').length;
}
module.exports = { countWords };
