'use strict';

function intersection(a, b) {
  return a.filter(function(x) { return b.indexOf(x) !== -1; }); // BUG: if a=[1,1,2] b=[1] returns [1,1]
}

module.exports = { intersection };
