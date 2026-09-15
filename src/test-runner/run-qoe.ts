import { expect, type Page, type TestInfo } from '@playwright/test';
import type { QoeSnapshot, QoeStartConfig } from '../types/qoe.js';

export interface RunQoeOptions extends QoeStartConfig {
  durationMs?: number;
}

export async function runQoePlayback(page: Page, testInfo: TestInfo, options: RunQoeOptions): Promise<QoeSnapshot> {
  const failedRequests: Array<{ url: string; error: string | null }> = [];
  page.on('requestfailed', request => failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText ?? null,
  }));

  await page.goto('/');
  await page.waitForFunction(() => typeof (window as any).startQoeRun === 'function');

  await page.evaluate(async config => {
    await (window as any).startQoeRun(config);
  }, options);

  const durationMs = options.durationMs ?? Number(process.env.QOE_TEST_DURATION_MS ?? 10_000);
  await page.waitForTimeout(durationMs);

  const snapshot = await page.evaluate(async () => {
    await (window as any).stopQoeRun();
    return (window as any).getQoeSnapshot();
  }) as QoeSnapshot;

  snapshot.networkErrors.push(...failedRequests.map(x => ({ source: 'playwright-requestfailed', ...x })));
  snapshot.metrics.networkErrorCount = snapshot.networkErrors.length;

  await testInfo.attach('qoe-metrics.json', {
    body: Buffer.from(JSON.stringify(snapshot.metrics, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach('qoe-telemetry.json', {
    body: Buffer.from(JSON.stringify({ events: snapshot.events, capabilities: snapshot.capabilities, networkErrors: snapshot.networkErrors }, null, 2)),
    contentType: 'application/json',
  });

  // Core structural assertions are stable even when public-CDN QoE varies.
  expect(snapshot.metrics.playbackFailures, JSON.stringify(snapshot.playbackFailures)).toBe(0);
  expect(snapshot.metrics.timeToFirstFrameMs).not.toBeNull();
  expect(snapshot.metrics.totalVideoFrames).toBeGreaterThan(0);

  const response = await page.request.post('/api/runs', {
    data: {
      assetUrl: options.assetUrl,
      protocol: options.protocol,
      browser: testInfo.project.name,
      networkProfile: options.networkProfile ?? 'browser-default',
      metrics: snapshot.metrics,
      telemetry: { events: snapshot.events, capabilities: snapshot.capabilities, networkErrors: snapshot.networkErrors },
    },
  });
  expect(response.ok()).toBeTruthy();
  const saved = await response.json();

  if (process.env.QOE_ENFORCE_THRESHOLDS === 'true') {
    expect(saved.analysis.verdict, JSON.stringify(saved.analysis.violations)).toBe('PASS');
  }

  return snapshot;
}
