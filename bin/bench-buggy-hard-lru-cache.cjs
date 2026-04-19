'use strict';
// BUG: eviction removes the most recently used instead of least recently used
// FIX: change Array.from(this.cache.keys()).pop() to Array.from(this.cache.keys())[0]

function LRUCache(capacity) {
  this.capacity = capacity;
  this.cache = new Map();
}

LRUCache.prototype.get = function(key) {
  if (!this.cache.has(key)) return -1;
  var val = this.cache.get(key);
  this.cache.delete(key);
  this.cache.set(key, val); // move to end (most recent)
  return val;
};

LRUCache.prototype.set = function(key, val) {
  if (this.cache.has(key)) this.cache.delete(key);
  if (this.cache.size >= this.capacity) {
    // BUG: deletes the LAST entry (most recently used) instead of first (least recently used)
    this.cache.delete(Array.from(this.cache.keys()).pop());
  }
  this.cache.set(key, val);
};

module.exports = { LRUCache };
