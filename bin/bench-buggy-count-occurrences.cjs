'use strict';

function f(a, b) {
  return a.filter(function(x) { return x == b; }).length;
}
module.exports = { f };
