# Low-Level Design

## Browser automation contract
The page exposes four functions for automation: `startQoeRun`, `stopQoeRun`, `getQoeSnapshot`, and `getQoeCapabilities`. Playwright uses this API and does not depend on dashboard selectors.

## Playback lifecycle
1. Initialize Shaka and attach it to the video element.
2. Install video/Shaka/networking instrumentation.
3. Load the HLS/DASH manifest.
4. Record the timestamp immediately before `video.play()`.
5. Record the first `playing` event and first video frame callback.
6. Track buffering episodes, frame counters, active bitrate, and quality transitions.
7. Stop after the scenario duration and materialize a final metrics snapshot.
8. Submit the run to `/api/runs`.

## DRM lifecycle
When a license URL is configured, Shaka EME configuration maps the logical DRM name to a key system. Networking filters timestamp the first license request and response. FairPlay can additionally receive a certificate URL. Authentication/header customization is intentionally left as a project adapter.

## Failure collection
- HTML media errors become playback failures.
- Shaka fatal errors become playback failures; network-category errors are additionally network errors.
- Playwright `requestfailed` events are appended to network errors.

## Persistence
SQLite stores one row per run, with common searchable columns and JSON documents for metrics, telemetry, and analysis. A production deployment can replace the repository with PostgreSQL/ClickHouse/OpenSearch without changing the browser contract.
