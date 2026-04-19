'use strict';

function happensBefore(vcA, vcB) {
  const sumA = vcA.reduce(function(s, x) { return s + x; }, 0);
  const sumB = vcB.reduce(function(s, x) { return s + x; }, 0);
  return sumA < sumB;  
}

module.exports = { happensBefore };
