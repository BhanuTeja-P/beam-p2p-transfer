// ─── Constants ───────────────────────────────────────────────────────────────
export const CHUNK_SIZE = 16 * 1024; // 16 KB
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:3001`;

// ─── ICE Servers (STUN/TURN) ──────────────────────────────────────────────────
const envIceServers = import.meta.env.VITE_ICE_SERVERS;
export const ICE_SERVERS: RTCIceServer[] = envIceServers
  ? JSON.parse(envIceServers)
  : [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type ConnectionStatus =
  | "idle"
  | "creating"
  | "waiting"
  | "connecting"
  | "connected"
  | "transferring"
  | "complete"
  | "error";

export interface TransferStats {
  fileName: string;
  fileSize: number;
  fileType: string;
  transferred: number;
  speed: number;
  progress: number;
  startTime: number;
  elapsedTime: number;
}
