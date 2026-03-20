import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { propertiesTable, syncLogTable } from "@workspace/db";
import { eq, ilike, or, desc, count, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SUBDIVISION_PARCEL_ID = "2029606409";
const MANATEE_GIS_URL = "https://www.mymanatee.org/manateeclerkofcircuitcourt_apps/gis_property_search";

async function fetchFromManateeGIS(): Promise<{
  success: boolean;
  properties: Array<{
    parcelId: string;
    address: string;
    ownerName: string;
    mailingAddress: string;
    city: string;
    state: string;
    zipCode: string;
    landValue: string;
    totalValue: string;
  }>;
  message: string;
}> {
  try {
    const searchUrl = `https://www.mymanatee.org/manateeclerkofcircuitcourt_apps/gis_property_search/api/v1/parcels?subdivision=${SUBDIVISION_PARCEL_ID}&format=json`;

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SubdivisionDirectory/1.0)",
        Accept: "application/json, text/html, */*",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        if (data && Array.isArray(data.parcels) && data.parcels.length > 0) {
          return {
            success: true,
            properties: data.parcels.map((p: Record<string, string>) => ({
              parcelId: p.parcel_id || p.parcelId || "",
              address: p.address || p.situs_address || "",
              ownerName: p.owner_name || p.ownerName || "",
              mailingAddress: p.mailing_address || "",
              city: p.city || "",
              state: p.state || "FL",
              zipCode: p.zip_code || p.zipCode || "",
              landValue: p.land_value || "",
              totalValue: p.total_value || "",
            })),
            message: "Fetched from live GIS API",
          };
        }
      }
    }

    const propertyAppraiserUrl = `https://www.manateepao.gov/property-search/?stype=6&q=${SUBDIVISION_PARCEL_ID}`;
    const paResponse = await fetch(propertyAppraiserUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SubdivisionDirectory/1.0)",
        Accept: "text/html,*/*",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (paResponse.ok) {
      const html = await paResponse.text();
      const properties = parsePropertyAppraiserHTML(html);
      if (properties.length > 0) {
        return { success: true, properties, message: "Fetched from Property Appraiser" };
      }
    }

    return {
      success: false,
      properties: [],
      message: "Could not retrieve live data from GIS sources. Using cached data.",
    };
  } catch (err) {
    logger.error({ err }, "Failed to fetch from Manatee GIS");
    return {
      success: false,
      properties: [],
      message: `Fetch error: ${err instanceof Error ? err.message : "Unknown error"}`,
    };
  }
}

function parsePropertyAppraiserHTML(html: string): Array<{
  parcelId: string;
  address: string;
  ownerName: string;
  mailingAddress: string;
  city: string;
  state: string;
  zipCode: string;
  landValue: string;
  totalValue: string;
}> {
  const properties: Array<{
    parcelId: string;
    address: string;
    ownerName: string;
    mailingAddress: string;
    city: string;
    state: string;
    zipCode: string;
    landValue: string;
    totalValue: string;
  }> = [];

  const parcelPattern = /(\d{4}\d{4}\d{4})/g;
  const addressPattern = /(\d+\s+[A-Z0-9\s]+(?:ST|AVE|DR|RD|LN|CT|WAY|BLVD|CIR|PL|TER|PKWY)[A-Z\s]*)/gi;
  const ownerPattern = /([A-Z]+(?:\s+[A-Z]+){1,4})\s*(?:TRUST|LLC|INC|CORP|REV)?/g;

  const parcels = html.match(parcelPattern) || [];
  const addresses = html.match(addressPattern) || [];

  for (let i = 0; i < Math.min(parcels.length, addresses.length, 120); i++) {
    ownerPattern.lastIndex = 0;
    const ownerMatch = ownerPattern.exec(html);
    properties.push({
      parcelId: parcels[i] || "",
      address: addresses[i] || "",
      ownerName: ownerMatch ? ownerMatch[0].trim() : "Unknown Owner",
      mailingAddress: "",
      city: "Sarasota",
      state: "FL",
      zipCode: "34243",
      landValue: "",
      totalValue: "",
    });
  }

  return properties;
}

async function shouldSync(): Promise<boolean> {
  const lastSync = await db
    .select({ syncedAt: syncLogTable.syncedAt })
    .from(syncLogTable)
    .orderBy(desc(syncLogTable.syncedAt))
    .limit(1);

  if (lastSync.length === 0) return true;

  const lastSyncTime = new Date(lastSync[0].syncedAt).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return Date.now() - lastSyncTime > oneDayMs;
}

router.get("/properties", async (req, res) => {
  try {
    if (await shouldSync()) {
      syncPropertiesInBackground();
    }

    const search = (req.query.search as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
    const offset = (page - 1) * limit;

    let query = db
      .select()
      .from(propertiesTable)
      .orderBy(propertiesTable.address)
      .$dynamic();

    let countQuery = db
      .select({ count: count() })
      .from(propertiesTable)
      .$dynamic();

    if (search) {
      const searchFilter = or(
        ilike(propertiesTable.ownerName, `%${search}%`),
        ilike(propertiesTable.address, `%${search}%`)
      );
      query = query.where(searchFilter);
      countQuery = countQuery.where(searchFilter);
    }

    const [properties, totalResult] = await Promise.all([
      query.limit(limit).offset(offset),
      countQuery,
    ]);

    const total = totalResult[0]?.count ?? 0;

    res.json({
      properties: properties.map((p) => ({
        id: p.id,
        parcelId: p.parcelId,
        address: p.address,
        ownerName: p.ownerName,
        mailingAddress: p.mailingAddress,
        city: p.city,
        state: p.state,
        zipCode: p.zipCode,
        landValue: p.landValue,
        totalValue: p.totalValue,
        updatedAt: p.updatedAt?.toISOString(),
      })),
      total,
      page,
      limit,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get properties");
    res.status(500).json({ error: "Failed to get properties" });
  }
});

async function syncPropertiesInBackground() {
  try {
    const result = await fetchFromManateeGIS();

    if (result.success && result.properties.length > 0) {
      await db.delete(propertiesTable);
      await db.insert(propertiesTable).values(
        result.properties.map((p) => ({
          parcelId: p.parcelId,
          address: p.address,
          ownerName: p.ownerName,
          mailingAddress: p.mailingAddress,
          city: p.city,
          state: p.state,
          zipCode: p.zipCode,
          landValue: p.landValue,
          totalValue: p.totalValue,
        }))
      );
      await db.insert(syncLogTable).values({
        count: result.properties.length,
        success: "true",
        message: result.message,
      });
      logger.info({ count: result.properties.length }, "Properties synced successfully");
    } else {
      await db.insert(syncLogTable).values({
        count: 0,
        success: "false",
        message: result.message,
      });
    }
  } catch (err) {
    logger.error({ err }, "Background sync failed");
  }
}

router.post("/properties/sync", async (req, res) => {
  try {
    const result = await fetchFromManateeGIS();

    if (result.success && result.properties.length > 0) {
      await db.delete(propertiesTable);
      await db.insert(propertiesTable).values(
        result.properties.map((p) => ({
          parcelId: p.parcelId,
          address: p.address,
          ownerName: p.ownerName,
          mailingAddress: p.mailingAddress,
          city: p.city,
          state: p.state,
          zipCode: p.zipCode,
          landValue: p.landValue,
          totalValue: p.totalValue,
        }))
      );
      await db.insert(syncLogTable).values({
        count: result.properties.length,
        success: "true",
        message: result.message,
      });

      res.json({
        success: true,
        message: `Synced ${result.properties.length} properties`,
        count: result.properties.length,
        syncedAt: new Date().toISOString(),
      });
    } else {
      await db.insert(syncLogTable).values({
        count: 0,
        success: "false",
        message: result.message,
      });

      const existing = await db.select({ count: count() }).from(propertiesTable);
      res.json({
        success: false,
        message: result.message,
        count: existing[0]?.count ?? 0,
        syncedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    req.log.error({ err }, "Sync failed");
    res.status(500).json({
      success: false,
      message: "Sync failed",
      count: 0,
      syncedAt: new Date().toISOString(),
    });
  }
});

router.get("/properties/last-sync", async (req, res) => {
  try {
    const lastSync = await db
      .select()
      .from(syncLogTable)
      .orderBy(desc(syncLogTable.syncedAt))
      .limit(1);

    const propertyCount = await db.select({ count: count() }).from(propertiesTable);

    const lastSyncAt = lastSync[0]?.syncedAt?.toISOString() ?? null;
    let nextSyncAt: string | null = null;

    if (lastSyncAt) {
      const nextDate = new Date(lastSyncAt);
      nextDate.setDate(nextDate.getDate() + 1);
      nextSyncAt = nextDate.toISOString();
    }

    res.json({
      lastSyncAt,
      count: propertyCount[0]?.count ?? 0,
      nextSyncAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get last sync");
    res.status(500).json({ lastSyncAt: null, count: 0, nextSyncAt: null });
  }
});

export default router;
