import type { CDPSession, Page } from '@playwright/test';
import type { NetworkProfile } from './profiles.js';

function bytesPerSecond(kbps: number): number {
  return kbps <= 0 ? -1 : Math.floor((kbps * 1000) / 8);
}

export class NetworkController {
  private cdp?: CDPSession;

  constructor(private readonly page: Page) {}

  async initialize(): Promise<void> {
    if (this.page.context().browser()?.browserType().name() !== 'chromium') return;
    this.cdp = await this.page.context().newCDPSession(this.page);
    await this.cdp.send('Network.enable');
  }

  async apply(profile: NetworkProfile): Promise<void> {
    if (!this.cdp) return;
    const condition = {
      latency: profile.latencyMs,
      downloadThroughput: bytesPerSecond(profile.downloadKbps),
      uploadThroughput: bytesPerSecond(profile.uploadKbps),
      connectionType: profile.connectionType ?? 'none',
    };

    // Prefer the newer CDP split APIs; fall back for Chrome versions where they
    // are unavailable. Packet loss is passed only when explicitly requested.
    try {
      await this.cdp.send('Network.emulateNetworkConditionsByRule', {
        offline: Boolean(profile.offline),
        matchedNetworkConditions: [{
          urlPattern: '',
          ...condition,
          ...(profile.packetLossPercent != null ? { packetLoss: profile.packetLossPercent } : {}),
        }],
      });
      await this.cdp.send('Network.overrideNetworkState', {
        offline: Boolean(profile.offline),
        ...condition,
      });
    } catch {
      await this.cdp.send('Network.emulateNetworkConditions', {
        offline: Boolean(profile.offline),
        ...condition,
        ...(profile.packetLossPercent != null ? { packetLoss: profile.packetLossPercent } : {}),
      });
    }
  }

  async clear(): Promise<void> {
    if (!this.cdp) return;
    await this.apply({ name: 'clear', latencyMs: 0, downloadKbps: -1, uploadKbps: -1, connectionType: 'none' });
  }

  async close(): Promise<void> {
    await this.cdp?.detach();
    this.cdp = undefined;
  }
}
