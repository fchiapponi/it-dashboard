export interface ServerConfig {
  name: string;
  ipAddress: string;
}

export interface AccessPointConfig {
  name: string;
  ipAddress: string;
}

export interface CameraConfig {
  name: string;
  protocol: "onvif" | "rtsp" | "mjpeg";
  host: string;
  location?: string;
  port?: number;
  rtspPath?: string;
  snapshotUrl?: string;
  username?: string;
  password?: string;
}

// Single source of truth for monitored cameras and servers (printers are
// managed in the inventory instead): edit this file and restart
// the app (or wait for the next redeploy) to add/remove one. No management
// UI — the database is synced against this file on startup (see
// src/lib/device-sync.ts).

export const CAMERAS: CameraConfig[] = [
  { name: "172.30.1.25", protocol: "onvif", host: "172.30.1.25" },
  { name: "172.30.1.241", protocol: "onvif", host: "172.30.1.241" },
  { name: "172.30.1.242", protocol: "onvif", host: "172.30.1.242" },
  { name: "172.30.1.243", protocol: "onvif", host: "172.30.1.243" },
  { name: "172.30.1.244", protocol: "onvif", host: "172.30.1.244" },
  { name: "172.30.1.245", protocol: "onvif", host: "172.30.1.245" },
  { name: "172.30.1.246", protocol: "onvif", host: "172.30.1.246" },
  { name: "172.30.1.247", protocol: "onvif", host: "172.30.1.247" },
  { name: "172.30.1.248", protocol: "onvif", host: "172.30.1.248" },
  { name: "172.30.1.249", protocol: "onvif", host: "172.30.1.249" },
  { name: "172.30.1.250", protocol: "onvif", host: "172.30.1.250" },
  { name: "172.30.1.251", protocol: "onvif", host: "172.30.1.251" },
  { name: "172.30.1.253", protocol: "onvif", host: "172.30.1.253" },
  { name: "172.30.1.254", protocol: "onvif", host: "172.30.1.254" },
  { name: "172.30.2.251", protocol: "onvif", host: "172.30.2.251" },
  { name: "172.30.3.249", protocol: "onvif", host: "172.30.3.249" },
  { name: "172.30.3.250", protocol: "onvif", host: "172.30.3.250" },
  { name: "172.30.3.251", protocol: "onvif", host: "172.30.3.251" },
  { name: "172.30.3.252", protocol: "onvif", host: "172.30.3.252" },
  { name: "172.30.3.253", protocol: "onvif", host: "172.30.3.253" },
  { name: "172.30.3.254", protocol: "onvif", host: "172.30.3.254" },
  { name: "172.30.4.243", protocol: "onvif", host: "172.30.4.243" },
  { name: "172.30.4.244", protocol: "onvif", host: "172.30.4.244" },
  { name: "172.30.4.247", protocol: "onvif", host: "172.30.4.247" },
  { name: "172.30.4.248", protocol: "onvif", host: "172.30.4.248" },
  { name: "172.30.4.249", protocol: "onvif", host: "172.30.4.249" },
  { name: "172.30.4.250", protocol: "onvif", host: "172.30.4.250" },
  { name: "172.30.4.252", protocol: "onvif", host: "172.30.4.252" },
  { name: "172.30.4.254", protocol: "onvif", host: "172.30.4.254" },
  { name: "172.30.6.210", protocol: "onvif", host: "172.30.6.210" },
  { name: "172.30.6.247", protocol: "onvif", host: "172.30.6.247" },
  { name: "172.30.6.248", protocol: "onvif", host: "172.30.6.248" },
  { name: "172.30.6.249", protocol: "onvif", host: "172.30.6.249" },
  { name: "172.30.6.250", protocol: "onvif", host: "172.30.6.250" },
  { name: "172.30.6.251", protocol: "onvif", host: "172.30.6.251" },
  { name: "172.30.6.252", protocol: "onvif", host: "172.30.6.252" },
  { name: "172.30.6.253", protocol: "onvif", host: "172.30.6.253" },
  { name: "172.30.6.254", protocol: "onvif", host: "172.30.6.254" },
  { name: "172.30.7.251", protocol: "onvif", host: "172.30.7.251" },
  { name: "172.30.7.252", protocol: "onvif", host: "172.30.7.252" },
  { name: "172.30.7.253", protocol: "onvif", host: "172.30.7.253" },
  { name: "172.30.8.251", protocol: "onvif", host: "172.30.8.251" },
  { name: "172.30.8.252", protocol: "onvif", host: "172.30.8.252" },
  { name: "172.30.8.253", protocol: "onvif", host: "172.30.8.253" },
  { name: "172.30.9.250", protocol: "onvif", host: "172.30.9.250" },
  { name: "172.30.9.251", protocol: "onvif", host: "172.30.9.251" },
  { name: "172.30.9.252", protocol: "onvif", host: "172.30.9.252" },
  { name: "172.30.9.253", protocol: "onvif", host: "172.30.9.253" },
  { name: "172.30.9.254", protocol: "onvif", host: "172.30.9.254" },
  { name: "172.30.10.251", protocol: "onvif", host: "172.30.10.251" },
  { name: "172.30.10.252", protocol: "onvif", host: "172.30.10.252" },
  { name: "172.30.13.251", protocol: "onvif", host: "172.30.13.251" },
  { name: "172.30.15.250", protocol: "onvif", host: "172.30.15.250" },
  { name: "172.30.15.251", protocol: "onvif", host: "172.30.15.251" },
  { name: "172.30.15.252", protocol: "onvif", host: "172.30.15.252" },
  { name: "172.30.15.253", protocol: "onvif", host: "172.30.15.253" },
  { name: "172.30.15.254", protocol: "onvif", host: "172.30.15.254" },
  { name: "172.30.18.210", protocol: "onvif", host: "172.30.18.210" },
  { name: "172.30.18.251", protocol: "onvif", host: "172.30.18.251" },
  { name: "172.30.18.252", protocol: "onvif", host: "172.30.18.252" },
  { name: "172.30.18.253", protocol: "onvif", host: "172.30.18.253" },
  { name: "172.30.18.254", protocol: "onvif", host: "172.30.18.254" },
  { name: "172.30.22.240", protocol: "onvif", host: "172.30.22.240" },
  { name: "172.30.22.241", protocol: "onvif", host: "172.30.22.241" },
  { name: "172.30.22.250", protocol: "onvif", host: "172.30.22.250" },
  { name: "172.30.22.251", protocol: "onvif", host: "172.30.22.251" },
  { name: "172.30.22.252", protocol: "onvif", host: "172.30.22.252" },
  { name: "172.30.22.253", protocol: "onvif", host: "172.30.22.253" },
  { name: "172.30.25.250", protocol: "onvif", host: "172.30.25.250" },
  { name: "172.30.25.251", protocol: "onvif", host: "172.30.25.251" },
  { name: "172.30.25.252", protocol: "onvif", host: "172.30.25.252" },
  { name: "172.30.25.253", protocol: "onvif", host: "172.30.25.253" },
  { name: "172.30.25.254", protocol: "onvif", host: "172.30.25.254" },
  { name: "172.30.26.251", protocol: "onvif", host: "172.30.26.251" },
  { name: "172.30.26.252", protocol: "onvif", host: "172.30.26.252" },
  { name: "172.30.26.253", protocol: "onvif", host: "172.30.26.253" },
  { name: "172.30.27.251", protocol: "onvif", host: "172.30.27.251" },
  { name: "172.30.27.252", protocol: "onvif", host: "172.30.27.252" },
  { name: "172.30.27.253", protocol: "onvif", host: "172.30.27.253" },
  { name: "172.30.27.254", protocol: "onvif", host: "172.30.27.254" },
  { name: "172.30.28.251", protocol: "onvif", host: "172.30.28.251" },
  { name: "172.30.28.252", protocol: "onvif", host: "172.30.28.252" },
  { name: "172.30.29.251", protocol: "onvif", host: "172.30.29.251" },
  { name: "172.30.29.252", protocol: "onvif", host: "172.30.29.252" },
  { name: "172.30.30.252", protocol: "onvif", host: "172.30.30.252" },
  { name: "172.30.33.244", protocol: "onvif", host: "172.30.33.244" },
  { name: "172.30.33.245", protocol: "onvif", host: "172.30.33.245" },
  { name: "172.30.33.246", protocol: "onvif", host: "172.30.33.246" },
  { name: "172.30.33.247", protocol: "onvif", host: "172.30.33.247" },
  { name: "172.30.33.248", protocol: "onvif", host: "172.30.33.248" },
  { name: "172.30.33.250", protocol: "onvif", host: "172.30.33.250" },
];

export const SERVERS: ServerConfig[] = [
  { name: "172.28.0.35", ipAddress: "172.28.0.35" },
  { name: "172.25.2.41", ipAddress: "172.25.2.41" },
  { name: "172.28.0.22", ipAddress: "172.28.0.22" },
  { name: "172.25.2.45", ipAddress: "172.25.2.45" },
  { name: "172.25.201.200", ipAddress: "172.25.201.200" },
];

// Only used when the Meraki API is unreachable: these get pinged instead.
// While the API works, the AP list comes from Meraki.
export const ACCESS_POINTS: AccessPointConfig[] = [];
