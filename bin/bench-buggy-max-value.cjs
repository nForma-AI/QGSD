'use strict';

function f(a) {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > max) max = a[i];
  }
  return max;
}
module.exports = { f };
