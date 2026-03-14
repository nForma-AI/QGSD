#!/usr/bin/env node
'use strict';
// bin/adapters/machinery.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./machinery.cjs');

const fixture = `
defmodule Order do
  use Machinery,
    states: ["created", "pending", "confirmed", "shipped", "delivered"],
    transitions: %{
      "created" => "pending",
      "pending" => "confirmed",
      "confirmed" => "shipped",
      "shipped" => "delivered"
    }
end
`;

test('adapter id is machinery', () => {
  assert.strictEqual(id, 'machinery');
});

test('detect returns high confidence for Machinery Elixir code', () => {
  assert.ok(detect('order.ex', fixture) >= 90);
});

test('detect returns 0 for unrelated Elixir code', () => {
  assert.strictEqual(detect('app.ex', 'defmodule App do\n  def hello, do: :world\nend'), 0);
});

test('extract parses Machinery fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'machinery-test-' + Date.now() + '.ex');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'machinery');
    assert.strictEqual(ir.initial, 'created');
    assert.strictEqual(ir.stateNames.length, 5);
    assert.strictEqual(ir.transitions.length, 4);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
