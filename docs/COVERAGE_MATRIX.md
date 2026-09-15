# Coverage Matrix

| Area | MVP status | Notes |
|---|---|---|
| HLS | Implemented | Shaka clear-stream smoke test |
| MPEG-DASH | Implemented | Shaka clear-stream smoke test |
| HTTP / HTTPS | Supported | Custom manifest URL; normal browser security rules apply |
| DRM / EME | Framework hook | Requires real protected stream + license service |
| Widevine | Framework hook | `com.widevine.alpha` |
| PlayReady | Framework hook | `com.microsoft.playready` |
| FairPlay | Framework hook | `com.apple.fps`; certificate URL supported |
| H.264 | Capability probe | Actual decode validated by playback |
| HEVC/H.265 | Capability probe | Device/browser dependent |
| AV1 | Capability probe | Device/browser dependent |
| HDR/HDR10 concepts | Capability hints | Hardware output certification is future device-lab work |
| Dolby Vision concepts | Codec capability hint | Real certification requires supported device/content/display path |
| Network latency | Implemented | Chromium CDP |
| Bandwidth throttling | Implemented | Chromium CDP |
| Bandwidth variation | Implemented | High → low → high example |
| Offline | Implemented profile | Chromium CDP |
| Packet loss | Extension point | Use proxy/netem for deterministic HTTP segment-loss tests |
| A/V synchronization | Extension point | Requires independent sync probe / marked content / capture |
| CDN 4xx/5xx/reset faults | Future adapter | Add HTTP fault proxy |
| Smart TV / STB devices | Future adapter | Reuse metrics schema with device-specific playback adapter |
