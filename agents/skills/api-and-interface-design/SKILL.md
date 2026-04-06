---
name: nf:api-and-interface-design
description: Guides stable API and interface design — contract-first, consistent errors, boundary validation, and backward-compatible evolution.
---

# api-and-interface-design skill

Purpose
-------
Design stable, well-documented interfaces that are hard to misuse. Applies to REST APIs, GraphQL schemas, module boundaries, component props, CLI interfaces, and any surface where one piece of code talks to another.

When to use
-----------
- Designing new API endpoints or module interfaces
- Defining contracts between teams or services
- Creating component prop interfaces
- Changing existing public interfaces
- When the user asks about API design, interface contracts, or schema design

Core principles
---------------
1) **Contract first** — define the interface before implementing it. Types and schemas are the spec; implementation follows.

2) **Consistent error semantics** — pick one error format and use it everywhere. Never mix error shapes across endpoints.

3) **Validate at boundaries** — trust internal code; validate at system edges where external input enters (API handlers, form submissions, external service responses, environment variables). Do not validate between internal functions that share type contracts.

4) **Prefer addition over modification** — extend interfaces by adding optional fields. Never remove or change the type of existing fields without a migration plan.

5) **Predictable naming** — use plural nouns for REST resources, camelCase for fields, UPPER_SNAKE for enums, is/has/can prefixes for booleans.

Design checklist
----------------
- [ ] Every endpoint has typed input and output schemas
- [ ] Error responses follow a single consistent format
- [ ] Validation happens at system boundaries only
- [ ] List endpoints support pagination
- [ ] New fields are additive and optional (backward compatible)
- [ ] Naming follows consistent conventions
- [ ] API types are committed alongside the implementation

Patterns
--------
- **Discriminated unions** for variant types (status with different associated data)
- **Input/output separation** — creation input types differ from returned resource types
- **Branded types** for IDs to prevent mixing different ID domains

Anti-patterns to avoid
----------------------
- Endpoints that return different shapes depending on conditions
- Validation scattered throughout internal code instead of at boundaries
- Breaking changes to existing fields (type changes, removals)
- List endpoints without pagination
- Verbs in REST URLs (`/api/createTask` instead of `POST /api/tasks`)
- Using unvalidated third-party API responses directly

Integration with nForma
------------------------
- After designing an API, use `nf:code-review-and-quality` for review
- For security of exposed interfaces, use `nf:security-and-hardening`
- Reference `references/security-checklist.md` for input validation guidance

Licensing / attribution
-----------------------
Adapted for nForma from the MIT-licensed `api-and-interface-design` skill in `addyosmani/agent-skills`.
