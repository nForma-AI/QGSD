'use strict';

function f(a) {
  return a.reduce(function(acc, x) { return acc + x; }, 1);
}
module.exports = { f };
