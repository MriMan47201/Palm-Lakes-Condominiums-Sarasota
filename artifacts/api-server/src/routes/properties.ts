import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { propertiesTable, syncLogTable } from "@workspace/db";
import { ilike, or, desc, count } from "drizzle-orm";
import { logger } from "../lib/logger";
import { doSync, shouldSync } from "../lib/sync";

const router: IRouter = Router();

router.get("/properties", async (req, res) => {
  try {
    if (await shouldSync()) {
      doSync().catch((err) => logger.error({ err }, "Background sync failed"));
    }

    const search = (req.query.search as string) || "";
    const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
    const limit = Math.min(500, Math.max(1, parseInt((req.query.limit as string) || "50", 10)));
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
        lotNumber: p.lotNumber,
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
