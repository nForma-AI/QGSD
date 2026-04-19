'use strict';

function difference(a, b) {
  return b.filter(function(x) { return a.indexOf(x) === -1; }); // BUG: b.filter instead of a.filter
}

module.exports = { difference };
