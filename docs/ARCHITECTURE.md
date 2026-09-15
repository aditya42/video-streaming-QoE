# Architecture

## Logical flow

```text
Playwright test
  ├─ chooses asset/protocol/DRM configuration
  ├─ applies network condition
  └─ opens local playback harness
         ↓
Shaka Player + HTMLVideoElement
         ↓
Telemetry Collector
  ├─ media element events
  ├─ video frame callbacks
  ├─ playback-quality counters
  ├─ Shaka ABR/stats/events
  ├─ Shaka DRM request filters
  └─ browser request failures
         ↓
QoE Metrics Snapshot
         ↓
FastAPI /api/runs
         ↓
QoE Analyzer → PASS/FAIL + score
         ↓
SQLite → Dashboard
```

## Component responsibilities

### Playback Test
Owns test scenario, stream URL, duration, network profile, expected policy, browser/device matrix, and CI gating.

### Streaming Client
`web/player.js` wraps Shaka Player and a standard `HTMLVideoElement`. It exposes a deliberately small automation API on `window`:

```text
startQoeRun(config)
stopQoeRun()
getQoeSnapshot()
getQoeCapabilities()
```

This keeps test code independent from UI layout.

### Network Conditions
`NetworkController` is the first adapter. It uses Chromium CDP for latency/bandwidth/offline simulation. A proxy/netem adapter can be added later without changing QoE tests.

### Telemetry Collector
Collects raw events and derives a continuously updated metric snapshot.

### QoE Analyzer
Backend threshold evaluator. Keep business policy outside the player so different products/tiers can apply different SLOs to the same telemetry.

### Dashboard
Shows current player metrics, capability probes, run history, and aggregate pass/startup/TTFF data.

## Production extension boundaries

```text
NetworkController
  ├─ CdpNetworkController        [included]
  ├─ ToxiproxyController         [future]
  ├─ NetEmController             [future]
  └─ CDNFaultController          [future]

PlaybackAdapter
  ├─ ShakaWebAdapter             [included]
  ├─ NativeHlsSafariAdapter      [future]
  ├─ AndroidExoPlayerAdapter     [future]
  ├─ AppleAVPlayerAdapter        [future]
  └─ TV/STB SDK Adapter          [future]

SyncProbe
  ├─ BrowserInstrumentedProbe    [hook included]
  ├─ MarkerContentProbe          [future]
  └─ CaptureDeviceProbe          [future]
```
