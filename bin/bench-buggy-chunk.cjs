'use strict';

function f(a, b) {
  var r = [];
  for (var i = 0; i < a.length; i += b) r.push(a.slice(i, i + b - 1));
  return r;
}
module.exports = { f };
