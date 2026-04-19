'use strict';

function f(a) {
  const seen = new Set();
  return a.filter(function(x) {
    const key = '' + x;  
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
module.exports = { f };
