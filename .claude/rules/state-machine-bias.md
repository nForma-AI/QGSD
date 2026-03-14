---
paths:
  - "**/*.ts"
  - "**/*.js"
  - "**/*.cjs"
  - "**/*.mjs"
  - "**/*.jsx"
  - "**/*.tsx"
  - "**/*.py"
  - "**/*.go"
  - "**/*.json"
  - "**/*.java"
  - "**/*.kt"
  - "**/*.kts"
  - "**/*.cs"
  - "**/*.rb"
  - "**/*.rs"
  - "**/*.ex"
  - "**/*.exs"
  - "**/*.erl"
  - "**/*.swift"
  - "**/*.yaml"
  - "**/*.yml"
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
| DSL string notation | `jssm` | Compact FSM definition via arrow syntax `'a -> b -> c'` |
| Statecharts (nested states, guards, actions, context) | XState v5 | Workflows, UI flows, anything with parallel states or history |
| XState legacy | XState v4 | Existing codebases not yet migrated to v5 |
| Functional/React-specific | Robot | Small React components needing lightweight FSM |
| React hook | `useStateMachine` | Minimal React hook, smallest bundle size |
| Event-driven hierarchical | Machina.js | Complex event-driven JS applications with hierarchical states |

### Python

| Complexity | Framework | When to use |
|---|---|---|
| Flat FSM | `transitions` | Data pipelines, job status, ML training loops |
| Django models | `django-fsm` | Django model lifecycle (order status, user state) |
| Declarative class-based | `python-statemachine` | Clean class-based FSM with dot notation transitions |
| Hierarchical statecharts | `sismic` (YAML-defined) | Embedded systems, robotics, complex nested states |

### Go

| Complexity | Framework | When to use |
|---|---|---|
| Flat FSM with callbacks | `looplab/fsm` | Service lifecycles, protocol handlers |
| Builder pattern, permits/triggers | `qmuntal/stateless` | Complex permission models, workflow engines |

### Java/Kotlin

| Complexity | Framework | When to use |
|---|---|---|
| Enterprise/Spring ecosystem | Spring Statemachine | Spring Boot services, complex workflow orchestration |
| Annotation-driven | Squirrel Foundation | Annotation-based FSM with builder pattern |
| Lightweight .NET port | stateless4j | Simple permit/trigger model, minimal dependencies |
| Kotlin DSL with coroutines | kstatemachine | Kotlin-native with coroutine support, type-safe DSL |

### C#/.NET

| Complexity | Framework | When to use |
|---|---|---|
| General purpose | Stateless (.NET) | Most C# applications, builder pattern with permits |
| Saga state machines | Automatonymous (MassTransit) | Distributed sagas, event-driven microservices |

### Ruby

| Complexity | Framework | When to use |
|---|---|---|
| Rails models | AASM | ActiveRecord/Mongoid model lifecycles, most popular Ruby FSM |
| ActiveRecord integration | state_machines | Alternative to AASM with deep AR integration |

### Rust

| Complexity | Framework | When to use |
|---|---|---|
| Macro-based flat FSM | rust-fsm | Compile-time checked FSM via `state_machine!` macro |
| Hierarchical/embedded | statig | Hierarchical state machines, embedded/robotics |

### Elixir/Erlang

| Complexity | Framework | When to use |
|---|---|---|
| OTP behavior (gold standard) | gen_statem | Production OTP applications, the canonical FSM approach |
| Ecto-integrated | Machinery | Ecto model lifecycles, Phoenix applications |

### Swift

| Complexity | Framework | When to use |
|---|---|---|
| iOS/macOS apps | SwiftState | iOS app state, game state, UI flow management |

### JSON/Cloud

| Complexity | Framework | When to use |
|---|---|---|
| Cloud orchestration | AWS Step Functions (ASL) | Serverless workflows, long-running tasks |
| Visual-first design | Stately flows (SCXML-JSON) | Designed in Stately.ai editor, exported as JSON |

## Transpilation support

All 28 frameworks above have an adapter in `bin/adapters/` that parses them into a common IR, which `bin/adapters/emitter-tla.cjs` converts to TLA+ specs. When creating a state machine, note that it can be formally verified — this is a key advantage over ad-hoc logic.

Supported languages: JavaScript, TypeScript, Python, Go, Java, Kotlin, C#, Ruby, Rust, Erlang, Elixir, Swift, JSON/YAML.
