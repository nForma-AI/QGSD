#!/usr/bin/env node
'use strict';
// bin/adapters/django-fsm.test.cjs

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { id, detect, extract } = require('./django-fsm.cjs');

const fixture = `
from django_fsm import FSMField, transition

class Order(models.Model):
    state = FSMField(default='pending')

    @transition(field=state, source='pending', target='confirmed')
    def confirm(self):
        pass

    @transition(field=state, source='confirmed', target='shipped')
    def ship(self):
        pass

    @transition(field=state, source='shipped', target='delivered', conditions=['is_address_valid'])
    def deliver(self):
        pass
`;

test('adapter id is django-fsm', () => {
  assert.strictEqual(id, 'django-fsm');
});

test('detect returns high confidence for django-fsm code', () => {
  assert.ok(detect('models.py', fixture) >= 90);
});

test('detect returns 0 for unrelated Python code', () => {
  assert.strictEqual(detect('app.py', 'from flask import Flask'), 0);
});

test('extract parses django-fsm fixture', () => {
  const tmpFile = path.join(os.tmpdir(), 'django-fsm-test-' + Date.now() + '.py');
  fs.writeFileSync(tmpFile, fixture, 'utf8');
  try {
    const ir = extract(tmpFile);
    assert.strictEqual(ir.framework, 'django-fsm');
    assert.strictEqual(ir.initial, 'pending');
    assert.strictEqual(ir.stateNames.length, 4);
    assert.strictEqual(ir.transitions.length, 3);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});
