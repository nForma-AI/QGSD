// Traffic light using javascript-state-machine
module.exports = {
  init: "green",
  transitions: [
    { name: "slow", from: "green", to: "yellow" },
    { name: "stop", from: "yellow", to: "red" },
    { name: "go", from: "red", to: "green" },
    { name: "panic", from: ["green", "yellow", "red"], to: "flashing" },
    { name: "calm", from: "flashing", to: "red" },
  ],
};
