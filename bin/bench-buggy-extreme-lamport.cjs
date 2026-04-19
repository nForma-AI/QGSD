'use strict';

function tick(clock) {
  return clock + 1;
}

function send(clock) {
  return tick(clock);
}

function receive(localClock, receivedTimestamp) {
  return Math.max(localClock, receivedTimestamp);  
}

module.exports = { tick, send, receive };
