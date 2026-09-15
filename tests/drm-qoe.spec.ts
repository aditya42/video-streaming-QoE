import { test, expect } from '@playwright/test';
import { runQoePlayback } from '../src/test-runner/run-qoe.js';
import type { DrmSystem } from '../src/types/qoe.js';

test('DRM playback QoE with configured license server', async ({ page }, testInfo) => {
  const assetUrl = process.env.QOE_ASSET_URL;
  const licenseUrl = process.env.QOE_LICENSE_URL;
  const drmSystem = process.env.QOE_DRM_SYSTEM as DrmSystem | undefined;

  test.skip(!assetUrl || !licenseUrl || !drmSystem, 'Set QOE_ASSET_URL, QOE_LICENSE_URL, and QOE_DRM_SYSTEM to run DRM validation.');

  const snapshot = await runQoePlayback(page, testInfo, {
    assetUrl: assetUrl!,
    protocol: (process.env.QOE_PROTOCOL as 'hls' | 'dash') ?? 'dash',
    networkProfile: 'browser-default',
    drm: {
      keySystem: drmSystem!,
      licenseUrl: licenseUrl!,
      certificateUrl: process.env.QOE_FAIRPLAY_CERT_URL,
    },
  });

  expect(snapshot.metrics.drmLicenseLatencyMs).not.toBeNull();
});
