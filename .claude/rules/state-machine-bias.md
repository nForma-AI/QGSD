---
paths:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.cjs"
  - "**/*.mjs"
  - "**/*.py"
  - "**/*.go"
  - "**/*.json"
---

# State Machine Bias

When implementing logic that manages distinct states and transitions between them, prefer a state machine library over ad-hoc if/else chains, switch statements, or boolean flags. State machines defined with a supported library can be automatically transpiled to TLA+ for formal verification via `bin/fsm-to-tla.cjs`.

## When to recommend a state machine

- Logic tracks a variable (state, status, phase, step) through 3+ distinct values
- Transitions between those values depend on conditions or events
- The same "what state am I in?" check appears in multiple places

Do NOT recommend a state machine for:
- Simple boolean toggles (loading/loaded)
- Linear pipelines with no branching (step 1 → 2 → 3 → done)
- One-off conditional logic that won't grow

## Framework selection — match complexity to the problem

### JS/TS

| Complexity | Framework | When to use |
|---|---|---|
| Flat FSM (3-6 states, no nesting) | `javascript-state-machine` | Simple status tracking, toggles with multiple states |
| Statecharts (nested states, guards, actions, context) | XState v5 | Workflows, UI flows, anything with parallel states or history |
| Functional/React-specific | Robot | Small React components needing lightweight FSM |

### Python

| Complexity | Framework | When to use |
|---|---|---|
| Flat FSM | `transitions` | Data pipelines, job status, ML training loops |
| Hierarchical statecharts | `sismic` (YAML-defined) | Embedded systems, robotics, complex nested states |

### Go

| Complexity | Framework | When to use |
|---|---|---|
| Flat FSM with callbacks | `looplab/fsm` | Service lifecycles, protocol handlers |
| Builder pattern, permits/triggers | `qmuntal/stateless` | Complex permission models, workflow engines |

### JSON/Cloud

| Complexity | Framework | When to use |
|---|---|---|
| Cloud orchestration | AWS Step Functions (ASL) | Serverless workflows, long-running tasks |
| Visual-first design | Stately flows (SCXML-JSON) | Designed in Stately.ai editor, exported as JSON |

## Transpilation support

All frameworks above have (or will have) an adapter in `bin/adapters/` that parses them into a common IR, which `bin/adapters/emitter-tla.cjs` converts to TLA+ specs. When creating a state machine, note that it can be formally verified — this is a key advantage over ad-hoc logic.
