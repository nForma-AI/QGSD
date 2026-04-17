#!/usr/bin/env bash
# scripts/update-benchmark-baseline.sh
# Advances the solve benchmark baseline to a new pass_rate floor.
# Run this after a successful release to lock in the new high score.
#
# Usage:
#   bash scripts/update-benchmark-baseline.sh <pass_rate>
#   bash scripts/update-benchmark-baseline.sh          # auto: runs benchmark and uses result

set -euo pipefail

BASELINE_FILE="$(dirname "$0")/../benchmarks/solve-baseline.json"

if [ $# -ge 1 ]; then
  NEW_RATE="$1"
else
  echo "Running solve smoke benchmark to get current score..."
  BENCH_OUT=$(node bin/nf-benchmark-solve.cjs --json --track=smoke)
  NEW_RATE=$(echo "$BENCH_OUT" | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).pass_rate))")
  echo "Measured pass_rate: ${NEW_RATE}%"
fi

TODAY=$(date +%Y-%m-%d)

node -e "
const fs = require('fs');
const b = JSON.parse(fs.readFileSync('${BASELINE_FILE}', 'utf8'));
const prev = b.pass_rate;
b.pass_rate = Number('${NEW_RATE}');
b.updated_at = '${TODAY}';
fs.writeFileSync('${BASELINE_FILE}', JSON.stringify(b, null, 2) + '\n');
console.log('Updated baseline: ' + prev + '% -> ' + b.pass_rate + '%  (' + b.updated_at + ')');
"
