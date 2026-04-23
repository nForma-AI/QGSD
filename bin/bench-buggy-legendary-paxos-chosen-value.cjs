'use strict';
function f(a, b) {
  var withValues = a.filter(function(r){return r.value !== null;});
  if (!withValues.length) return b;
  withValues.sort(function(a,b){return a.ballot - b.ballot;});
  return withValues[0].value;  
}
module.exports = { f };
