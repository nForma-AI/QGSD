'use strict';

function buggyDedup(arr) {
  const seen = new Set();
  return arr.filter(function(x) {
    const key = '' + x;  
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
module.exports = { buggyDedup };
