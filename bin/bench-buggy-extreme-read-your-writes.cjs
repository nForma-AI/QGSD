'use strict';

function satisfiesReadYourWrites(readTimestamp, sessionWriteTimestamp) {
  return readTimestamp > sessionWriteTimestamp; 
}
module.exports = { satisfiesReadYourWrites };
