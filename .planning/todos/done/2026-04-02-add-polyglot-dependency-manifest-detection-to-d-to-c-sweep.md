---
created: 2026-04-02T19:05:21.734Z
title: Add polyglot dependency manifest detection to D→C sweep
area: tooling
files:
  - bin/nf-solve.cjs:sweepDtoC
---

## Problem

The D→C dependency scanner only checks `package.json` (Node.js) for claimed dependencies. When a doc mentions `python-dotenv` and the project uses `pyproject.toml`, the scanner flags it as missing even though the dependency IS in the manifest.

User report: nForma user's project had `python-dotenv` in `pyproject.toml` line 9, but the scanner flagged it as a broken dependency claim. Similarly, `nvidia-smi` (a system GPU tool) was flagged as a missing dependency when it's not a package at all.

## Solution

1. Detect project language from manifest files present in the repo root:
   - `pyproject.toml`, `requirements.txt`, `Pipfile`, `setup.py` → Python
   - `Cargo.toml` → Rust
   - `go.mod` → Go
   - `Gemfile` → Ruby
   - `package.json` → Node.js (already supported)

2. For each claimed dependency, check ALL detected manifests, not just `package.json`.

3. Maintain a small allowlist of system tools that are commonly mentioned in docs but aren't package dependencies: `nvidia-smi`, `docker`, `git`, `curl`, `wget`, `make`, `gcc`, etc. Auto-suppress these.
