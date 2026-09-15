# Database Schema

## `qoe_runs`

| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT PK | Run UUID |
| `created_at` | TEXT | UTC ISO-8601 timestamp |
| `asset_url` | TEXT | Tested manifest/resource |
| `protocol` | TEXT | HLS/DASH/etc. |
| `browser` | TEXT | Browser/project/device label |
| `network_profile` | TEXT | Applied network condition |
| `status` | TEXT | PASS/FAIL |
| `score` | INTEGER | QoE score |
| `metrics_json` | TEXT/JSON | Final normalized metrics |
| `telemetry_json` | TEXT/JSON | Raw events/capabilities/errors |
| `analysis_json` | TEXT/JSON | Threshold violations and verdict |

Indexes are included for time, protocol, and status.
