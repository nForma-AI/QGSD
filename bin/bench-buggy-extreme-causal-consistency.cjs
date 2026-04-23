'use strict';

function f(a, b) {
  return b.every(function(pair) {
    
    if (a.indexOf(pair.cause) !== -1) {
      return a.indexOf(pair.effect) !== -1;
    }
    return true;
  });
}
module.exports = { f };
