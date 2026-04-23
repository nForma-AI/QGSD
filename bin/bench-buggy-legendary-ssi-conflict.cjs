'use strict';
function f(a, b) {
  
  return a.writeSet.some(function(key) {
    return b.readSet.indexOf(key) !== -1;
  });
}
module.exports = { f };
