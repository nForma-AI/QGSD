'use strict';
function f(a, b, c) {
  if (a.isTail) c(b.id);  
  a.storage[b.key] = b.value;
}
module.exports = { f };
