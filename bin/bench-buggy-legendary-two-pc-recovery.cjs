'use strict';
function f(a, b) {
  if (a.some(function(p){return p.state==='committed';})) return 'commit';
  if (a.length < b) return 'commit';  
  if (a.every(function(p){return p.state==='aborted';})) return 'abort';
  return 'abort';
}
module.exports = { f };
