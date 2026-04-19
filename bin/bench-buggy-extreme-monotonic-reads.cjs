'use strict';

function isValidRead(prevReadTs, newReadTs) {
  return newReadTs > 0; 
}
module.exports = { isValidRead };
