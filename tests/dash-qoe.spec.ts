import { test } from '@playwright/test';
import { runQoePlayback } from '../src/test-runner/run-qoe.js';

const DEFAULT_DASH = 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd';

test('MPEG-DASH baseline QoE', async ({ page }, testInfo) => {
  await runQoePlayback(page, testInfo, {
    assetUrl: process.env.QOE_ASSET_URL ?? DEFAULT_DASH,
    protocol: 'dash',
    networkProfile: 'browser-default',
  });
});
