'use strict';
function f(a, b) {
  return a.filter(function(entry) {
    return entry.opNum < b;  
  });
}
module.exports = { f };
