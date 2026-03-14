#!/usr/bin/env node
'use strict';
// bin/adapters/gen-statem.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./gen-statem.cjs');

const fixtureElixir = `
defmodule Door do
  use GenStateMachine

  def init(_) do
    {:ok, :locked, %{}}
  end

  def handle_event(:cast, :unlock, :locked, data) do
    {:next_state, :unlocked, data}
  end

  def handle_event(:cast, :lock, :unlocked, data) do
    {:next_state, :locked, data}
  end

  def handle_event(:cast, :open, :unlocked, data) do
    {:next_state, :opened, data}
  end
end
`;

const fixtureErlang = `
-module(turnstile).
-behaviour(gen_statem).

init([]) ->
    {ok, locked, #{}}.

handle_event(cast, coin, locked, Data) ->
    {next_state, unlocked, Data};

handle_event(cast, push, unlocked, Data) ->
    {next_state, locked, Data}.
`;

test('adapter id is gen-statem', () => {
  assert.strictEqual(id, 'gen-statem');
});

test('detect returns high confidence for gen_statem content', () => {
  assert.ok(detect('door.ex', fixtureElixir) >= 90);
  assert.ok(detect('turnstile.erl', fixtureErlang) >= 90);
});

test('detect returns 0 for unrelated content', () => {
  assert.strictEqual(detect('app.js', 'const x = 1;'), 0);
});

test('extract parses gen_statem fixture with correct counts', () => {
  const tmpFileEx = path.join(os.tmpdir(), 'gen-statem-ex-test-' + Date.now() + '.ex');
  fs.writeFileSync(tmpFileEx, fixtureElixir, 'utf8');
  try {
    const ir = extract(tmpFileEx);
    assert.strictEqual(ir.framework, 'gen-statem');
    assert.strictEqual(ir.initial, 'locked');
    assert.strictEqual(ir.stateNames.length, 3);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFileEx);
  }
});
