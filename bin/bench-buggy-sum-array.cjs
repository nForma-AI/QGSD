'use strict';

function f(a) {
  return a.reduce(function(s, x) { return s + x; }, 1);
}
module.exports = { f };
