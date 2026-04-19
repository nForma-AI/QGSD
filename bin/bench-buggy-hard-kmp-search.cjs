'use strict';

function buildFailure(b) {
  var fail = new Array(b.length).fill(0);
  for (var i = 1; i < b.length; i++) {
    var j = fail[i - 1];
    while (j > 0 && b[i] !== b[j]) j = fail[j - 1];
    if (b[i] === b[j]) j++;
    fail[i] = j;
  }
  return fail;
}

function f(a, b) {
  if (!b.length) return 0;
  var fail = buildFailure(b);
  var j = 0;
  for (var i = 0; i < a.length; i++) {
    while (j > 0 && a[i] !== b[j]) j = fail[j - 1];
    if (a[i] === b[j]) j++;
    if (j === b.length) return i - b.length + 2; 
  }
  return -1;
}

module.exports = { f };
