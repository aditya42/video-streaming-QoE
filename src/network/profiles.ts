export interface NetworkProfile {
  name: string;
  offline?: boolean;
  latencyMs: number;
  downloadKbps: number;
  uploadKbps: number;
  connectionType?: 'wifi' | 'cellular2g' | 'cellular3g' | 'cellular4g' | 'none';
  packetLossPercent?: number;
}

export const NETWORK_PROFILES: Record<string, NetworkProfile> = {
  wifi: { name: 'wifi', latencyMs: 20, downloadKbps: 30_000, uploadKbps: 10_000, connectionType: 'wifi' },
  '4g': { name: '4g', latencyMs: 80, downloadKbps: 10_000, uploadKbps: 3_000, connectionType: 'cellular4g' },
  '3g': { name: '3g', latencyMs: 180, downloadKbps: 1_500, uploadKbps: 750, connectionType: 'cellular3g' },
  edge: { name: 'edge', latencyMs: 400, downloadKbps: 250, uploadKbps: 100, connectionType: 'cellular2g' },
  offline: { name: 'offline', offline: true, latencyMs: 0, downloadKbps: 0, uploadKbps: 0, connectionType: 'none' },
  'variable-high': { name: 'variable-high', latencyMs: 50, downloadKbps: 8_000, uploadKbps: 2_000, connectionType: 'cellular4g' },
  'variable-low': { name: 'variable-low', latencyMs: 220, downloadKbps: 900, uploadKbps: 300, connectionType: 'cellular3g' },
};
