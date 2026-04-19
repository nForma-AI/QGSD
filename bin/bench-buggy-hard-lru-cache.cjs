'use strict';

function f(a) {
  this.a = a;
  this.cache = new Map();
}

f.prototype.get = function(key) {
  if (!this.cache.has(key)) return -1;
  var val = this.cache.get(key);
  this.cache.delete(key);
  this.cache.set(key, val); 
  return val;
};

f.prototype.set = function(key, val) {
  if (this.cache.has(key)) this.cache.delete(key);
  if (this.cache.size >= this.a) {
    
    this.cache.delete(Array.from(this.cache.keys()).pop());
  }
  this.cache.set(key, val);
};

module.exports = { f };
