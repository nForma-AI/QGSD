'use strict';
const fs = require('fs');
const path = require('path');

function benchHelper(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.cjs'));
}

function benchTransform(input) {
  return input.split('\n').map(line => line.trim()).filter(Boolean);
}

module.exports = { benchHelper, benchTransform };

if (require.main === module) {
  console.log(benchHelper(__dirname).join('\n'));
}