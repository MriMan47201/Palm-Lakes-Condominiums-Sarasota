import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { propertiesTable, syncLogTable } from "@workspace/db";
import { eq, ilike, or, desc, count, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SUBDIV_NAME = "PALM LAKES A CONDOMINIUM";
const GIS_BASE = "https://gis.manateepao.gov/arcgis/rest/services/Website/WebLayers/MapServer/0/query";

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
    const params = new URLSearchParams({
      where: `PAR_SUBDIV_NAME LIKE '${SUBDIV_NAME}%'`,
      outFields: "PARID,PAR_OWNER_NAME1,PAR_OWNER_NAME2,SITUS_ADDRESS,SITUS_POSTAL_ZIP,PAR_MAIL_ADDR1,PAR_MAIL_CITY,PAR_MAIL_STATE,CAD_JUST_VALUE,CAD_JUST_LNDVAL",
      f: "json",
      resultRecordCount: "500",
    });

    const response = await fetch(`${GIS_BASE}?${params.toString()}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SubdivisionDirectory/1.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30000),
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

    const properties = data.features
      .map((f: { attributes: Record<string, string | null> }) => {
        const a = f.attributes;
        const owner1 = (a.PAR_OWNER_NAME1 || "").trim();
        const owner2 = (a.PAR_OWNER_NAME2 || "").trim();
        const ownerName = owner2 ? `${owner1} / ${owner2}` : owner1;
        const address = (a.SITUS_ADDRESS || "").trim();
        const zip = (a.SITUS_POSTAL_ZIP || "34243").trim();
        const mailAddr = (a.PAR_MAIL_ADDR1 || "").trim();
        const mailCity = (a.PAR_MAIL_CITY || "").trim();
        const mailState = (a.PAR_MAIL_STATE || "FL").trim();

        return {
          parcelId: (a.PARID || "").trim(),
          address,
          ownerName: ownerName || "Unknown Owner",
          mailingAddress: mailAddr,
          city: mailCity || "Sarasota",
          state: mailState || "FL",
          zipCode: zip,
          landValue: a.CAD_JUST_LNDVAL ? String(a.CAD_JUST_LNDVAL) : "",
          totalValue: a.CAD_JUST_VALUE ? String(a.CAD_JUST_VALUE) : "",
        };
      })
      .filter((p: { address: string }) => p.address.length > 0)
      .sort((a: { address: string }, b: { address: string }) => a.address.localeCompare(b.address));

    return {
      success: true,
      properties,
      message: `Fetched ${properties.length} properties from Manatee County GIS`,
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

async function doSync() {
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
    logger.warn({ message: result.message }, "Sync returned no properties");
  }

  return result;
}

router.get("/properties", async (req, res) => {
  try {
    if (await shouldSync()) {
      doSync().catch((err) => logger.error({ err }, "Background sync failed"));
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

router.post("/properties/sync", async (req, res) => {
  try {
    const result = await doSync();

    if (result.success && result.properties.length > 0) {
      res.json({
        success: true,
        message: `Synced ${result.properties.length} properties`,
        count: result.properties.length,
        syncedAt: new Date().toISOString(),
      });
    } else {
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
