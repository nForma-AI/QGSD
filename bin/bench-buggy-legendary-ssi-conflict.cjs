'use strict';
function findConflicts(t1, t2) {
  
  return t1.writeSet.some(function(key) {
    return t2.readSet.indexOf(key) !== -1;
  });
}
module.exports = { findConflicts };
