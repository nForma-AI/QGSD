'use strict';

function LRUCache(capacity) {
  this.capacity = capacity;
  this.cache = new Map();
}

LRUCache.prototype.get = function(key) {
  if (!this.cache.has(key)) return -1;
  var val = this.cache.get(key);
  this.cache.delete(key);
  this.cache.set(key, val); 
  return val;
};

LRUCache.prototype.set = function(key, val) {
  if (this.cache.has(key)) this.cache.delete(key);
  if (this.cache.size >= this.capacity) {
    
    this.cache.delete(Array.from(this.cache.keys()).pop());
  }
  this.cache.set(key, val);
};

module.exports = { LRUCache };
