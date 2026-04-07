---
created: 2026-04-06T12:00:00.000Z
title: Add security-and-hardening skill or reference pack
area: security
files:
  - agents/skills/
  - docs/
  - CONTRIBUTING.md
  - .github/pull_request_template.md
---

## Problem

nForma has security scans and security-oriented scripts, but no portable packaged skill or checklist that contributors can use to apply security review discipline consistently during normal feature work.

The current gap is not tooling. It is workflow packaging.

## Solution

Adapt the upstream `security-and-hardening` material into either:

- a packaged skill under `agents/skills/security-and-hardening/`, or
- a smaller reference/checklist pack if that fits nForma better

The implementation should:

- reuse existing secret-scan and security-sweep capabilities
- avoid duplicating generic AppSec guidance already handled elsewhere
- define the minimum security checks expected before merge or launch
