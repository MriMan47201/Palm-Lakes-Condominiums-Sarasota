import { db, propertiesTable, syncLogTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "./logger";

const SUBDIV_NAME = "PALM LAKES A CONDOMINIUM";

const LABEL_OVERRIDES: Record<string, string> = {
  "7704 31ST ST E": "PALM LAKES (Lift Station)",
};
const GIS_BASE =
  "https://gis.manateepao.gov/arcgis/rest/services/Website/WebLayers/MapServer/0/query";

type GISResponse = {
  error?: { message?: string };
  features?: Array<{ attributes: Record<string, string | null> }>;
};

const PINNED_ENTRIES = [
  {
    parcelId: "2029601009",
    address: "7740 31ST ST E",
    ownerName: "PALM LAKES (Clubhouse)",
    mailingAddress: "PO BOX 21058, SARASOTA, FL, 34276",
    city: "Sarasota",
    state: "FL",
    zipCode: "34243",
    landValue: null as string | null,
    totalValue: null as string | null,
  },
];

export async function fetchFromManateeGIS() {
  try {
    const params = new URLSearchParams({
      where: `PAR_SUBDIV_NAME LIKE '${SUBDIV_NAME}%'`,
      outFields:
        "PARID,PAR_OWNER_NAME1,PAR_OWNER_NAME2,SITUS_ADDRESS,SITUS_POSTAL_ZIP,PAR_MAIL_ADDR1,PAR_MAIL_CITY,PAR_MAIL_STATE,PAR_MAIL_POSTALCD,CAD_JUST_VALUE,CAD_JUST_LNDVAL,PAR_SUBDIV_LOT",
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

    const data = await response.json() as GISResponse;

    if (data.error) {
      return {
        success: false,
        properties: [],
        message: `GIS error: ${data.error.message ?? "Unknown GIS error"}`,
      };
    }

    if (!Array.isArray(data.features) || data.features.length === 0) {
      return { success: false, properties: [], message: "No features returned from GIS" };
    }

    const properties = data.features
      .map((f) => {
        const a = f.attributes;
        const owner1 = (a.PAR_OWNER_NAME1 || "").trim();
        const owner2 = (a.PAR_OWNER_NAME2 || "").trim();
        const ownerName = owner2 ? `${owner1} / ${owner2}` : owner1;
        const address = (a.SITUS_ADDRESS || "").trim();
        const zip = (a.SITUS_POSTAL_ZIP || "34243").trim();
        const mailAddr = (a.PAR_MAIL_ADDR1 || "").trim();
        const mailCity = (a.PAR_MAIL_CITY || "").trim();
        const mailState = (a.PAR_MAIL_STATE || "FL").trim();
        const mailZip = (a.PAR_MAIL_POSTALCD || "").trim();
        const mailingCityLine = [mailCity, mailState, mailZip].filter(Boolean).join(", ");
        const fullMailingAddress = mailAddr
          ? mailingCityLine ? `${mailAddr}, ${mailingCityLine}` : mailAddr
          : "";

        return {
          parcelId: (a.PARID || "").trim(),
          address,
          ownerName: ownerName || "Unknown Owner",
          mailingAddress: fullMailingAddress,
          city: "Sarasota",
          state: "FL",
          zipCode: zip,
          landValue: a.CAD_JUST_LNDVAL ? String(a.CAD_JUST_LNDVAL) : "",
          totalValue: a.CAD_JUST_VALUE ? String(a.CAD_JUST_VALUE) : "",
          lotNumber: a.PAR_SUBDIV_LOT ? String(a.PAR_SUBDIV_LOT) : "",
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

export async function doSync() {
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
        lotNumber: p.lotNumber,
      }))
    );
    const gisAddresses = new Set(result.properties.map((p) => p.address));
    const missing = PINNED_ENTRIES.filter((e) => !gisAddresses.has(e.address));
    if (missing.length > 0) {
      await db.insert(propertiesTable).values(missing);
    }
    for (const [address, ownerName] of Object.entries(LABEL_OVERRIDES)) {
      await db
        .update(propertiesTable)
        .set({ ownerName })
        .where(eq(propertiesTable.address, address));
    }
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

export async function shouldSync(): Promise<boolean> {
  const lastSync = await db
    .select({ syncedAt: syncLogTable.syncedAt })
    .from(syncLogTable)
    .orderBy(desc(syncLogTable.syncedAt))
    .limit(1);

  if (lastSync.length === 0) return true;

  const lastSyncTime = new Date(lastSync[0].syncedAt).getTime();
  return Date.now() - lastSyncTime > 24 * 60 * 60 * 1000;
}
