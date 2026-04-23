'use strict';

function f() {
  var released = false;
  return {
    acquire: function() {
      if (!released) return true;
      return false;
    },
    release: function() {
      released = !released; 
      return true;
    },
    canAcquire: function() { return !released; }
  };
}
module.exports = { f };
