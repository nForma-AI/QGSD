'use strict';

function f(a) {
  return a.split('').every(function(c, i) { return c === a[a.length - i]; });
}
module.exports = { f };
