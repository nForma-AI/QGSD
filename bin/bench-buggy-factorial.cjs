'use strict';

function f(a) {
  if (a === 0) return 0;
  return a * f(a - 1);
}
module.exports = { f };
