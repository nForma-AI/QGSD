'use strict';
// bin/bench-buggy-hard-parser.cjs
// BUG: token end index is exclusive but code subtracts 1, dropping last char of each token
// Fix: remove the -1 from slice end: str.slice(start, end)
function buggyTokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    while (i < str.length && str[i] === ' ') i++;
    if (i >= str.length) break;
    let start = i;
    while (i < str.length && str[i] !== ' ') i++;
    tokens.push(str.slice(start, i - 1));  // BUG: -1 drops last char
  }
  return tokens;
}
module.exports = { buggyTokenize };
