# High-Level Design

```text
Playwright Scenario
      |
      +--> NetworkController --> Chromium CDP / future proxy-netem
      |
      +--> Web Playback Harness
              |
              +--> Shaka Player --> HLS / DASH --> CDN / Origin
              |                    --> EME --> DRM License Server
              |
              +--> HTMLVideoElement telemetry
              +--> Shaka events/stats
              +--> frame callbacks
                       |
                       v
                 QoE Snapshot
                       |
                       v
                FastAPI Service
                  |         |
             QoE Analyzer  SQLite
                  |         |
                  +---- Dashboard
```

## Design principles
- Keep player instrumentation separate from test scenario logic.
- Keep thresholds/policy separate from raw telemetry.
- Treat browser network emulation as an adapter, not the final fault-injection solution.
- Keep DRM credentials runtime-only.
- Represent unsupported measurements as `null` rather than synthetic values.
