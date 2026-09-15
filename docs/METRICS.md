# QoE Metric Definitions

| Metric | Definition in this framework |
|---|---|
| Playback startup time | First `playing` timestamp minus `play()` request timestamp |
| Time-to-first-frame | First video-frame callback timestamp minus `play()` request timestamp |
| Rebuffer count | Number of buffering episodes after first playback |
| Rebuffer duration | Sum of observed buffering episode durations |
| Rebuffer ratio | Rebuffer duration / wall time since playback began |
| Current bitrate | Active variant bandwidth, reported in kbps |
| ABR transitions | Quality/adaptation events recorded with bitrate + resolution |
| Dropped frames | Browser playback-quality dropped-frame counter |
| Dropped-frame ratio | dropped frames / total video frames |
| Frame rate | observed frame callbacks divided by elapsed callback time |
| Resolution transitions | change history of active video dimensions |
| A/V sync | `null` by default; populated only by an explicit sync probe |
| Playback failures | fatal HTML video or Shaka player errors |
| Network errors | Shaka network errors plus Playwright request failures |
| DRM license latency | first license response time minus first license request time |

## Percentiles

The skeleton stores individual run metrics. A production analytics service should compute P50/P90/P95/P99 by release, device, protocol, CDN, ISP/network profile, codec, DRM system, asset class, and geography.
