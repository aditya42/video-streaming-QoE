# Product Requirements — Streaming QoE Validation Framework

## Objective
Provide a reusable quality-engineering harness that runs adaptive video playback, introduces controlled network conditions, collects playback telemetry, converts telemetry into QoE metrics, stores results, and exposes a lightweight dashboard.

## Primary users
- SDET / Quality Engineers
- Streaming client engineers
- Device / partner certification teams
- Performance and reliability engineers

## MVP requirements
- Execute HLS and MPEG-DASH VOD playback in a browser.
- Capture startup time, TTFF, buffering, bitrate/ABR, frame, resolution, failure, network, and DRM-license metrics.
- Apply reproducible latency/bandwidth/offline profiles in Chromium.
- Persist run results and threshold verdicts.
- Expose a browser dashboard and API.
- Run in CI without requiring threshold gating by default.

## Non-goals for MVP
- Claiming hardware-certified HDR/Dolby Vision output from a browser capability string.
- Fabricating A/V sync from a single media clock.
- Shipping real DRM credentials or license-server secrets.
- Replacing a production CDN/network impairment lab.

## Success criteria
A test can select a stream and network profile, play for a configured duration, produce a structured QoE result, persist it, and expose the run in the dashboard.
