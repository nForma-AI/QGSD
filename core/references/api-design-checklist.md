# API and Interface Design Checklist

Use this checklist when designing or modifying APIs, module interfaces, component props, CLI interfaces, or any public contract where one piece of code talks to another.

## Core principles

1. **Contract first** — define the interface before implementing it. Types and schemas are the spec.
2. **Consistent error semantics** — one error format everywhere. Never mix error shapes across endpoints.
3. **Validate at boundaries** — trust internal code; validate at system edges (API handlers, form submissions, external service responses). Do not validate between internal functions that share type contracts.
4. **Prefer addition over modification** — extend by adding optional fields. Never remove or change types without a migration plan.
5. **Predictable naming** — plural nouns for REST resources, camelCase for fields, UPPER_SNAKE for enums, is/has/can for booleans.

## Design checklist

- [ ] Every endpoint has typed input and output schemas
- [ ] Error responses follow a single consistent format
- [ ] Validation happens at system boundaries only
- [ ] List endpoints support pagination
- [ ] New fields are additive and optional (backward compatible)
- [ ] Naming follows consistent conventions across all endpoints
- [ ] API types are committed alongside the implementation

## Recommended patterns

- **Discriminated unions** for variant types (status with different associated data)
- **Input/output separation** — creation input types differ from returned resource types
- **Branded types** for IDs to prevent mixing different ID domains

## Red flags

- Endpoints returning different shapes depending on conditions
- Validation scattered through internal code instead of at boundaries
- Breaking changes to existing fields (type changes, removals)
- List endpoints without pagination
- Verbs in REST URLs (`/api/createTask` instead of `POST /api/tasks`)
- Unvalidated third-party API responses used directly

## Attribution

Adapted for nForma from the MIT-licensed `api-and-interface-design` skill in [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills).
