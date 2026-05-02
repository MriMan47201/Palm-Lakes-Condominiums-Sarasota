import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Platform } from "react-native";

function getBaseUrl(): string {
  if (Platform.OS === "web") return "/api";
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "https://localhost/api";
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = getBaseUrl();
  const fullPath = `${base}${path}`;

  if (!params) return fullPath;

  const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (filtered.length === 0) return fullPath;

  const qs = filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
  return `${fullPath}?${qs}`;
}

export type Property = {
  id: number;
  parcelId: string;
  address: string;
  ownerName: string;
  mailingAddress?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  landValue?: string | null;
  totalValue?: string | null;
  lotNumber?: string | null;
  updatedAt: string;
};

export type PropertiesResponse = {
  properties: Property[];
  total: number;
  page: number;
  limit: number;
};

export type SyncInfo = {
  lastSyncAt: string | null;
  count: number;
  nextSyncAt: string | null;
};

export type SyncResult = {
  success: boolean;
  message: string;
  count: number;
  syncedAt: string;
};

async function fetchProperties(params: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PropertiesResponse> {
  const url = buildUrl("/properties", {
    search: params.search,
    page: params.page,
    limit: params.limit,
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch properties");
  return response.json();
}

async function fetchLastSync(): Promise<SyncInfo> {
  const url = buildUrl("/properties/last-sync");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch sync info");
  return response.json();
}

async function triggerSync(): Promise<SyncResult> {
  const url = buildUrl("/properties/sync");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error("Sync failed");
  return response.json();
}

export function useProperties(params: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["properties", params],
    queryFn: () => fetchProperties(params),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useSyncInfo() {
  return useQuery({
    queryKey: ["syncInfo"],
    queryFn: fetchLastSync,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useSyncProperties() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["syncInfo"] });
    },
  });
}
