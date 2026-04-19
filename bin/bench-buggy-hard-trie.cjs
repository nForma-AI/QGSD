'use strict';

function Trie() {
  this.root = {};
}

Trie.prototype.insert = function(word) {
  var node = this.root;
  for (var i = 0; i < word.length; i++) {
    var c = word[i];
    if (!node[c]) node[c] = {};
    node[c].isEnd = true; 
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
