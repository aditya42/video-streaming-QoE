export type Protocol = 'hls' | 'dash' | 'progressive' | 'unknown';
export type DrmSystem = 'widevine' | 'playready' | 'fairplay';

export interface DrmConfig {
  keySystem: DrmSystem;
  licenseUrl: string;
  certificateUrl?: string;
}

export interface QoeStartConfig {
  assetUrl: string;
  protocol: Protocol;
  networkProfile?: string;
  drm?: DrmConfig;
}

export interface QoeMetrics {
  startupTimeMs: number | null;
  timeToFirstFrameMs: number | null;
  rebufferingCount: number;
  rebufferingDurationMs: number;
  rebufferingRatio: number;
  currentBitrateKbps: number | null;
  estimatedBandwidthKbps: number | null;
  abrTransitionCount: number;
  droppedFrames: number;
  totalVideoFrames: number;
  droppedFrameRatio: number;
  frameRate: number | null;
  resolution: string | null;
  avSyncMs: number | null;
  playbackFailures: number;
  networkErrorCount: number;
  drmLicenseLatencyMs: number | null;
  currentTimeSec: number;
  bufferedAheadSec: number;
}

export interface QoeSnapshot {
  config: QoeStartConfig;
  state: string;
  metrics: QoeMetrics;
  events: Array<Record<string, unknown>>;
  capabilities: Record<string, unknown>;
  playbackFailures: Array<Record<string, unknown>>;
  networkErrors: Array<Record<string, unknown>>;
}
