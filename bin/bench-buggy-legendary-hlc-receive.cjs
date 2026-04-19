'use strict';
function hlcReceive(local, msg) {
  var lPrime = Math.max(local.l, msg.l);
  var cPrime;
  if (lPrime === local.l && lPrime === msg.l) {
    cPrime = Math.max(local.c, msg.c);  
  } else if (lPrime === local.l) {
    cPrime = local.c + 1;
  } else {
    cPrime = msg.c + 1;
  }
  return {l: lPrime, c: cPrime};
}
module.exports = { hlcReceive };
