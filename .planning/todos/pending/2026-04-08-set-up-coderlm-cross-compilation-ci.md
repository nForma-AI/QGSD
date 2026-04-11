---
created: 2026-04-08T06:37:27.249Z
title: Set up coderlm cross-compilation CI
area: tooling
files:
  - .github/workflows/ (coderlm repo)
  - bin/coderlm-adapter.cjs
  - docs/coderlm-integration.md
---

## Problem

coderlm is a Rust binary (symbol/call graph server) that nForma's solve pipeline uses for graph-driven wave scheduling. Currently it lives in a separate repo (github.com/nForma-AI/coderlm) with no prebuilt binaries published. Users must clone + cargo build manually, which means almost nobody uses it.

To ship coderlm as part of nForma (lazy download pattern), we need prebuilt platform binaries available on GitHub Releases. This is the prerequisite for Task B (lifecycle management).

## Solution

Create a GitHub Actions workflow in the nForma-AI/coderlm repo that:
- Cross-compiles Rust binary for 4 targets: darwin-arm64, darwin-x64, linux-x64, linux-arm64
- Uses `cross` or native GitHub Actions runners for each target
- Publishes platform-named binaries to GitHub Releases on tag push (e.g., `coderlm-darwin-arm64`)
- Includes SHA256 checksums for integrity verification during download
