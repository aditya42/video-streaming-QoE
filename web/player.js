/* global shaka */
(() => {
  const video = document.getElementById('video');
  let player = null;
  let frameCallbackId = null;
  let metricsTimer = null;
  let runtime = null;

  const now = () => performance.now();
  const round = (value, digits = 2) => value == null || Number.isNaN(value) ? null : Number(value.toFixed(digits));

  function newRuntime(config) {
    return {
      config,
      startedAtEpochMs: Date.now(),
      state: 'INITIALIZING',
      timestamps: {},
      events: [],
      abrTransitions: [],
      resolutionTransitions: [],
      networkErrors: [],
      playbackFailures: [],
      rebuffering: { activeSince: null, totalMs: 0, count: 0 },
      frames: { count: 0, firstAt: null, lastAt: null },
      drm: { licenseRequestedAt: null, licenseCompletedAt: null, licenseLatencyMs: null },
      metrics: {},
      capabilities: probeCapabilities(),
      done: false,
    };
  }

  function event(type, data = {}) {
    if (!runtime) return;
    runtime.events.push({ type, atMs: round(now() - runtime.timestamps.testStart), ...data });
  }

  function detectProtocol(url) {
    const lower = (url || '').toLowerCase();
    if (lower.includes('.m3u8')) return 'hls';
    if (lower.includes('.mpd')) return 'dash';
    return 'unknown';
  }

  function probeCapabilities() {
    const ms = window.MediaSource;
    const supports = (mime) => Boolean(ms?.isTypeSupported?.(mime) || video.canPlayType(mime));
    return {
      h264: supports('video/mp4; codecs="avc1.640028"'),
      hevc: supports('video/mp4; codecs="hvc1.1.6.L120.90"') || supports('video/mp4; codecs="hev1.1.6.L120.90"'),
      hevcMain10: supports('video/mp4; codecs="hvc1.2.4.L153.B0"') || supports('video/mp4; codecs="hev1.2.4.L153.B0"'),
      av1: supports('video/mp4; codecs="av01.0.08M.08"'),
      av1Main10: supports('video/mp4; codecs="av01.0.08M.10"'),
      dolbyVision: supports('video/mp4; codecs="dvh1.05.06"') || supports('video/mp4; codecs="dvhe.05.06"'),
      vp9: supports('video/webm; codecs="vp9"'),
      hlsNative: Boolean(video.canPlayType('application/vnd.apple.mpegurl')),
      mse: Boolean(window.MediaSource),
      eme: Boolean(navigator.requestMediaKeySystemAccess),
      requestVideoFrameCallback: Boolean(video.requestVideoFrameCallback),
      hdrMediaQuery: Boolean(window.matchMedia?.('(dynamic-range: high)').matches),
      note: 'Codec/HDR capability is browser-advertised support, not decoded-output certification.'
    };
  }

  function startFrameProbe() {
    if (!video.requestVideoFrameCallback) return;
    const callback = (timestamp) => {
      if (!runtime || runtime.done) return;
      runtime.frames.count += 1;
      runtime.frames.firstAt ??= timestamp;
      runtime.frames.lastAt = timestamp;
      if (!runtime.timestamps.firstFrame) {
        runtime.timestamps.firstFrame = timestamp;
        event('first-frame');
      }
      frameCallbackId = video.requestVideoFrameCallback(callback);
    };
    frameCallbackId = video.requestVideoFrameCallback(callback);
  }

  function beginRebuffer(source) {
    if (!runtime || !runtime.timestamps.firstPlaying || runtime.rebuffering.activeSince != null) return;
    runtime.rebuffering.activeSince = now();
    runtime.rebuffering.count += 1;
    event('rebuffer-start', { source });
  }

  function endRebuffer() {
    if (!runtime || runtime.rebuffering.activeSince == null) return;
    const duration = now() - runtime.rebuffering.activeSince;
    runtime.rebuffering.totalMs += duration;
    runtime.rebuffering.activeSince = null;
    event('rebuffer-end', { durationMs: round(duration) });
  }

  function activeTrack() {
    try {
      const tracks = player?.getVariantTracks?.() || [];
      return tracks.find(t => t.active) || null;
    } catch {
      return null;
    }
  }

  function snapshotMetrics() {
    if (!runtime) return {};
    const quality = video.getVideoPlaybackQuality?.();
    const track = activeTrack();
    let stats = {};
    try { stats = player?.getStats?.() || {}; } catch { /* no-op */ }

    const current = now();
    const rebufferMs = runtime.rebuffering.totalMs + (runtime.rebuffering.activeSince ? current - runtime.rebuffering.activeSince : 0);
    const observationStart = runtime.timestamps.firstPlaying || runtime.timestamps.playRequested || runtime.timestamps.loadStart || runtime.timestamps.testStart;
    const observedMs = Math.max(current - observationStart, 1);
    const totalFrames = quality?.totalVideoFrames ?? stats.decodedFrames ?? 0;
    const droppedFrames = quality?.droppedVideoFrames ?? stats.droppedFrames ?? 0;
    const frameWindowMs = runtime.frames.firstAt && runtime.frames.lastAt ? runtime.frames.lastAt - runtime.frames.firstAt : 0;
    const observedFps = frameWindowMs > 0 ? (runtime.frames.count - 1) * 1000 / frameWindowMs : null;
    const bitrate = track?.bandwidth ?? stats.streamBandwidth ?? null;

    runtime.metrics = {
      startupTimeMs: runtime.timestamps.firstPlaying && runtime.timestamps.playRequested ? round(runtime.timestamps.firstPlaying - runtime.timestamps.playRequested) : null,
      timeToFirstFrameMs: runtime.timestamps.firstFrame && runtime.timestamps.playRequested ? round(runtime.timestamps.firstFrame - runtime.timestamps.playRequested) : null,
      rebufferingCount: runtime.rebuffering.count,
      rebufferingDurationMs: round(rebufferMs),
      rebufferingRatio: round(rebufferMs / observedMs, 4),
      currentBitrateKbps: bitrate ? round(bitrate / 1000, 0) : null,
      estimatedBandwidthKbps: stats.estimatedBandwidth ? round(stats.estimatedBandwidth / 1000, 0) : null,
      abrTransitionCount: runtime.abrTransitions.length,
      abrTransitions: runtime.abrTransitions,
      droppedFrames,
      totalVideoFrames: totalFrames,
      droppedFrameRatio: totalFrames > 0 ? round(droppedFrames / totalFrames, 5) : 0,
      frameRate: round(observedFps),
      resolution: video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : null,
      resolutionTransitions: runtime.resolutionTransitions,
      avSyncMs: window.__QOE_AV_SYNC_MS ?? null,
      avSyncMeasurement: window.__QOE_AV_SYNC_MS == null ? 'NOT_INSTRUMENTED' : 'INSTRUMENTED',
      playbackFailures: runtime.playbackFailures.length,
      networkErrorCount: runtime.networkErrors.length,
      drmLicenseLatencyMs: round(runtime.drm.licenseLatencyMs),
      currentTimeSec: round(video.currentTime),
      bufferedAheadSec: video.buffered.length ? round(video.buffered.end(video.buffered.length - 1) - video.currentTime) : 0,
    };
    window.__QOE__ = runtime;
    window.dispatchEvent(new CustomEvent('qoe-metrics', { detail: runtime.metrics }));
    return runtime.metrics;
  }

  function recordQualityTransition(reason) {
    const track = activeTrack();
    if (!runtime) return;
    const transition = {
      atMs: round(now() - runtime.timestamps.testStart),
      reason,
      id: track?.id ?? null,
      bandwidthKbps: track?.bandwidth ? round(track.bandwidth / 1000, 0) : null,
      width: track?.width ?? video.videoWidth ?? null,
      height: track?.height ?? video.videoHeight ?? null,
    };
    runtime.abrTransitions.push(transition);
    const resolution = transition.width && transition.height ? `${transition.width}x${transition.height}` : null;
    if (resolution && runtime.resolutionTransitions.at(-1)?.resolution !== resolution) {
      runtime.resolutionTransitions.push({ atMs: transition.atMs, resolution, reason });
    }
    event('quality-change', transition);
  }

  function installVideoListeners() {
    video.addEventListener('loadedmetadata', () => { if (runtime) { runtime.timestamps.loadedMetadata = now(); event('loadedmetadata'); } });
    video.addEventListener('canplay', () => { if (runtime) { runtime.timestamps.canPlay ??= now(); event('canplay'); } });
    video.addEventListener('playing', () => {
      if (!runtime) return;
      endRebuffer();
      runtime.timestamps.firstPlaying ??= now();
      runtime.state = 'PLAYING';
      event('playing');
      snapshotMetrics();
    });
    video.addEventListener('waiting', () => beginRebuffer('waiting'));
    video.addEventListener('stalled', () => beginRebuffer('stalled'));
    video.addEventListener('pause', () => { if (runtime && !video.ended) { runtime.state = 'PAUSED'; event('pause'); } });
    video.addEventListener('ended', () => { if (runtime) { runtime.state = 'ENDED'; runtime.done = true; endRebuffer(); snapshotMetrics(); event('ended'); } });
    video.addEventListener('error', () => {
      if (!runtime) return;
      const failure = { code: video.error?.code ?? -1, message: video.error?.message ?? 'HTMLVideoElement error' };
      runtime.playbackFailures.push(failure);
      runtime.state = 'ERROR';
      event('video-error', failure);
      snapshotMetrics();
    });
  }

  function configureDrm(config) {
    const drm = config?.drm;
    if (!drm?.licenseUrl) return;
    const keySystems = {
      widevine: 'com.widevine.alpha',
      playready: 'com.microsoft.playready',
      fairplay: 'com.apple.fps',
    };
    const keySystem = keySystems[drm.keySystem];
    if (!keySystem) throw new Error(`Unsupported DRM keySystem: ${drm.keySystem}`);

    const settings = { drm: { servers: { [keySystem]: drm.licenseUrl } } };
    if (drm.keySystem === 'fairplay' && drm.certificateUrl) {
      settings.drm.advanced = { [keySystem]: { serverCertificateUri: drm.certificateUrl } };
    }
    player.configure(settings);
  }

  function installShakaInstrumentation() {
    player.addEventListener('adaptation', () => recordQualityTransition('adaptation'));
    player.addEventListener('variantchanged', () => recordQualityTransition('variantchanged'));
    player.addEventListener('mediaqualitychanged', () => recordQualityTransition('mediaqualitychanged'));
    player.addEventListener('buffering', (e) => {
      if (e.buffering) beginRebuffer('shaka-buffering'); else endRebuffer();
    });
    player.addEventListener('error', (e) => {
      if (!runtime) return;
      const detail = e.detail || {};
      const failure = { category: detail.category ?? null, code: detail.code ?? null, severity: detail.severity ?? null, message: String(detail) };
      runtime.playbackFailures.push(failure);
      if (detail.category === shaka.util.Error.Category.NETWORK) runtime.networkErrors.push(failure);
      runtime.state = 'ERROR';
      event('shaka-error', failure);
      snapshotMetrics();
    });

    const networking = player.getNetworkingEngine?.();
    if (!networking) return;
    networking.registerRequestFilter((type) => {
      if (!runtime) return;
      if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
        runtime.drm.licenseRequestedAt ??= now();
        event('drm-license-request');
      }
    });
    networking.registerResponseFilter((type) => {
      if (!runtime) return;
      if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
        runtime.drm.licenseCompletedAt = now();
        if (runtime.drm.licenseRequestedAt) runtime.drm.licenseLatencyMs = runtime.drm.licenseCompletedAt - runtime.drm.licenseRequestedAt;
        event('drm-license-response', { latencyMs: round(runtime.drm.licenseLatencyMs) });
      }
    });
  }

  async function ensurePlayer() {
    if (player) return player;
    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) throw new Error('Shaka Player reports this browser as unsupported.');
    player = new shaka.Player();
    await player.attach(video);
    installVideoListeners();
    installShakaInstrumentation();
    return player;
  }

  async function startQoeRun(config) {
    await ensurePlayer();
    if (runtime && !runtime.done) await stopQoeRun();
    runtime = newRuntime(config);
    runtime.timestamps.testStart = now();
    runtime.timestamps.loadStart = now();
    runtime.state = 'LOADING';
    window.__QOE__ = runtime;
    event('load-start', { assetUrl: config.assetUrl });

    configureDrm(config);
    startFrameProbe();

    try {
      await player.load(config.assetUrl);
      runtime.timestamps.loadComplete = now();
      event('manifest-loaded', { protocol: config.protocol || detectProtocol(config.assetUrl) });
      runtime.timestamps.playRequested = now();
      await video.play();
      metricsTimer = setInterval(snapshotMetrics, 500);
      snapshotMetrics();
      return runtime;
    } catch (error) {
      const failure = { message: error?.message || String(error), code: error?.code ?? null, category: error?.category ?? null };
      runtime.playbackFailures.push(failure);
      if (error?.category === shaka.util.Error.Category.NETWORK) runtime.networkErrors.push(failure);
      runtime.state = 'ERROR';
      runtime.done = true;
      event('load-failure', failure);
      snapshotMetrics();
      throw error;
    }
  }

  async function stopQoeRun() {
    if (!runtime) return null;
    clearInterval(metricsTimer);
    metricsTimer = null;
    if (frameCallbackId && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameCallbackId);
    endRebuffer();
    video.pause();
    runtime.done = true;
    runtime.state = runtime.state === 'ERROR' ? 'ERROR' : 'STOPPED';
    runtime.timestamps.stopped = now();
    snapshotMetrics();
    event('stopped');
    return runtime;
  }

  async function destroyPlayer() {
    await stopQoeRun();
    if (player) await player.destroy();
    player = null;
  }

  window.startQoeRun = startQoeRun;
  window.stopQoeRun = stopQoeRun;
  window.destroyQoePlayer = destroyPlayer;
  window.getQoeSnapshot = () => { snapshotMetrics(); return window.__QOE__; };
  window.getQoeCapabilities = probeCapabilities;

  ensurePlayer()
    .then(() => window.dispatchEvent(new CustomEvent('qoe-engine-ready')))
    .catch((error) => window.dispatchEvent(new CustomEvent('qoe-engine-error', { detail: error.message })));
})();
