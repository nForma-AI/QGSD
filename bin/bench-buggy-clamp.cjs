'use strict';

function f(a, b, c) {
  if (a < b) return c;
  if (a > c) return b;
  return a;
}
module.exports = { f };
