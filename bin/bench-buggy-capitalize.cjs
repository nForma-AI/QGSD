'use strict';
// bin/bench-buggy-capitalize.cjs
// BUG: slice(2) skips second character
// Fix: change s.slice(2) to s.slice(1)
function capitalize(s) {
  return s[0].toUpperCase() + s.slice(2);
}
module.exports = { capitalize };
