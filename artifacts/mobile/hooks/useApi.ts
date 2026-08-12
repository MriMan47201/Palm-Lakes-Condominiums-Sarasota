/**
 * useApi.ts — device-direct GIS fetch with AsyncStorage cache
 *
 * Properties are fetched directly from Manatee County's public ArcGIS REST API
 * and cached on the device in AsyncStorage.
 *
 * Rules:
 *  - Auto-sync on startup if cache is empty or older than 24 hours.
 *  - Manual "Sync Now" is throttled: blocked if last sync was < 4 hours ago.
 *  - On any fetch failure the existing cached data is preserved and returned.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Storage keys (v2 to avoid collisions with old server-cached data) ─────────
const CACHE_KEY      = "plc_properties_v2";
const SYNC_TS_KEY    = "plc_sync_ts_v2";
const SYNC_COUNT_KEY = "plc_sync_count_v2";

// ── Timing ───────────────────────────────────────────────────────────────────
const MAX_AGE_MS          = 24 * 60 * 60 * 1000; // 24 h — auto-sync threshold
const MIN_SYNC_INTERVAL_MS =  4 * 60 * 60 * 1000; //  4 h — manual sync throttle

// ── GIS endpoint ─────────────────────────────────────────────────────────────
const GIS_BASE   = "https://gis.manateepao.gov/arcgis/rest/services/Website/WebLayers/MapServer/0/query";
const SUBDIV_NAME = "PALM LAKES A CONDOMINIUM";

// ── Pinned entries (not in GIS data) ─────────────────────────────────────────
const PINNED_ENTRIES = [
  {
    parcelId:       "2029601009",
    address:        "7740 31ST ST E",
    ownerName:      "PALM LAKES (Clubhouse)",
    mailingAddress: "PO BOX 21058, SARASOTA, FL, 34276",
    city: "Sarasota", state: "FL", zipCode: "34243",
    landValue: null as string | null,
    totalValue: null as string | null,
    lotNumber: null as string | null,
  },
];

// ── Label overrides ───────────────────────────────────────────────────────────
const LABEL_OVERRIDES: Record<string, string> = {
  "7704 31ST ST E": "PALM LAKES (Lift Station)",
};

// ── Public types ──────────────────────────────────────────────────────────────
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
};

export type SyncResult = {
  success: boolean;
  message: string;
  count: number;
  syncedAt: string;
};

// ── GIS fetch + transform ─────────────────────────────────────────────────────
async function fetchFromGIS(): Promise<{ success: boolean; properties: Omit<Property, "id" | "updatedAt">[]; message: string }> {
  try {
    const params = new URLSearchParams({
      where:             `PAR_SUBDIV_NAME LIKE '${SUBDIV_NAME}%'`,
      outFields:         "PARID,PAR_OWNER_NAME1,PAR_OWNER_NAME2,SITUS_ADDRESS,SITUS_POSTAL_ZIP,PAR_MAIL_ADDR1,PAR_MAIL_CITY,PAR_MAIL_STATE,PAR_MAIL_POSTALCD,CAD_JUST_VALUE,CAD_JUST_LNDVAL,PAR_SUBDIV_LOT",
      f:                 "json",
      resultRecordCount: "500",
    });

    const response = await fetch(`${GIS_BASE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      return { success: false, properties: [], message: `GIS HTTP ${response.status}` };
    }

    const data = await response.json();

    if (data.error) {
      return { success: false, properties: [], message: `GIS error: ${data.error.message}` };
    }
    if (!Array.isArray(data.features) || data.features.length === 0) {
      return { success: false, properties: [], message: "No features returned from GIS" };
    }

    const properties: Omit<Property, "id" | "updatedAt">[] = data.features
      .map((f: { attributes: Record<string, string | null> }) => {
        const a         = f.attributes;
        const owner1    = (a.PAR_OWNER_NAME1 || "").trim();
        const owner2    = (a.PAR_OWNER_NAME2 || "").trim();
        const ownerName = owner2 ? `${owner1} / ${owner2}` : owner1;
        const address   = (a.SITUS_ADDRESS || "").trim();
        const zip       = (a.SITUS_POSTAL_ZIP || "34243").trim();
        const mailAddr  = (a.PAR_MAIL_ADDR1 || "").trim();
        const mailCity  = (a.PAR_MAIL_CITY  || "").trim();
        const mailState = (a.PAR_MAIL_STATE  || "FL").trim();
        const mailZip   = (a.PAR_MAIL_POSTALCD || "").trim();
        const cityLine  = [mailCity, mailState, mailZip].filter(Boolean).join(", ");
        const fullMail  = mailAddr ? (cityLine ? `${mailAddr}, ${cityLine}` : mailAddr) : "";

        return {
          parcelId:       (a.PARID || "").trim(),
          address,
          ownerName:      ownerName || "Unknown Owner",
          mailingAddress: fullMail,
          city:           "Sarasota",
          state:          "FL",
          zipCode:        zip,
          landValue:      a.CAD_JUST_LNDVAL ? String(a.CAD_JUST_LNDVAL) : "",
          totalValue:     a.CAD_JUST_VALUE  ? String(a.CAD_JUST_VALUE)  : "",
          lotNumber:      a.PAR_SUBDIV_LOT  ? String(a.PAR_SUBDIV_LOT)  : "",
        };
      })
      .filter((p: { address: string }) => p.address.length > 0);

    // Apply label overrides
    for (const [address, ownerName] of Object.entries(LABEL_OVERRIDES)) {
      const match = properties.find((p) => p.address === address);
      if (match) match.ownerName = ownerName;
    }

    // Inject pinned entries not already present
    const gisAddresses = new Set(properties.map((p) => p.address));
    for (const entry of PINNED_ENTRIES) {
      if (!gisAddresses.has(entry.address)) properties.push(entry);
    }

    properties.sort((a, b) => a.address.localeCompare(b.address));

    return {
      success: true,
      properties,
      message: `Fetched ${properties.length} properties from Manatee County GIS`,
    };
  } catch (err) {
    return {
      success: false,
      properties: [],
      message: `Fetch error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

// ── AsyncStorage helpers ──────────────────────────────────────────────────────
async function readCachedProperties(): Promise<Property[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Property[];
  } catch {
    return [];
  }
}

async function writeCachedProperties(
  rawProps: Omit<Property, "id" | "updatedAt">[],
  syncedAt: string,
): Promise<Property[]> {
  const properties: Property[] = rawProps.map((p, i) => ({
    ...p,
    id: i + 1,
    updatedAt: syncedAt,
  }));
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(properties));
  await AsyncStorage.setItem(SYNC_TS_KEY, syncedAt);
  await AsyncStorage.setItem(SYNC_COUNT_KEY, String(properties.length));
  return properties;
}

async function readSyncInfo(): Promise<SyncInfo> {
  const [ts, countStr] = await Promise.all([
    AsyncStorage.getItem(SYNC_TS_KEY),
    AsyncStorage.getItem(SYNC_COUNT_KEY),
  ]);
  return {
    lastSyncAt: ts ?? null,
    count: countStr ? parseInt(countStr, 10) : 0,
  };
}

// ── Core sync (used internally by both auto-sync and manual button) ───────────
async function doFetchAndCache(): Promise<SyncResult> {
  const syncedAt = new Date().toISOString();
  const result   = await fetchFromGIS();

  if (result.success && result.properties.length > 0) {
    await writeCachedProperties(result.properties, syncedAt);
    return { success: true, message: result.message, count: result.properties.length, syncedAt };
  }

  // Failure — preserve existing cache, report the problem
  const info = await readSyncInfo();
  return {
    success: false,
    message: result.message || "Could not fetch live data. Using cached data.",
    count: info.count,
    syncedAt: info.lastSyncAt ?? syncedAt,
  };
}

// ── Auto-sync (startup): no throttle, only checks 24 h staleness ──────────────
async function autoSyncIfStale(): Promise<void> {
  // Skip immediately if the device reports as offline — avoids triggering the
  // iOS "Turn Off Airplane Mode" system banner for a fetch that will fail anyway.
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const info = await readSyncInfo();
  const isStale = !info.lastSyncAt || (Date.now() - new Date(info.lastSyncAt).getTime() > MAX_AGE_MS);
  const isEmpty = (await readCachedProperties()).length === 0;
  if (isStale || isEmpty) {
    await doFetchAndCache(); // fire-and-forget, error handled inside
  }
}

// ── Manual sync (Sync Now): enforces 4 h throttle ─────────────────────────────
async function manualSync(): Promise<SyncResult> {
  const info = await readSyncInfo();
  if (info.lastSyncAt) {
    const elapsed   = Date.now() - new Date(info.lastSyncAt).getTime();
    if (elapsed < MIN_SYNC_INTERVAL_MS) {
      const remaining = Math.ceil((MIN_SYNC_INTERVAL_MS - elapsed) / 1000 / 60 / 60);
      return {
        success: false,
        message: `Data was synced recently — try again in ~${remaining}h.`,
        count: info.count,
        syncedAt: info.lastSyncAt,
      };
    }
  }
  return doFetchAndCache();
}

// ── React Query hooks ─────────────────────────────────────────────────────────

export function useProperties(params: { search?: string; page?: number; limit?: number }) {
  const queryClient = useQueryClient();
  const query = useQuery<PropertiesResponse>({
    queryKey: ["properties", params],
    queryFn: async () => {
      // Auto-sync if stale; on error the cached data is unchanged
      await autoSyncIfStale();
      const properties = await readCachedProperties();
      return {
        properties,
        total: properties.length,
        page:  params.page  ?? 1,
        limit: params.limit ?? 500,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // After properties load (which may have auto-synced), refresh the sync status
  // so the status bar timestamp reflects the actual last-sync time from AsyncStorage.
  useEffect(() => {
    if (query.data) {
      queryClient.invalidateQueries({ queryKey: ["syncInfo"] });
    }
  }, [query.data, queryClient]);

  return query;
}

export function useSyncInfo() {
  return useQuery<SyncInfo>({
    queryKey: ["syncInfo"],
    queryFn:  readSyncInfo,
    staleTime: 60 * 1000,
    retry: 1,
  });
}

export function useSyncProperties() {
  const queryClient = useQueryClient();
  return useMutation<SyncResult>({
    mutationFn: manualSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["syncInfo"] });
    },
  });
}
