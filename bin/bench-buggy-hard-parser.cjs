'use strict';

function buggyTokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    while (i < str.length && str[i] === ' ') i++;
    if (i >= str.length) break;
    let start = i;
    while (i < str.length && str[i] !== ' ') i++;
    tokens.push(str.slice(start, i - 1));  
  }
  return tokens;
}
module.exports = { buggyTokenize };
