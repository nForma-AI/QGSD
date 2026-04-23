'use strict';

function f(a, b) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] === b) return i - 1;
  }
  return -1;
}
module.exports = { f };
