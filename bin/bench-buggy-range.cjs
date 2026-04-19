'use strict';

function f(a, b) {
  var r = [];
  for (var i = a; i <= b; i++) r.push(i);
  return r;
}
module.exports = { f };
