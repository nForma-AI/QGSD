'use strict';
function f(a, b) {
  var lPrime = Math.max(a.l, b.l);
  var cPrime;
  if (lPrime === a.l && lPrime === b.l) {
    cPrime = Math.max(a.c, b.c);  
  } else if (lPrime === a.l) {
    cPrime = a.c + 1;
  } else {
    cPrime = b.c + 1;
  }
  return {l: lPrime, c: cPrime};
}
module.exports = { f };
