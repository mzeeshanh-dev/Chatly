import { NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { adminHandler } from "@/lib/admin/auth";
import { ADMIN_ANALYTICS_TAG, ADMIN_DASHBOARD_REVALIDATE_SECONDS } from "@/lib/admin/cache";
import { adminDb } from "@/lib/firebase-admin";

type VercelDimension = "total" | "country" | "path" | "device" | "browser" | "os";
type VercelRow = {
  country?: string;
  requestPath?: string;
  route?: string;
  deviceType?: string;
  browserName?: string;
  osName?: string;
  pageviews?: number;
  visits?: number;
  visitors?: number;
  count?: number;
  value?: number;
  total?: number;
};
type Breakdown = { key: string; label: string; visitors: number; pageviews: number };
type AnalyticsDay = {
  dateKey: string;
  date: string;
  visitors: number;
  pageviews: number;
  countries: Breakdown[];
  devices: Breakdown[];
  browsers: Breakdown[];
  operatingSystems: Breakdown[];
  pages: Breakdown[];
  syncedAt: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_COLLECTION = "adminAnalyticsDaily";
const META_COLLECTION = "adminAnalyticsMeta";
const SYNC_DOC = "vercelLast30Days";
const API_URL = process.env.VERCEL_ANALYTICS_API_URL || "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";
const VERCEL_LIMIT = Math.min(Number(process.env.VERCEL_ANALYTICS_LIMIT || 100), 100);
const LIVE_SYNC_DAYS = Math.min(Math.max(Number(process.env.ADMIN_ANALYTICS_SYNC_DAYS || 30), 1), 30);
const SYNC_CONCURRENCY = Math.min(Math.max(Number(process.env.ADMIN_ANALYTICS_SYNC_CONCURRENCY || 3), 1), 5);

const dimensionByParam: Record<Exclude<VercelDimension, "total">, string> = {
  country: "country",
  path: "requestPath",
  device: "deviceType",
  browser: "browserName",
  os: "osName",
};

const countryNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const toDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const dateKeyToDate = (dateKey: string) => startOfDay(new Date(`${dateKey}T00:00:00`));
const hasVercelEnv = () => Boolean((process.env.VERCEL_API_TOKEN || process.env.VERCEL_ACCESS_TOKEN) && process.env.VERCEL_PROJECT_ID);

function readPageviews(row: VercelRow) {
  return [row.pageviews, row.visits, row.count, row.value, row.total].find((value) => typeof value === "number") || 0;
}

function readVisitors(row: VercelRow) {
  return typeof row.visitors === "number" ? row.visitors : readPageviews(row);
}

function normalizeCountry(value?: string) {
  const country = (value || "").trim();
  if (!country) return "Unknown";
  if (/^[A-Z]{2}$/i.test(country)) return countryNames?.of(country.toUpperCase()) || country.toUpperCase();
  return country;
}

function getDimensionValue(row: VercelRow, dimension: Exclude<VercelDimension, "total">) {
  if (dimension === "country") return { key: row.country || "Unknown", label: normalizeCountry(row.country) };
  if (dimension === "path") return { key: row.requestPath || row.route || "/", label: row.requestPath || row.route || "/" };
  if (dimension === "device") return { key: row.deviceType || "Unknown", label: row.deviceType || "Unknown" };
  if (dimension === "browser") return { key: row.browserName || "Unknown", label: row.browserName || "Unknown" };
  return { key: row.osName || "Unknown", label: row.osName || "Unknown" };
}

function toBreakdowns(rows: VercelRow[], dimension: Exclude<VercelDimension, "total">): Breakdown[] {
  return rows
    .map((row) => {
      const value = getDimensionValue(row, dimension);
      return { key: value.key, label: value.label, visitors: readVisitors(row), pageviews: readPageviews(row) };
    })
    .filter((row) => row.visitors > 0 || row.pageviews > 0)
    .sort((a, b) => b.visitors - a.visitors);
}

function getLiveDateKeys() {
  const end = startOfDay(new Date());
  const start = addDays(end, -(LIVE_SYNC_DAYS - 1));
  const keys: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) keys.push(toDateKey(cursor));
  return keys;
}

function isEmptyDay(day: Partial<AnalyticsDay>) {
  return !day.visitors && !day.pageviews && !day.countries?.length && !day.devices?.length && !day.browsers?.length && !day.operatingSystems?.length && !day.pages?.length;
}

async function runConcurrent<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchVercelRows(dateKey: string, dimension: VercelDimension): Promise<VercelRow[]> {
  const token = process.env.VERCEL_API_TOKEN || process.env.VERCEL_ACCESS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return [];

  const start = dateKeyToDate(dateKey);
  const params = new URLSearchParams({
    projectId,
    since: start.toISOString(),
    until: endOfDay(start).toISOString(),
    limit: String(VERCEL_LIMIT),
  });

  params.append("by", dimension === "total" ? "day" : dimensionByParam[dimension]);
  if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);
  if (process.env.VERCEL_TEAM_SLUG) params.set("slug", process.env.VERCEL_TEAM_SLUG);

  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Vercel analytics request failed: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as { data?: VercelRow[] };
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchDailyAnalytics(dateKey: string): Promise<AnalyticsDay> {
  const [totalRows, countries, devices, browsers, operatingSystems, pages] = await Promise.all([
    fetchVercelRows(dateKey, "total"),
    fetchVercelRows(dateKey, "country"),
    fetchVercelRows(dateKey, "device"),
    fetchVercelRows(dateKey, "browser"),
    fetchVercelRows(dateKey, "os"),
    fetchVercelRows(dateKey, "path"),
  ]);

  const total = totalRows[0] || {};
  return {
    dateKey,
    date: dateKeyToDate(dateKey).toISOString(),
    visitors: readVisitors(total),
    pageviews: readPageviews(total),
    countries: toBreakdowns(countries, "country"),
    devices: toBreakdowns(devices, "device"),
    browsers: toBreakdowns(browsers, "browser"),
    operatingSystems: toBreakdowns(operatingSystems, "os"),
    pages: toBreakdowns(pages, "path"),
    syncedAt: new Date().toISOString(),
  };
}

async function getSyncStatus() {
  if (!hasVercelEnv()) return { synced: false, reason: "missing-vercel-env" };
  const snap = await adminDb.collection(META_COLLECTION).doc(SYNC_DOC).get();
  return snap.exists ? snap.data() : { synced: false, reason: "ready" };
}

async function syncLatestAnalytics() {
  if (!hasVercelEnv()) return { synced: false, reason: "missing-vercel-env" };

  const keys = getLiveDateKeys();
  const existingSnaps = await adminDb.getAll(...keys.map((key) => adminDb.collection(DAILY_COLLECTION).doc(key)));
  const existing = new Map(existingSnaps.filter((snap) => snap.exists).map((snap) => [snap.id, snap.data() as AnalyticsDay]));
  const keysToSync = keys.filter((key) => !existing.has(key) || isEmptyDay(existing.get(key) || {}));
  const skippedDays = keys.length - keysToSync.length;
  let syncedDays = 0;
  let emptyDays = 0;

  await adminDb.collection(META_COLLECTION).doc(SYNC_DOC).set({
    status: "syncing",
    reason: "syncing",
    queuedDays: keysToSync.length,
    skippedDays,
    startedAt: new Date().toISOString(),
  }, { merge: true });

  try {
    const results = await runConcurrent(keysToSync, SYNC_CONCURRENCY, async (key) => {
      const daily = await fetchDailyAnalytics(key);
      if (isEmptyDay(daily)) {
        return "empty";
      }
      await adminDb.collection(DAILY_COLLECTION).doc(key).set(daily, { merge: false });
      return "synced";
    });

    syncedDays = results.filter((result) => result === "synced").length;
    emptyDays = results.filter((result) => result === "empty").length;

    const status = {
      synced: true,
      status: "complete",
      reason: keysToSync.length ? "sync-complete" : "cache-hit",
      queuedDays: keysToSync.length,
      skippedDays,
      syncedDays,
      emptyDays,
      lastSyncedAt: new Date().toISOString(),
    };
    await adminDb.collection(META_COLLECTION).doc(SYNC_DOC).set(status, { merge: true });
    return status;
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "Unknown analytics sync error";
    const status = { synced: false, status: "error", reason: "sync-error", lastError, lastSyncedAt: new Date().toISOString() };
    await adminDb.collection(META_COLLECTION).doc(SYNC_DOC).set(status, { merge: true });
    return status;
  }
}

function mergeBreakdown(map: Map<string, Breakdown>, rows: Breakdown[]) {
  rows.forEach((row) => {
    const existing = map.get(row.key) || { ...row, visitors: 0, pageviews: 0 };
    existing.visitors += row.visitors;
    existing.pageviews += row.pageviews;
    map.set(row.key, existing);
  });
}

function withPercentages(rows: Breakdown[]) {
  const total = rows.reduce((sum, row) => sum + row.visitors, 0) || 1;
  return rows
    .map((row) => ({ ...row, percentage: Math.round((row.visitors / total) * 1000) / 10 }))
    .sort((a, b) => b.visitors - a.visitors);
}

const getCachedAnalyticsDashboard = unstable_cache(
  async () => {
    const snap = await adminDb.collection(DAILY_COLLECTION).orderBy("dateKey", "asc").get();
    const days = snap.docs.map((doc) => doc.data() as AnalyticsDay);
    const countryMap = new Map<string, Breakdown>();
    const deviceMap = new Map<string, Breakdown>();
    const browserMap = new Map<string, Breakdown>();
    const osMap = new Map<string, Breakdown>();
    const pageMap = new Map<string, Breakdown>();
    let totalVisitors = 0;
    let totalPageviews = 0;

    days.forEach((day) => {
      totalVisitors += day.visitors || 0;
      totalPageviews += day.pageviews || 0;
      mergeBreakdown(countryMap, day.countries || []);
      mergeBreakdown(deviceMap, day.devices || []);
      mergeBreakdown(browserMap, day.browsers || []);
      mergeBreakdown(osMap, day.operatingSystems || []);
      mergeBreakdown(pageMap, day.pages || []);
    });

    const countries = withPercentages(Array.from(countryMap.values()));
    const devices = withPercentages(Array.from(deviceMap.values()));
    const browsers = withPercentages(Array.from(browserMap.values()));
    const operatingSystems = withPercentages(Array.from(osMap.values()));

    return {
      totalVisitors,
      totalPageviews,
      totalCountries: countries.filter((item) => item.label !== "Unknown").length,
      timeline: days.map((day) => ({ date: day.dateKey, visitors: day.visitors, pageviews: day.pageviews })),
      countries: countries.map(({ label, visitors, pageviews, percentage }) => ({ country: label, visitors, pageviews, percentage })),
      devices: devices.map(({ label, visitors, pageviews, percentage }) => ({ device: label, visitors, pageviews, percentage })),
      browsers: browsers.map(({ label, visitors, pageviews, percentage }) => ({ browser: label, visitors, pageviews, percentage })),
      operatingSystems: operatingSystems.map(({ label, visitors, pageviews, percentage }) => ({ os: label, visitors, pageviews, percentage })),
      topPages: withPercentages(Array.from(pageMap.values())).slice(0, 6).map(({ label, visitors, pageviews }) => ({ path: label, visitors, pageviews })),
    };
  },
  ["admin-analytics-dashboard"],
  { revalidate: ADMIN_DASHBOARD_REVALIDATE_SECONDS, tags: [ADMIN_ANALYTICS_TAG] }
);

async function getHandler() {
  const [analytics, syncStatus] = await Promise.all([getCachedAnalyticsDashboard(), getSyncStatus()]);
  return NextResponse.json({ ...analytics, syncStatus });
}

async function putHandler() {
  const syncStatus = await syncLatestAnalytics();
  revalidateTag(ADMIN_ANALYTICS_TAG, "max");
  return NextResponse.json({ success: syncStatus.reason !== "sync-error", syncStatus });
}

export const GET = adminHandler("admin-analytics", getHandler);
export const PUT = adminHandler("admin-analytics", putHandler);
