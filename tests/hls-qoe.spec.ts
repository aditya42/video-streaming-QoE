import { test } from '@playwright/test';
import { runQoePlayback } from '../src/test-runner/run-qoe.js';

const DEFAULT_HLS = 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8';

test('HLS baseline QoE', async ({ page }, testInfo) => {
  await runQoePlayback(page, testInfo, {
    assetUrl: process.env.QOE_ASSET_URL ?? DEFAULT_HLS,
    protocol: 'hls',
    networkProfile: 'browser-default',
  });
});
