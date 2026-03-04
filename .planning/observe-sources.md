---
# Observe sources configuration
# Format: backward-compatible with triage-sources.md
# New fields: issue_type, timeout, fail_open (optional, defaults provided)

observe_config:
  default_timeout: 10
  fail_open_default: true

sources:

  # GitHub Issues
  # - type: github
  #   label: "GitHub Issues"
  #   issue_type: issue
  #   repo: owner/repo
  #   timeout: 8
  #   filter:
  #     state: open
  #     labels: [bug, regression]
  #     since: 7d

  # Sentry Errors
  # - type: sentry
  #   label: "Sentry Errors"
  #   issue_type: issue
  #   project: org-slug/project-slug
  #   filter:
  #     status: unresolved
  #     since: 24h

  # Sentry User Feedback
  # - type: sentry-feedback
  #   label: "Sentry Feedback"
  #   issue_type: issue
  #   project: org-slug/project-slug
  #   filter:
  #     since: 7d

  # Custom bash command
  # - type: bash
  #   label: "TODO items"
  #   issue_type: issue
  #   command: "grep -r 'TODO.*FIXME' src/ || echo 'none'"
  #   parser: lines

  # Prometheus Alerts
  # - type: prometheus
  #   label: "Prometheus Alerts"
  #   issue_type: drift
  #   endpoint: http://prometheus:9090
  #   auth_env: PROMETHEUS_TOKEN
  #   timeout: 15
  #   fail_open: true

  # Prometheus PromQL Query
  # - type: prometheus
  #   label: "Prometheus: Max Deliberation Time"
  #   issue_type: drift
  #   endpoint: http://prometheus:9090
  #   auth_env: PROMETHEUS_TOKEN
  #   query: "max_deliberation_ms_actual > 5000"
  #   threshold: 5000
  #   timeout: 15

  # Grafana Alerts
  # - type: grafana
  #   label: "Grafana Alerts"
  #   issue_type: drift
  #   endpoint: https://grafana.example.com
  #   auth_env: GRAFANA_TOKEN
  #   timeout: 15
  #   fail_open: true

  # Logstash / Elasticsearch
  # - type: logstash
  #   label: "Production Errors"
  #   issue_type: issue
  #   endpoint: https://elasticsearch.example.com:9200
  #   index: logstash-*
  #   auth_env: ES_API_KEY
  #   auth_type: ApiKey
  #   timeout: 15
  #   fail_open: true
  #   filter:
  #     since: 24h
  #     levels: [error, warn]
  #     limit: 50

---

## Observe Sources

Configuration for `/qgsd:observe` — the project's production feedback system.

### Source Types

| Type | Category | Description |
|------|----------|-------------|
| `github` | issue | GitHub issues and PRs |
| `sentry` | issue | Sentry error events |
| `sentry-feedback` | issue | Sentry user feedback reports |
| `bash` | issue | Custom shell command output |
| `prometheus` | drift | Prometheus alerts and PromQL metric queries |
| `grafana` | drift | Grafana unified alerting dashboard alerts |
| `logstash` | issue | Elasticsearch/Logstash log entry queries |

### Config Fields

- **type** (required): Source type string
- **label** (required): Human-readable source name for display
- **issue_type** (optional): `"issue"` or `"drift"` (inferred from type if omitted)
- **timeout** (optional): Per-source timeout in seconds (overrides `observe_config.default_timeout`)
- **fail_open** (optional): If true, source failure does not block others (default: true)

### Backward Compatibility

Existing `triage-sources.md` files work unchanged. The observe config loader tries `observe-sources.md` first, then falls back to `triage-sources.md`. Fields without `issue_type` are inferred from the source type.
