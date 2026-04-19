'use strict';
// bin/bench-buggy-extreme-lamport.cjs
// Lamport logical clock — receive event handler
//
// The Lamport clock invariant:
//   If process A sends a message at time T_send, process B's receive event
//   must be assigned timestamp T_recv > T_send (strictly greater).
//
// BUG: on receive, uses Math.max(local, received) instead of Math.max(local, received) + 1
// The missing +1 violates causal ordering when local == received:
//   receive(3, 3) → max(3,3) = 3, but invariant requires > 3

function tick(clock) {
  return clock + 1;
}

function send(clock) {
  return tick(clock);
}

function receive(localClock, receivedTimestamp) {
  return Math.max(localClock, receivedTimestamp);  // BUG: missing + 1
}

module.exports = { tick, send, receive };
