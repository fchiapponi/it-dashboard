"use client";

import useSWR from "swr";
import type {
  PrinterDTO,
  CameraDTO,
  ServerDTO,
  TrelloListDTO,
} from "@/lib/types";
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

export function useServers() {
  return useSWR<ServerDTO[]>("/api/servers", fetcher, { refreshInterval: 30000 });
}

export function useTrello() {
  return useSWR<TrelloListDTO[]>("/api/trello", fetcher, { refreshInterval: 60000 });
}
