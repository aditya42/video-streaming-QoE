# Streaming QoE Validation Framework

A small, extensible framework for validating **video streaming Quality of Experience (QoE)** across HLS and MPEG-DASH playback under controllable network conditions.

## Architecture

```text
Playback Test
      ↓
Streaming Client (Shaka Player + HTMLVideoElement)
      ↓
Network Conditions (Playwright + CDP; proxy/netem extension point)
      ↓
Video Playback
      ↓
Telemetry Collector
      ↓
QoE Analyzer
      ↓
Dashboard + SQLite
```

## What this skeleton measures

| Metric | Implementation |
|---|---|
| Playback startup time | `play()` request → `playing` event |
| Time-to-first-frame | `play()` request → first `requestVideoFrameCallback` |
| Rebuffering count | `waiting`/`stalled` episodes after playback starts |
| Rebuffering ratio | buffering duration / observed playback wall time |
| Bitrate | active Shaka variant / player stats |
| Adaptive bitrate transitions | Shaka adaptation / variant change events |
| Dropped frames | `HTMLVideoElement.getVideoPlaybackQuality()` |
| Frame rate | observed video-frame callbacks over time |
| Resolution transitions | video width/height sampled during quality changes |
| A/V synchronization | extension point; default is `null` unless an instrumented probe supplies a value |
| Playback failures | video errors + Shaka fatal errors |
| CDN/network errors | Shaka networking errors + failed browser resource requests captured by Playwright |
| DRM/license acquisition latency | Shaka license request/response timing filters |

## Protocol / codec / playback coverage model

The browser player uses **Shaka Player**, so the same harness can exercise HLS and DASH and can be configured for EME DRM. Codec, HDR, and DRM success still depends on the actual OS/browser/device/CDM and test stream.

Supported configuration dimensions in this skeleton:

- HLS and MPEG-DASH
- HTTP/HTTPS manifests and segments
- Widevine, PlayReady, FairPlay configuration hooks
- H.264, HEVC/H.265, AV1 capability reporting
- HDR/HDR10/Dolby Vision capability metadata hooks
- bandwidth, latency, offline, and bandwidth-variation profiles
- packet-loss extension point (CDP for applicable traffic; proxy or Linux `tc/netem` recommended for deterministic HTTP segment loss)

## Repository layout

```text
backend/                  FastAPI API, SQLite repository, QoE scoring
web/                      playback harness + dashboard
scripts/                  local Shaka vendor-copy helper
src/network/              Playwright network-condition adapter
src/test-runner/          reusable QoE run helper
src/types/                shared TypeScript test types
tests/                    HLS/DASH/network QoE examples
backend/tests/            QoE analyzer unit tests
.github/workflows/        CI example
```

## Quick start

Prerequisites: **Python 3.11+**, **Node.js 22+**, and Chromium installed through Playwright.

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\\Scripts\\activate
pip install -r backend/requirements.txt

npm install
npx playwright install chromium

# terminal 1
uvicorn backend.app.main:app --reload --port 8000

# terminal 2
npm test
```

Open `http://localhost:8000` for the playback harness and run-history dashboard.

`npm install` copies Shaka Player's compiled browser bundle from `node_modules` into `web/vendor`, so the local player page does not depend on a CDN.

## Run a single baseline test

```bash
npx playwright test tests/hls-qoe.spec.ts --project=chromium
```

## Run with a custom asset

```bash
QOE_ASSET_URL="https://example.test/master.m3u8" \
QOE_PROTOCOL=hls \
npx playwright test tests/hls-qoe.spec.ts --project=chromium
```

## Example public clear assets

The examples default to Shaka's public Angel One assets:

```text
DASH: https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd
HLS:  https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8
```

Public demo assets are useful for framework smoke tests. Production QoE gates should use streams, CDN paths, manifests, encodes, DRM servers, and player configurations representative of the product under test.

## Network profiles

Built-in profiles live in `src/network/profiles.ts`:

- `wifi`
- `4g`
- `3g`
- `edge`
- `offline`
- `variable-low` / `variable-high`

Example:

```ts
await applyNetworkProfile(page, NETWORK_PROFILES['3g']);
```

The adapter first attempts newer CDP network-condition commands and falls back to the older emulation command for compatibility.

### Packet loss

Do not assume browser CDP packet-loss controls model TCP/HTTP media segment loss with production fidelity. For deterministic HTTP loss/corruption, add one of these adapters behind the same `NetworkController` abstraction:

```text
Playwright → HTTP fault proxy → CDN/origin
```

or on Linux:

```text
Playwright container → tc/netem → network
```

That extension can introduce loss, jitter, duplication, corruption, DNS failures, TCP resets, HTTP 4xx/5xx, and CDN-specific failure patterns.

## DRM configuration

The playback page accepts DRM settings through `window.startQoeRun()`:

```js
{
  drm: {
    keySystem: "widevine",
    licenseUrl: "https://license.example.test/widevine"
  }
}
```

Supported key-system mappings:

```text
widevine  -> com.widevine.alpha
playready -> com.microsoft.playready
fairplay  -> com.apple.fps
```

For FairPlay, set `certificateUrl` as well. Do not commit production license tokens, authorization headers, certificates, or secrets. Add request-filter authentication in a project-specific adapter or inject short-lived values at runtime.

## QoE thresholds

Default threshold policy is in `backend/app/qoe.py` and can be overridden per submitted run.

Example policy:

```json
{
  "startupTimeMs": 5000,
  "timeToFirstFrameMs": 5500,
  "rebufferingRatio": 0.10,
  "droppedFrameRatio": 0.05,
  "playbackFailures": 0
}
```

By default the Playwright examples **record** threshold verdicts but do not fail CI on environmental QoE variation. Enable hard gating with:

```bash
QOE_ENFORCE_THRESHOLDS=true npm test
```

## A/V sync caveat

Generic browser APIs do not expose a universally reliable decoded-audio presentation timestamp that can be directly compared with each displayed video frame. The framework therefore exposes an `avSyncMs` field but leaves it `null` by default. For real lip-sync validation, implement one of:

- instrumented test content with synchronized audio/video markers,
- player-SDK/device telemetry exposing independent audio/video clocks,
- capture-card / camera + microphone analysis,
- device-lab probes for TV / set-top-box validation.

This is intentionally represented as **not measured**, rather than generating a misleading number.

## Codec and HDR validation

The player records browser capability checks using `MediaSource.isTypeSupported()` and `HTMLMediaElement.canPlayType()` where available. This tells you what the browser advertises; it is not a substitute for validating decode correctness, color volume, metadata passthrough, tone mapping, or display output on target hardware.

For HEVC, AV1, HDR10, and Dolby Vision, extend device-lab execution with:

```text
manifest metadata
+ browser/player capability
+ decoded resolution/bitrate
+ device codec capability
+ HDMI/display/capture validation (when required)
```

## API

```text
GET  /api/health
POST /api/runs
GET  /api/runs?limit=50
GET  /api/runs/{id}
GET  /api/summary
```

## Example result

```json
{
  "metrics": {
    "startupTimeMs": 842.3,
    "timeToFirstFrameMs": 905.8,
    "rebufferingCount": 0,
    "rebufferingRatio": 0.0,
    "currentBitrateKbps": 2380,
    "abrTransitionCount": 2,
    "droppedFrames": 1,
    "droppedFrameRatio": 0.0007,
    "frameRate": 29.97,
    "resolution": "1280x720",
    "playbackFailures": 0,
    "networkErrorCount": 0,
    "drmLicenseLatencyMs": null,
    "avSyncMs": null
  },
  "analysis": {
    "verdict": "PASS",
    "score": 100,
    "violations": []
  }
}
```

## Recommended next expansion

1. **Protocol matrix** — HLS VOD/live/LL-HLS and DASH VOD/live/low-latency.
2. **Device matrix** — Chromium/WebKit plus actual TV/STB/mobile hardware.
3. **DRM lab** — Widevine/PlayReady/FairPlay with secure runtime secret injection.
4. **Fault proxy** — HTTP status injection, slow responses, resets, jitter, loss, CDN POP failures.
5. **Codec/HDR corpus** — H.264, HEVC, AV1, SDR, HDR10, Dolby Vision reference assets.
6. **QoE trend analytics** — build-to-build percentile trends (P50/P95/P99), regressions, and alerting.
7. **Observability** — OpenTelemetry spans for manifest, segment, license, and player-state transitions.
8. **Device-farm interface** — adapters for smart TVs, streaming sticks, consoles, and set-top boxes.

## License

Skeleton code is provided for adaptation inside your organization. Add your organization's license and security policy before publishing.
