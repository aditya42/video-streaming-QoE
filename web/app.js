(() => {
  const $ = (id) => document.getElementById(id);
  const protocol = $('protocol');
  const assetUrl = $('assetUrl');
  const networkProfile = $('networkProfile');
  const engineStatus = $('engineStatus');
  const playbackState = $('playbackState');
  const errorBox = $('errorBox');
  const metricsGrid = $('metricsGrid');
  const capabilityGrid = $('capabilityGrid');

  const SAMPLE_ASSETS = {
    dash: 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd',
    hls: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
  };

  const metricDefinitions = [
    ['startupTimeMs', 'Startup time', 'ms'],
    ['timeToFirstFrameMs', 'Time to first frame', 'ms'],
    ['rebufferingCount', 'Rebuffer count', ''],
    ['rebufferingRatio', 'Rebuffer ratio', '%'],
    ['currentBitrateKbps', 'Bitrate', 'kbps'],
    ['abrTransitionCount', 'ABR transitions', ''],
    ['droppedFrames', 'Dropped frames', ''],
    ['frameRate', 'Observed frame rate', 'fps'],
    ['resolution', 'Resolution', ''],
    ['playbackFailures', 'Playback failures', ''],
    ['networkErrorCount', 'Network errors', ''],
    ['drmLicenseLatencyMs', 'DRM license latency', 'ms'],
  ];

  protocol.addEventListener('change', () => { assetUrl.value = SAMPLE_ASSETS[protocol.value]; });
  assetUrl.value = SAMPLE_ASSETS.dash;

  function formatMetric(key, value, unit) {
    if (value == null) return '—';
    if (key === 'rebufferingRatio') return `${(Number(value) * 100).toFixed(2)}%`;
    if (typeof value === 'number') return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
    return String(value);
  }

  function renderMetrics(metrics = {}) {
    metricsGrid.innerHTML = metricDefinitions.map(([key, label, unit]) => `
      <div class="metric"><span>${label}</span><strong>${formatMetric(key, metrics[key], unit)}</strong><small>${key}</small></div>
    `).join('');
  }

  function renderCapabilities() {
    const capabilities = window.getQoeCapabilities?.() || {};
    const keys = ['h264', 'hevc', 'hevcMain10', 'av1', 'av1Main10', 'dolbyVision', 'vp9', 'hlsNative', 'mse', 'eme', 'requestVideoFrameCallback', 'hdrMediaQuery'];
    capabilityGrid.innerHTML = keys.map(key => `
      <div class="capability"><span>${key}</span><b class="${capabilities[key] ? 'yes' : 'no'}">${capabilities[key] ? 'YES' : 'NO'}</b></div>
    `).join('');
  }

  function setError(message = '') {
    errorBox.textContent = message;
    errorBox.classList.toggle('hidden', !message);
  }

  $('startBtn').addEventListener('click', async () => {
    setError();
    playbackState.textContent = 'LOADING';
    try {
      await window.startQoeRun({
        assetUrl: assetUrl.value,
        protocol: protocol.value,
        networkProfile: networkProfile.value,
      });
    } catch (e) {
      setError(e?.message || String(e));
      playbackState.textContent = 'ERROR';
    }
  });

  $('stopBtn').addEventListener('click', async () => {
    await window.stopQoeRun?.();
    playbackState.textContent = window.__QOE__?.state || 'STOPPED';
    renderMetrics(window.__QOE__?.metrics || {});
  });

  $('saveBtn').addEventListener('click', async () => {
    const snapshot = window.getQoeSnapshot?.();
    if (!snapshot) return setError('Start a QoE run before saving.');
    const response = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetUrl: snapshot.config.assetUrl,
        protocol: snapshot.config.protocol || 'unknown',
        browser: navigator.userAgent,
        networkProfile: snapshot.config.networkProfile || 'browser-default',
        metrics: snapshot.metrics,
        telemetry: { events: snapshot.events, capabilities: snapshot.capabilities },
      }),
    });
    if (!response.ok) return setError(`Save failed: HTTP ${response.status}`);
    await refreshRuns();
  });

  window.addEventListener('qoe-engine-ready', () => {
    engineStatus.textContent = 'Shaka ready';
    engineStatus.className = 'pill pass';
    renderCapabilities();
  });
  window.addEventListener('qoe-engine-error', (e) => {
    engineStatus.textContent = 'Player error';
    engineStatus.className = 'pill fail';
    setError(e.detail);
  });
  window.addEventListener('qoe-metrics', (e) => {
    renderMetrics(e.detail);
    playbackState.textContent = window.__QOE__?.state || 'RUNNING';
  });

  async function refreshRuns() {
    const [summaryResponse, runsResponse] = await Promise.all([fetch('/api/summary'), fetch('/api/runs?limit=25')]);
    const summary = await summaryResponse.json();
    const runs = await runsResponse.json();
    $('summaryGrid').innerHTML = [
      ['Total runs', summary.totalRuns],
      ['Pass rate', `${summary.passRate}%`],
      ['Average score', summary.averageScore],
      ['Avg startup', summary.averageStartupTimeMs == null ? '—' : `${summary.averageStartupTimeMs} ms`],
      ['Avg TTFF', summary.averageTtffMs == null ? '—' : `${summary.averageTtffMs} ms`],
    ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');

    $('runsTable').innerHTML = runs.map(run => `<tr>
      <td>${new Date(run.createdAt).toLocaleString()}</td>
      <td>${run.protocol.toUpperCase()}</td>
      <td>${run.networkProfile || '—'}</td>
      <td>${run.metrics.startupTimeMs ?? '—'} ms</td>
      <td>${run.metrics.timeToFirstFrameMs ?? '—'} ms</td>
      <td>${run.metrics.rebufferingCount ?? '—'} / ${run.metrics.rebufferingRatio != null ? (run.metrics.rebufferingRatio * 100).toFixed(2) + '%' : '—'}</td>
      <td>${run.analysis.score}</td>
      <td><span class="pill ${run.analysis.verdict === 'PASS' ? 'pass' : 'fail'}">${run.analysis.verdict}</span></td>
    </tr>`).join('');
  }

  $('refreshBtn').addEventListener('click', refreshRuns);
  renderMetrics();
  refreshRuns().catch(() => {});
})();
