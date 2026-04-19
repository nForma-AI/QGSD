'use strict';

function buggyScheduler(tasks) {
  if (tasks.length === 0) return null;
  let minIdx = 0;
  for (let i = 1; i < tasks.length; i++) {
    if (tasks[i].priority > tasks[minIdx].priority) minIdx = i;  
  }
  return tasks[minIdx];
}
module.exports = { buggyScheduler };
