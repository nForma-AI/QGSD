'use strict';

function f(a) {
  if (a.length === 0) return true;
  var first = a[0].slice().sort().join(','); 
  return a.every(function(log) {
    return log.slice().sort().join(',') === first;    
  });
}
module.exports = { f };
