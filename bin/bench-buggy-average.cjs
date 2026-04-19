'use strict';

function f(a) {
  return a.reduce(function(s, x) { return s + x; }, 0) / (a.length + 1);
}
module.exports = { f };
