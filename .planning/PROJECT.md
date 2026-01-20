# GSD Codebase Intelligence

## What This Is

A living codebase knowledge system for GSD that learns project structure and conventions as code is written, injecting accumulated understanding into every Claude session. Enables Claude to "just know" the codebase without manual documentation or stale snapshots.

## Core Value

Claude understands your codebase structure and conventions before it starts working — automatically.

## Current Milestone: v1.9.0 Codebase Intelligence System

**Goal:** Make GSD feel intelligent and automagical in how it navigates and understands both greenfield and brownfield projects.

**Target features:**
- Automatic codebase indexing via hooks (greenfield learns as you build)
- Deep analysis command for brownfield projects
- Session-start context injection with codebase awareness
- Convention detection and pattern learning

## Requirements

### Validated

- ✓ `/gsd:quick "description"` command executes end-to-end — v1.8.0
- ✓ Spawns gsd-planner (unchanged, just skips researcher/checker) — v1.8.0
- ✓ Spawns gsd-executor for each plan — v1.8.0
- ✓ Commits only files it edits/creates (not entire working dir) — v1.8.0
- ✓ Updates STATE.md with "Quick Tasks Completed" table — v1.8.0
- ✓ Updates STATE.md "Last activity" line — v1.8.0
- ✓ Errors if no ROADMAP.md exists — v1.8.0
- ✓ help.md updated with quick command — v1.8.0
- ✓ README.md updated with quick mode section — v1.8.0
- ✓ GSD-STYLE.md updated with quick mode patterns — v1.8.0

### Active

*Defined in REQUIREMENTS.md*

### Out of Scope

- `/gsd:resume-work` decimal phase handling — deferred from v1.8.0
- Semantic embeddings / vector search — future milestone
- Cross-project convention sharing — future milestone
- Framework auto-detection — future milestone

## Context

GSD's document ecosystem (PROJECT.md, ROADMAP.md, STATE.md, PLAN.md) tracks planning intent and execution outcomes. The Codebase Intelligence System adds a parallel code layer that tracks what actually exists in the codebase — files, exports, naming patterns, directory structure.

## Constraints

- **Zero API calls** for core functionality (local computation only)
- **Hook-based** integration using Claude Code's native infrastructure
- **Advisory only** — never block Claude's workflow
- **Lightweight** — minimal storage, fast operations

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| No planner changes | Quick mode is orchestrator-level, not agent-level | ✓ Good |
| No decimal phases | Quick tasks don't need ROADMAP integration | ✓ Good — simpler |
| Quick Tasks table in STATE.md | Better tracking than just Last activity | ✓ Good |
| Error if no ROADMAP | Maintains state integrity, no standalone mode | ✓ Good |

---
*Last updated: 2026-01-19 — starting v1.9.0 milestone*
