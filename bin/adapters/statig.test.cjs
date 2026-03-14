#!/usr/bin/env node
'use strict';
// bin/adapters/statig.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./statig.cjs');

const fixture = `
use statig::prelude::*;

enum State {
    Idle,
    Running,
    Paused,
    Done
}

#[state_machine(initial = "State::Idle")]
impl Machine {
    #[transition(from = "Idle", to = "Running", event = "start")]
    fn on_start(&self) {}

    #[transition(from = "Running", to = "Paused", event = "pause")]
    fn on_pause(&self) {}

    #[transition(from = "Paused", to = "Running", event = "resume")]
    fn on_resume(&self) {}

    #[transition(from = "Running", to = "Done", event = "finish")]
    fn on_finish(&self) {}
}
`;

test('adapter id is statig', () => {
  assert.strictEqual(id, 'statig');
});

test('detect returns high confidence for statig code', () => {
  assert.ok(detect('machine.rs', fixture) >= 90);
});

test('detect returns 0 for unrelated Rust code', () => {
  assert.strictEqual(detect('main.rs', 'use std::io;\nfn main() {}'), 0);
});

test('extract parses statig fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'statig-test-' + Date.now() + '.rs');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'statig');
    assert.strictEqual(ir.initial, 'Idle');
    assert.strictEqual(ir.stateNames.length, 4);
    assert.strictEqual(ir.transitions.length, 4);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
