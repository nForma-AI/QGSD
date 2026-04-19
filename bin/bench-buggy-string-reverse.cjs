'use strict';

function reverseString(s) {
  return s.split('').reverse().slice(1).join('');
}
module.exports = { reverseString };
