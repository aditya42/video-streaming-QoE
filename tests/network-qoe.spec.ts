import { test } from '@playwright/test';
import { NetworkController } from '../src/network/controller.js';
import { NETWORK_PROFILES } from '../src/network/profiles.js';
import { runQoePlayback } from '../src/test-runner/run-qoe.js';

const DEFAULT_HLS = 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8';

test('HLS QoE under 3G-like bandwidth and latency', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'CDP network emulation is Chromium-only.');
  const network = new NetworkController(page);
  await network.initialize();
  await network.apply(NETWORK_PROFILES['3g']);
  try {
    await runQoePlayback(page, testInfo, {
      assetUrl: process.env.QOE_ASSET_URL ?? DEFAULT_HLS,
      protocol: 'hls',
      networkProfile: '3g',
      durationMs: 12_000,
    });
  } finally {
    await network.close();
  }
});

test('ABR reacts to bandwidth variation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'CDP network emulation is Chromium-only.');
  const network = new NetworkController(page);
  await network.initialize();
  await network.apply(NETWORK_PROFILES['variable-high']);

  await page.goto('/');
  await page.waitForFunction(() => typeof (window as any).startQoeRun === 'function');
  await page.evaluate(async assetUrl => {
    await (window as any).startQoeRun({ assetUrl, protocol: 'hls', networkProfile: 'variable' });
  }, process.env.QOE_ASSET_URL ?? DEFAULT_HLS);

  await page.waitForTimeout(5_000);
  await network.apply(NETWORK_PROFILES['variable-low']);
  await page.waitForTimeout(7_000);
  await network.apply(NETWORK_PROFILES['variable-high']);
  await page.waitForTimeout(5_000);

  const snapshot = await page.evaluate(async () => {
    await (window as any).stopQoeRun();
    return (window as any).getQoeSnapshot();
  });

  await testInfo.attach('abr-transitions.json', {
    body: Buffer.from(JSON.stringify(snapshot.metrics.abrTransitions, null, 2)),
    contentType: 'application/json',
  });

  await page.request.post('/api/runs', { data: {
    assetUrl: process.env.QOE_ASSET_URL ?? DEFAULT_HLS,
    protocol: 'hls',
    browser: testInfo.project.name,
    networkProfile: 'variable-high-low-high',
    metrics: snapshot.metrics,
    telemetry: { events: snapshot.events, capabilities: snapshot.capabilities },
  }});

  await network.close();
});
