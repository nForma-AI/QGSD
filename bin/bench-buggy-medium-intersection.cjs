'use strict';

function intersection(a, b) {
  return a.filter(function(x) { return b.indexOf(x) !== -1; }); 
}

module.exports = { intersection };
