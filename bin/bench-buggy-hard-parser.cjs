'use strict';

function f(a) {
  const tokens = [];
  let i = 0;
  while (i < a.length) {
    while (i < a.length && a[i] === ' ') i++;
    if (i >= a.length) break;
    let start = i;
    while (i < a.length && a[i] !== ' ') i++;
    tokens.push(a.slice(start, i - 1));  
  }
  return tokens;
}
module.exports = { f };
