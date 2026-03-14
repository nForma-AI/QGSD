#!/usr/bin/env node
'use strict';
// bin/adapters/automatonymous.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./automatonymous.cjs');

const fixture = `
using MassTransit;

public class OrderStateMachine : MassTransitStateMachine<OrderState>
{
    public State Submitted { get; private set; }
    public State Accepted { get; private set; }
    public State Completed { get; private set; }

    public Event<OrderSubmitted> OrderSubmittedEvent { get; private set; }
    public Event<OrderAccepted> OrderAcceptedEvent { get; private set; }
    public Event<OrderCompleted> OrderCompletedEvent { get; private set; }

    public OrderStateMachine()
    {
        Event(() => OrderSubmittedEvent);
        Event(() => OrderAcceptedEvent);
        Event(() => OrderCompletedEvent);

        State(() => Submitted);
        State(() => Accepted);
        State(() => Completed);

        Initially(
            When(OrderSubmittedEvent)
                .TransitionTo(Submitted)
        );

        During(Submitted,
            When(OrderAcceptedEvent)
                .TransitionTo(Accepted)
        );

        During(Accepted,
            When(OrderCompletedEvent)
                .TransitionTo(Completed)
        );

        During(Completed,
            When(OrderCompletedEvent)
                .Finalize()
        );
    }
}
`;

test('adapter id is automatonymous', () => {
  assert.strictEqual(id, 'automatonymous');
});

test('detect returns high confidence for Automatonymous/MassTransit code', () => {
  assert.ok(detect('OrderStateMachine.cs', fixture) >= 90);
});

test('detect returns 0 for unrelated C# code', () => {
  assert.strictEqual(detect('Program.cs', 'using System.Linq;\nvar list = new List<int>();'), 0);
});

test('extract parses Automatonymous fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'automatonymous-test-' + Date.now() + '.cs');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'automatonymous');
    assert.strictEqual(ir.initial, 'Initial');
    assert.strictEqual(ir.stateNames.length, 5);
    assert.strictEqual(ir.transitions.length, 4);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
