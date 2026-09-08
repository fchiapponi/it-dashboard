export interface PrinterSupplyDTO {
  id: string;
  name: string;
  type: string;
  levelPercent: number | null;
  currentLevel: number | null;
  maxCapacity: number | null;
  unit: string | null;
}

export interface PrinterDTO {
  id: string;
  name: string;
  location: string | null;
  ipAddress: string;
  model: string | null;
  status: "online" | "offline" | "error" | "unknown";
  lastPolledAt: string | null;
  lastError: string | null;
  supplies: PrinterSupplyDTO[];
}

export interface CameraDTO {
  id: string;
  name: string;
  location: string | null;
  protocol: "onvif" | "rtsp" | "mjpeg";
  host: string;
  port: number;
  rtspPath: string | null;
  snapshotUrl: string | null;
  username: string | null;
  status: "online" | "offline" | "error" | "unknown";
  lastSeenAt: string | null;
  lastError: string | null;
}

export interface ServerDTO {
  id: string;
  name: string;
  ipAddress: string;
  status: "online" | "offline" | "unknown";
  lastSeenAt: string | null;
  lastError: string | null;
}

export interface CalendarEventDTO {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  attendees?: string[];
}

export interface CalendarStatusDTO {
  connected: boolean;
  email?: string;
}
