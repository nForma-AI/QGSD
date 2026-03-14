'use strict';
// bin/adapters/squirrel.cjs
// Squirrel Foundation (Java) adapter — regex-based extraction.

const fs   = require('fs');
const path = require('path');
const { validateIR } = require('./ir.cjs');

const id = 'squirrel';
const name = 'Squirrel Foundation (Java)';
const extensions = ['.java'];

function detect(filePath, content) {
  if (/import\s+org\.squirrelframework/.test(content) && /@Transit/.test(content)) return 90;
  if (/import\s+org\.squirrelframework/.test(content) && /StateMachineBuilder/.test(content)) return 85;
  if (/import\s+org\.squirrelframework/.test(content)) return 70;
  if (/@Transitions\s*\(/.test(content) && /@Transit\s*\(/.test(content)) return 60;
  return 0;
}

function extract(filePath, options = {}) {
  const absInput = path.resolve(filePath);
  if (!fs.existsSync(absInput)) throw new Error('File not found: ' + absInput);

  const content = fs.readFileSync(absInput, 'utf8');

  const stateSet = new Set();
  const transitions = [];
  let initial = '';

  // Extract initial state from builder: .newStateMachine(InitialState)
  const initMatch = content.match(/\.newStateMachine\s*\(\s*(?:\w+\.)?(\w+)\s*\)/);
  if (initMatch) initial = initMatch[1];

  // Extract @Transit annotations: @Transit(from="A", to="B", on="E", whenMvel="guard")
  const transitPattern = /@Transit\s*\(\s*([^)]+)\)/g;
  let tm;
  while ((tm = transitPattern.exec(content)) !== null) {
    const args = tm[1];

    const fromMatch = args.match(/from\s*=\s*["']?(\w+)["']?/);
    const toMatch = args.match(/to\s*=\s*["']?(\w+)["']?/);
    const onMatch = args.match(/on\s*=\s*["']?(\w+)["']?/);
    const guardMatch = args.match(/when(?:Mvel)?\s*=\s*["']([^"']+)["']/);

    const fromState = fromMatch ? fromMatch[1] : '';
    const target = toMatch ? toMatch[1] : null;
    const event = onMatch ? onMatch[1] : 'transition';
    const guard = guardMatch ? guardMatch[1] : null;

    if (fromState) stateSet.add(fromState);
    if (target) stateSet.add(target);

    if (fromState) {
      transitions.push({
        fromState,
        event,
        guard,
        target,
        assignedKeys: [],
      });
    }
  }

  // Extract builder-style: builder.externalTransition().from(A).to(B).on(E)
  const builderPattern = /\.from\s*\(\s*(?:\w+\.)?(\w+)\s*\)\s*\.to\s*\(\s*(?:\w+\.)?(\w+)\s*\)\s*\.on\s*\(\s*(?:\w+\.)?(\w+)\s*\)/g;
  let bm;
  while ((bm = builderPattern.exec(content)) !== null) {
    const fromState = bm[1];
    const target = bm[2];
    const event = bm[3];

    stateSet.add(fromState);
    stateSet.add(target);

    const exists = transitions.some(t =>
      t.fromState === fromState && t.event === event && t.target === target
    );
    if (!exists) {
      transitions.push({
        fromState,
        event,
        guard: null,
        target,
        assignedKeys: [],
      });
    }
  }

  if (initial) stateSet.add(initial);
  const stateNames = [...stateSet];

  // If no initial found via builder, use the first from-state
  if (!initial && stateNames.length > 0) {
    initial = stateNames[0];
  }

  const ir = {
    machineId: path.basename(filePath, '.java'),
    initial,
    stateNames,
    finalStates: [],
    transitions,
    ctxVars: [],
    ctxDefaults: {},
    sourceFile: path.relative(process.cwd(), absInput),
    framework: id,
  };

  const validation = validateIR(ir);
  if (!validation.valid) throw new Error('Squirrel Foundation IR validation failed: ' + validation.errors.join('; '));
  return ir;
}

module.exports = { id, name, extensions, detect, extract };
