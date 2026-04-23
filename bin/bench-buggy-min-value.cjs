'use strict';

function f(a) {
  var min = a[0];
  for (var i = 1; i < a.length; i++) {
    if (a[i] > min) min = a[i];
  }
  return min;
}
module.exports = { f };
