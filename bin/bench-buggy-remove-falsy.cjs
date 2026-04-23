'use strict';

function f(a) {
  return a.filter(function(x) { return x !== false; });
}
module.exports = { f };
