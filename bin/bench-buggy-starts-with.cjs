'use strict';

function f(a, b) {
  return a.slice(0, b.length - 1) === b;
}
module.exports = { f };
