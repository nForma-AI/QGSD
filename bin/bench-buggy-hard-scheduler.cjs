'use strict';
// bin/bench-buggy-hard-scheduler.cjs
// BUG: comparison is inverted — returns highest priority instead of lowest
// Fix: change tasks[i].priority > tasks[minIdx].priority to <
function buggyScheduler(tasks) {
  if (tasks.length === 0) return null;
  let minIdx = 0;
  for (let i = 1; i < tasks.length; i++) {
    if (tasks[i].priority > tasks[minIdx].priority) minIdx = i;  // BUG: > should be <
  }
  return tasks[minIdx];
}
module.exports = { buggyScheduler };
