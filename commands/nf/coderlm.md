---
name: nf:coderlm
description: Manage the coderlm symbol server lifecycle — start, stop, status, update. The server auto-starts during nf:solve, but this skill provides manual control.
argument-hint: "<start|stop|status|update>"
allowed-tools:
  - Bash
  - Read
---

<objective>
Manage the coderlm symbol server lifecycle. The coderlm server indexes source code symbols and call graphs for graph-driven wave scheduling in nf:solve. It auto-starts during nf:solve runs, but this skill provides manual control for starting, stopping, checking status, and updating the binary.
</objective>

<process>

**Step 1: Parse subcommand**

Parse the first argument as the subcommand. Valid subcommands: `start`, `stop`, `status`, `update`.

If no argument is provided or the argument is not recognized, display:

```
/nf:coderlm -- Manage the coderlm symbol server

Usage:
  /nf:coderlm start    Start the server (downloads binary if needed)
  /nf:coderlm stop     Stop the running server
  /nf:coderlm status   Show server status (binary, process, health, idle)
  /nf:coderlm update   Update to the latest release (stop + re-download + start)

The server auto-starts during nf:solve runs. Manual control is optional.
```

**Step 2: Execute subcommand**

**start:**

```bash
node bin/coderlm-lifecycle.cjs --start
```

Parse JSON output. Report:
- Binary path (downloaded or cached)
- PID and whether it was already running or freshly started
- If failed, suggest checking `gh auth status` (for download issues) or disk space

**stop:**

```bash
node bin/coderlm-lifecycle.cjs --stop
```

Parse JSON output. Report: stopped, already-dead, or not-running.

**status:**

```bash
node bin/coderlm-lifecycle.cjs --status
```

Parse JSON output. Render a formatted status report:

```
coderlm Status
  Binary:  installed at ~/.claude/nf-bin/coderlm (or: not installed)
  Process: running (PID 12345) (or: not running)
  Health:  healthy, 12ms latency (or: unhealthy -- ECONNREFUSED)
  Idle:    2m 30s since last query (auto-stop at 5m)
```

**update:**

```bash
node bin/coderlm-lifecycle.cjs --update
```

This stops the running server (if any), deletes the cached binary, and re-downloads the latest release. Parse JSON output and report the result.

**Step 3: Report result**

Display the outcome to the user in a clear format. If any step failed, include diagnostic information and suggested next steps.

</process>
