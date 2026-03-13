# Quorum Debate
Question: Is there a chance that our install.js might conflict with the GSD plugin?
Date: 2026-03-12
Consensus: APPROVE
Rounds: 1

## Round 1
| Model | Position | Citations |
|---|---|---|
| Claude (ADVISORY) | YES — cleanup logic targets gsd-* prefix without distinguishing nForma orphans from legitimate GSD plugin artifacts | bin/install.js:1025-1049, bin/install.js:1055-1113, bin/install.js:1102-1111, bin/install.js:1214-1220 |
| codex-1 (primary) | UNAVAIL | — |
| copilot-1 (T1 fallback) | YES — significant conflict. HIGH risk on hook file deletion and hook registration stripping. No safeguards or ownership tracking. | bin/install.js:1025-1051, bin/install.js:1055-1104, bin/install.js:1097-1104, bin/install.js:1177-1220 |
| gemini-1 (primary) | UNAVAIL | — |
| opencode-1 (T1 fallback) | YES — real and significant risk. cleanupOrphanedFiles and cleanupOrphanedHooks will silently delete GSD plugin artifacts. Recommends GSD detection before cleanup. | bin/install.js:1025-1049, bin/install.js:1055-1113, bin/install.js:2106-2165 |

## Outcome
Unanimous consensus: YES, install.js has significant conflict potential with the GSD plugin. The cleanup functions (cleanupOrphanedFiles, cleanupOrphanedHooks) unconditionally target gsd-* prefixed files and hook registrations, assuming they are nForma migration orphans. If a user has the upstream GSD plugin installed concurrently, these routines will silently destroy legitimate GSD artifacts. Recommended mitigations include GSD plugin detection guards, explicit allow-lists instead of prefix matching, and hook ownership metadata.
