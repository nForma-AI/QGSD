'use strict';

function f() {
  var current = 0;
  return {
    update: function(t) {
      current = Math.min(current, t); 
    },
    read: function() { return current; }
  };
}
module.exports = { f };
