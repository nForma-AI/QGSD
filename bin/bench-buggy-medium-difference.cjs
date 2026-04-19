'use strict';

function difference(a, b) {
  return b.filter(function(x) { return a.indexOf(x) === -1; }); 
}

module.exports = { difference };
