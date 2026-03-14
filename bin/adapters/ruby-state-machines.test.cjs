#!/usr/bin/env node
'use strict';
// bin/adapters/ruby-state-machines.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./ruby-state-machines.cjs');

const detectFixture = `
class Vehicle
  state_machine :state do
    event :ignite do
      transition :parked => :idling
    end
    event :drive do
      transition :idling => :moving
    end
  end
end
`;

const extractFixture = `
class Vehicle
  state_machine :state, initial: :parked do
    state :parked
    state :idling
    state :moving

    event :ignite do
      transition :parked => :idling
    end

    event :drive do
      transition :idling => :moving
    end

    event :park do
      transition :idling => :parked
    end
  end
end
`;

test('adapter id is ruby-state-machines', () => {
  assert.strictEqual(id, 'ruby-state-machines');
});

test('detect returns high confidence for state_machines gem code', () => {
  assert.ok(detect('vehicle.rb', detectFixture) >= 90);
});

test('detect returns 0 for unrelated Ruby code', () => {
  assert.strictEqual(detect('app.rb', 'class Foo; def bar; end; end'), 0);
});

test('extract parses state_machines fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'ruby-sm-test-' + Date.now() + '.rb');
  fs.writeFileSync(tmpFile, extractFixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'ruby-state-machines');
    assert.strictEqual(ir.initial, 'parked');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
