'use strict';
// BUG: return index uses `i - pattern.length + 2` instead of `i - pattern.length + 1`
// This returns a 1-based index offset by 1 instead of the correct 0-based index
// FIX: change `i - pattern.length + 2` to `i - pattern.length + 1`

function buildFailure(pattern) {
  var fail = new Array(pattern.length).fill(0);
  for (var i = 1; i < pattern.length; i++) {
    var j = fail[i - 1];
    while (j > 0 && pattern[i] !== pattern[j]) j = fail[j - 1];
    if (pattern[i] === pattern[j]) j++;
    fail[i] = j;
  }
  return fail;
}

function kmpSearch(text, pattern) {
  if (!pattern.length) return 0;
  var fail = buildFailure(pattern);
  var j = 0;
  for (var i = 0; i < text.length; i++) {
    while (j > 0 && text[i] !== pattern[j]) j = fail[j - 1];
    if (text[i] === pattern[j]) j++;
    if (j === pattern.length) return i - pattern.length + 2; // BUG: +2 instead of +1
  }
  return -1;
}

module.exports = { kmpSearch };
