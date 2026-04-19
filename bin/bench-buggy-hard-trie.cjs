'use strict';
// BUG: marks every intermediate node as end-of-word during insert
// This makes every prefix match as a valid word
// FIX: move `node[c].isEnd = true` to after the loop, applied only to the last node

function Trie() {
  this.root = {};
}

Trie.prototype.insert = function(word) {
  var node = this.root;
  for (var i = 0; i < word.length; i++) {
    var c = word[i];
    if (!node[c]) node[c] = {};
    node[c].isEnd = true; // BUG: marks every node as end, should only mark last
    node = node[c];
  }
};

Trie.prototype.search = function(word) {
  var node = this.root;
  for (var i = 0; i < word.length; i++) {
    if (!node[word[i]]) return false;
    node = node[word[i]];
  }
  return node.isEnd === true;
};

module.exports = { Trie };
