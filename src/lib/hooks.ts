"use client";

import useSWR from "swr";
import type { PrinterDTO, CameraDTO, CalendarEventDTO, CalendarStatusDTO } from "@/lib/types";
import type { AccessPointDTO } from "@/lib/meraki";

const fetcher = (url: string) =>
  fetch(url).then(async (res) => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Request error");
    return res.json();
  });

export function usePrinters() {
  return useSWR<PrinterDTO[]>("/api/printers", fetcher, { refreshInterval: 30000 });
}

export function useCameras() {
  return useSWR<CameraDTO[]>("/api/cameras", fetcher, { refreshInterval: 30000 });
}

export function useAccessPoints() {
  return useSWR<AccessPointDTO[]>("/api/access-points", fetcher, { refreshInterval: 30000 });
}

export function useCalendarStatus() {
  return useSWR<CalendarStatusDTO>("/api/calendar/status", fetcher, { refreshInterval: 60000 });
}

export function useCalendarEvents(enabled: boolean) {
  return useSWR<CalendarEventDTO[]>(enabled ? "/api/calendar/events" : null, fetcher, {
    refreshInterval: 60000,
  });
}
