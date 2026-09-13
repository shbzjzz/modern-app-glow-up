import type { ProcRow, RawRow } from "./types";

export const ACTIONS = [
  "RTC Price Change",
  "Store Transfer",
  "Monitor",
  "Clear In Normal Price",
] as const;

export const MS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const DEPARTMENTS = [
  "Bakery",
  "Chilled & Dairy",
  "Delicatessen",
  "Fish",
  "Frozen Foods",
  "Grocery Food",
  "Grocery Non Food",
  "Health & Beauty",
];

export const BUCKET_ORDER = [
  ">90 Days",
  "61–90 Days",
  "31–60 Days",
  "7–30 Days",
  "<7 Days",
  "Expired",
];

export function today(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

export function cv(r: RawRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
}

export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v);
  if (!s || s === "—") return null;
  const n = parseFloat(s);
  if (!isNaN(n) && n > 40000 && n < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1]!, +m[2]! - 1, +m[3]!);
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const day = +m[1]!;
    const mon = +m[2]!;
    let yr = +m[3]!;
    if (yr < 100) yr += 2000;
    return new Date(yr, mon - 1, day);
  }
  const fd = new Date(s);
  if (!isNaN(fd.getTime())) return new Date(fd.getFullYear(), fd.getMonth(), fd.getDate());
  return null;
}

export function formatDateToStr(dt: Date | null): string {
  if (!dt) return "";
  const d = String(dt.getDate()).padStart(2, "0");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${dt.getFullYear()}`;
}

export function parseSM(v: string) {
  if (!v || !v.trim())
    return { ym: "", year: null as number | null, monthNum: null as number | null, disp: "" };
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    const y = +m[1]!;
    const mn = +m[2]!;
    return {
      ym: `${y}-${String(mn).padStart(2, "0")}`,
      year: y,
      monthNum: mn,
      disp: MS[mn - 1]! + " " + y,
    };
  }
  m = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const idx = MS.findIndex((x) => x.toLowerCase() === m![1]!.slice(0, 3).toLowerCase());
    if (idx >= 0) {
      const y = +m[2]!;
      return {
        ym: `${y}-${String(idx + 1).padStart(2, "0")}`,
        year: y,
        monthNum: idx + 1,
        disp: MS[idx]! + " " + y,
      };
    }
  }
  return { ym: s, year: null, monthNum: null, disp: s };
}

export function calcBucket(d: number | null | ""): string {
  if (d === null || d === "" || isNaN(Number(d))) return "";
  const n = Number(d);
  if (n <= 0) return "Expired";
  if (n <= 7) return "<7 Days";
  if (n <= 30) return "7–30 Days";
  if (n <= 60) return "31–60 Days";
  if (n <= 90) return "61–90 Days";
  return ">90 Days";
}

export function bucketTone(b?: string) {
  if (!b) return "na";
  if (b === "<7 Days" || b === "Expired") return "crit";
  if (b === "7–30 Days") return "high";
  if (b === "31–60 Days") return "med";
  return "low";
}

export function processRows(rawExpiry: RawRow[]): ProcRow[] {
  const TODAY = today();
  return rawExpiry.map((r) => {
    const store = cv(r, "Store", "StoreName");
    const weekRaw = cv(r, "Week");
    const week = weekRaw ? weekRaw.split(" (")[0]!.trim() : "";
    let subMonthRaw = cv(r, "Submission Month", "SubmissionMonth", "SubMonth");
    if (!subMonthRaw) {
      const ts = cv(r, "Timestamp");
      if (ts) subMonthRaw = ts.slice(0, 7);
    }
    const sm = parseSM(subMonthRaw);
    const expRaw = cv(r, "ExpiryDate");
    const expDate = parseDate(expRaw);
    const expDateDisp = expDate
      ? String(expDate.getDate()).padStart(2, "0") +
        "/" +
        String(expDate.getMonth() + 1).padStart(2, "0") +
        "/" +
        expDate.getFullYear()
      : "";
    let daysLeft: number | null = null;
    if (expDate) {
      daysLeft = Math.round((expDate.getTime() - TODAY.getTime()) / 86400000);
    } else {
      const dlRaw = cv(r, "DaysLeft");
      if (dlRaw !== "") {
        const dlP = parseInt(dlRaw, 10);
        if (!isNaN(dlP)) daysLeft = dlP;
      }
    }
    const tsDate = parseDate(cv(r, "Timestamp"));
    return {
      _idx: Number(r.RowIndex),
      RowIndex: Number(r.RowIndex),
      Store: store,
      StoreCode: cv(r, "StoreCode"),
      Article: cv(r, "Article"),
      Barcode: cv(r, "Barcode"),
      Description: cv(r, "Description"),
      Department: cv(r, "Department"),
      Stock: cv(r, "Stock"),
      ExpiryDate: expDateDisp,
      DaysLeft: daysLeft !== null ? daysLeft : "",
      "Expiry Risk Bucket": calcBucket(daysLeft),
      "Action Taken": cv(r, "ActionTaken"),
      "RTC Price": cv(r, "RtcPrice"),
      "Transfer To": cv(r, "TransferTo"),
      "Action Date": cv(r, "ActionDate"),
      "Transfer Qty": cv(r, "TransferQty"),
      Start: cv(r, "Start"),
      End: cv(r, "End"),
      "Action Status": cv(r, "ActionTaken") ? "Action Taken" : "Pending Action",
      "Previous Action Info": "",
      "Previous Price Info": "",
      EmailSent: Number(cv(r, "EmailSent")) || 0,
      StaffName: cv(r, "StaffName"),
      Week: week,
      "Submission Month": sm.ym || subMonthRaw || "",
      "Sub Month Display": sm.disp || subMonthRaw || "",
      MonthNum: sm.monthNum,
      Year: sm.year,
      _tsDate: tsDate,
      _raw: r,
    } as ProcRow;
  });
}

export function articleKeyOf(r: ProcRow) {
  return `${r.Barcode || r.Article}|${r.ExpiryDate || ""}`;
}

/**
 * Faithful port of the original app's previously-actioned / validity logic.
 * Groups every row actioned for a Store+Barcode+Expiry combination, keeps the
 * FULL action history (comma separated) rather than a single flag, and marks
 * "Validity Expired" when the *latest* RTC end date for that combination has
 * passed while stock remains and the item hasn't expired yet. An older,
 * already-expired RTC must never override a newer, still-valid one.
 */
export function applyPreviouslyActioned(proc: ProcRow[]) {
  const TODAY = today();
  type PastAction = {
    row: ProcRow;
    action: string;
    end: string;
    start: string;
    rtcPrice: string;
    transferTo: string;
    transferQty: string;
    actionDate: string;
    ts: Date | null;
  };
  const actionedMap: Record<string, PastAction[]> = {};

  proc.forEach((r) => {
    if (r["Action Status"] !== "Action Taken") return;
    const key = `${r.StoreCode}|${r.Barcode || r.Article}|${r.ExpiryDate}`;
    if (!actionedMap[key]) actionedMap[key] = [];
    actionedMap[key].push({
      row: r,
      action: r["Action Taken"] || "",
      end: r.End || "",
      start: r.Start || "",
      rtcPrice: r["RTC Price"] || "",
      transferTo: r["Transfer To"] || "",
      transferQty: r["Transfer Qty"] || "",
      actionDate: r["Action Date"] || "",
      ts: r._tsDate,
    });
  });

  Object.keys(actionedMap).forEach((key) => {
    const past = actionedMap[key]!;
    const rtcPast = past.filter((a) => a.action.includes("RTC Price Change") && parseDate(a.end));
    rtcPast.sort((a, b) => (parseDate(b.end)?.getTime() || 0) - (parseDate(a.end)?.getTime() || 0));
    const latestRTC = rtcPast[0] || null;
    const latestEnd = latestRTC ? parseDate(latestRTC.end) : null;
    const validity = !!(latestEnd && latestEnd < TODAY);

    past.forEach((a) => {
      const parts: string[] = [];
      const priceParts: string[] = [];
      if (a.action.includes("RTC Price Change")) {
        parts.push(`RTC given till ${formatDateToStr(parseDate(a.end)) || a.end}`);
        if (a.rtcPrice) priceParts.push(`AED ${a.rtcPrice}`);
      }
      if (a.action.includes("Store Transfer")) {
        parts.push(`${a.transferQty || "0"} Units Transferred`);
        if (a.transferTo) priceParts.push(a.transferTo);
      }
      (
        a.row as ProcRow & { _actionHistoryPart?: string; _priceHistoryPart?: string }
      )._actionHistoryPart = parts.join(", ");
      (a.row as ProcRow & { _priceHistoryPart?: string })._priceHistoryPart = priceParts.join(", ");
    });

    const current = proc.find(
      (r) =>
        r["Action Status"] === "Pending Action" &&
        `${r.StoreCode}|${r.Barcode || r.Article}|${r.ExpiryDate}` === key,
    );

    if (current) {
      const actionTexts: string[] = [];
      const priceTexts: string[] = [];
      past.forEach((a) => {
        const rr = a.row as ProcRow & { _actionHistoryPart?: string; _priceHistoryPart?: string };
        if (rr._actionHistoryPart) actionTexts.push(rr._actionHistoryPart);
        if (rr._priceHistoryPart) priceTexts.push(rr._priceHistoryPart);
      });
      current["Previous Action Info"] = actionTexts.join(", ");
      current["Previous Price Info"] = priceTexts.join(", ");
      current["Latest RTC End"] = latestRTC?.end || "";
      current["Latest RTC Info"] = latestRTC
        ? `RTC given till ${formatDateToStr(latestEnd) || latestRTC.end}`
        : "";
      const stock = parseFloat(current.Stock);
      const days = Number(current.DaysLeft);
      current["Action Status"] =
        validity && stock > 0 && days > 0 ? "Validity Expired" : "Previously Actioned";
    } else if (validity) {
      const latestRow = [...past].sort((a, b) => {
        const da =
          a.ts?.getTime() || parseDate(a.actionDate)?.getTime() || parseDate(a.end)?.getTime() || 0;
        const db =
          b.ts?.getTime() || parseDate(b.actionDate)?.getTime() || parseDate(b.end)?.getTime() || 0;
        return db - da;
      })[0]?.row;
      if (latestRow) {
        const stock = parseFloat(latestRow.Stock);
        const days = Number(latestRow.DaysLeft);
        if (stock > 0 && days > 0) {
          latestRow["Action Status"] = "Validity Expired";
          latestRow["Latest RTC End"] = latestRTC?.end || "";
          latestRow["Latest RTC Info"] = latestRTC
            ? `RTC given till ${formatDateToStr(latestEnd) || latestRTC.end}`
            : "";
        }
      }
    }
  });

  return proc;
}

/* ── Buyer disabled-articles (workspace-wide, matches old app's localStorage key) ── */
export const DISABLED_ARTICLES_KEY = "gala_expiry_disabled_articles";

export interface DisabledArticle {
  article: string;
  barcode: string;
  description: string;
  department: string;
}

export function getDisabledArticles(): DisabledArticle[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(DISABLED_ARTICLES_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveDisabledArticles(list: DisabledArticle[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISABLED_ARTICLES_KEY, JSON.stringify(list));
}

export function articleCatalog(proc: ProcRow[]): DisabledArticle[] {
  const m = new Map<string, DisabledArticle>();
  proc.forEach((r) => {
    const a = String(r.Article || "").trim();
    const b = String(r.Barcode || "").trim();
    const entry = {
      article: a,
      barcode: b,
      description: r.Description || "",
      department: r.Department || "",
    };
    if (a && !m.has("A:" + a.toLowerCase())) m.set("A:" + a.toLowerCase(), entry);
    if (b && !m.has("B:" + b.toLowerCase())) m.set("B:" + b.toLowerCase(), entry);
  });
  return [...m.values()];
}

export function findArticleInfo(proc: ProcRow[], value: string): DisabledArticle | null {
  const q = String(value || "")
    .trim()
    .toLowerCase();
  if (!q) return null;
  const catalog = articleCatalog(proc);
  return (
    catalog.find((x) => x.article.toLowerCase() === q || x.barcode.toLowerCase() === q) ||
    catalog.find(
      (x) =>
        x.article.toLowerCase().includes(q) ||
        x.barcode.toLowerCase().includes(q) ||
        x.description.toLowerCase().includes(q),
    ) ||
    null
  );
}

/** Rows visible to a buyer once disabled articles are hidden (admins / area managers see everything). */
export function getBuyerVisibleProc(
  proc: ProcRow[],
  isBuyer: boolean,
  disabled: DisabledArticle[],
) {
  if (!isBuyer || !disabled.length) return proc;
  const set = new Set(
    disabled.flatMap((d) => [d.article.toLowerCase(), d.barcode.toLowerCase()].filter(Boolean)),
  );
  return proc.filter(
    (r) =>
      !set.has(
        String(r.Article || "")
          .trim()
          .toLowerCase(),
      ) &&
      !set.has(
        String(r.Barcode || "")
          .trim()
          .toLowerCase(),
      ),
  );
}

/* ── Needs My Attention scoring (buyer priority queue) ── */
export function isAttentionCandidate(r: ProcRow) {
  const stock = parseFloat(r.Stock) || 0;
  const days = Number(r.DaysLeft);
  return (
    ["Pending Action", "Validity Expired"].includes(r["Action Status"]) &&
    stock > 0 &&
    Number.isFinite(days) &&
    days >= 0
  );
}

export type AttentionReason =
  | "validity"
  | "pending"
  | "critical3"
  | "critical7"
  | "critical10"
  | "critical30"
  | "highstock"
  | "";

export function attentionReasonMatch(r: ProcRow, reason: AttentionReason) {
  const days = Number(r.DaysLeft);
  const stock = parseFloat(r.Stock) || 0;
  const status = r["Action Status"] || "";
  const overdue = status === "Pending Action" && isOverdueRow(r);
  if (reason === "validity") return status === "Validity Expired";
  if (reason === "pending") return overdue;
  if (reason === "critical3") return days <= 3;
  if (reason === "critical7") return days <= 7;
  if (reason === "critical10") return days <= 10;
  if (reason === "critical30") return days <= 30;
  if (reason === "highstock") return stock >= 20;
  return true;
}

export function scoreAttentionRow(r: ProcRow): { score: number; reason: string } {
  const status = r["Action Status"] || "";
  const days = Number(r.DaysLeft);
  const stock = parseFloat(r.Stock) || 0;
  const overdue = status === "Pending Action" && isOverdueRow(r);
  let score = 0;
  let reason = "Open action";
  if (status === "Validity Expired") {
    score = 100;
    reason = "RTC validity expired";
  } else if (overdue) {
    score = 98;
    reason = "Pending 14+ days";
  } else if (days <= 3) {
    score = 95;
    reason = "Expiry ≤3 days";
  } else if (days <= 7) {
    score = 90;
    reason = "Expiry ≤7 days";
  } else if (days <= 10) {
    score = 85;
    reason = "Expiry ≤10 days";
  } else if (days <= 30) {
    score = 72;
    reason = "Expiry ≤30 days";
  }
  if (stock >= 50) score += 8;
  else if (stock >= 20) score += 5;
  else if (stock >= 10) score += 2;
  return { score, reason };
}

/* ── Buyer mail / notify settings (session-scoped, matches old app) ── */
export const BUYER_SETTINGS_KEY = "gala_expiry_buyer_notify_settings";

export interface BuyerSettings {
  cc: string;
  subject: string;
  body: string;
  confirm: boolean;
  rememberActions: boolean;
  rtc: boolean;
  transfer: boolean;
  monitor: boolean;
  clear: boolean;
}

export const DEFAULT_BUYER_SETTINGS: BuyerSettings = {
  cc: "",
  subject: "Expiry Actions Updated – {STORE} – {WEEK}",
  body: "Dear Manager,\n\nPlease find the updated expiry actions for {STORE}.\nWeek: {WEEK}\nMonth: {MONTH}\nItems: {ITEM_COUNT}\n\n{BODY}\n\nRegards,\nGala Markets",
  confirm: true,
  rememberActions: true,
  rtc: true,
  transfer: true,
  monitor: false,
  clear: false,
};

export function getBuyerSettings(): BuyerSettings {
  if (typeof window === "undefined") return DEFAULT_BUYER_SETTINGS;
  try {
    return {
      ...DEFAULT_BUYER_SETTINGS,
      ...JSON.parse(sessionStorage.getItem(BUYER_SETTINGS_KEY) || "{}"),
    };
  } catch {
    return DEFAULT_BUYER_SETTINGS;
  }
}

export function saveBuyerSettings(v: BuyerSettings) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(BUYER_SETTINGS_KEY, JSON.stringify(v));
}

export function applyBuyerTemplate(
  template: string,
  ctx: {
    store: string;
    code: string;
    week: string;
    month: string;
    count: number;
    date: string;
    body: string;
  },
) {
  return String(template || "")
    .replace(/\{STORE\}/g, ctx.store)
    .replace(/\{STORE_CODE\}/g, ctx.code)
    .replace(/\{WEEK\}/g, ctx.week)
    .replace(/\{MONTH\}/g, ctx.month)
    .replace(/\{ITEM_COUNT\}/g, String(ctx.count))
    .replace(/\{DATE\}/g, ctx.date)
    .replace(/\{BODY\}/g, ctx.body);
}

export function getWeekSortKey(r: ProcRow) {
  const wkNum = parseInt(String(r.Week || "").replace(/\D/g, "")) || 0;
  const mn = String(r.MonthNum ?? "00").padStart(2, "0");
  return `${r.Year ?? "0000"}-${mn}-${String(wkNum).padStart(2, "0")}`;
}

export function sortWeeks(weeks: string[], data: ProcRow[]) {
  return [...weeks].sort((a, b) => {
    const ra = data.find((r) => r.Week === a);
    const rb = data.find((r) => r.Week === b);
    const da = ra?._tsDate ? ra._tsDate.getTime() : 0;
    const db = rb?._tsDate ? rb._tsDate.getTime() : 0;
    if (da !== db) return da - db;
    const na = parseInt(String(a || "").replace(/\D/g, "")) || 0;
    const nb = parseInt(String(b || "").replace(/\D/g, "")) || 0;
    return na - nb;
  });
}

export const F = {
  le7: (r: ProcRow) => r["Expiry Risk Bucket"] === "<7 Days",
  le30: (r: ProcRow) => ["<7 Days", "7–30 Days"].includes(r["Expiry Risk Bucket"]),
  b7: (r: ProcRow) => r["Expiry Risk Bucket"] === "<7 Days",
  b30: (r: ProcRow) => r["Expiry Risk Bucket"] === "7–30 Days",
  b60: (r: ProcRow) => r["Expiry Risk Bucket"] === "31–60 Days",
  b90: (r: ProcRow) => r["Expiry Risk Bucket"] === "61–90 Days",
  pend: (r: ProcRow) => r["Action Status"] === "Pending Action",
  comp: (r: ProcRow) => r["Action Status"] === "Action Taken",
  soldout: (r: ProcRow) => {
    const s = parseFloat(r.Stock);
    return !isNaN(s) && s === 0;
  },
  expired: (r: ProcRow) => r["Expiry Risk Bucket"] === "Expired",
};

export const cnt = (d: ProcRow[], f?: (r: ProcRow) => boolean) =>
  f ? d.filter(f).length : d.length;

export function totalStock(d: ProcRow[]) {
  return d.reduce((s, r) => {
    const v = parseFloat(r.Stock);
    return s + (isNaN(v) || v <= 0 ? 1 : v);
  }, 0);
}

export function isOverdueRow(r: ProcRow) {
  return (
    r["Action Status"] === "Pending Action" &&
    !!r._tsDate &&
    Math.round((today().getTime() - r._tsDate.getTime()) / 86400000) >= 14
  );
}

export function currentMonthYm() {
  return new Date().toISOString().slice(0, 7);
}

export function currentWeekLabel() {
  return "Week " + Math.ceil(new Date().getDate() / 7);
}

export function ymLabel(ym: string) {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  return m ? MS[+m[2]! - 1]! + " " + m[1] : ym;
}

/* ── generic sorting ── */
export type SortState = { key: string | null; dir: 1 | -1; type: string };

export function getSortVal(r: Record<string, unknown>, key: string, type: string) {
  let val: unknown = "";
  const row = r as unknown as ProcRow;
  if (key === "code") val = row.StoreCode;
  else if (key === "store") val = row.Store;
  else if (key === "week") return getWeekSortKey(row);
  else if (key === "month") val = row["Submission Month"];
  else if (key === "article") val = row.Article;
  else if (key === "desc") val = row.Description;
  else if (key === "dept") val = row.Department;
  else if (key === "stock") val = parseFloat(row.Stock) || 0;
  else if (key === "expiry") {
    const d = parseDate(row.ExpiryDate);
    return d ? d.getTime() : 0;
  } else if (key === "days")
    val = row.DaysLeft !== "" && row.DaysLeft !== null ? Number(row.DaysLeft) : -9999;
  else if (key === "risk") {
    const order: Record<string, number> = {
      Expired: 0,
      "<7 Days": 1,
      "7–30 Days": 2,
      "31–60 Days": 3,
      "61–90 Days": 4,
      ">90 Days": 5,
    };
    return order[row["Expiry Risk Bucket"]] ?? 99;
  } else if (key === "status") {
    const order: Record<string, number> = {
      "Pending Action": 0,
      "Validity Expired": 1,
      "Previously Actioned": 2,
      "Action Taken": 3,
    };
    return order[row["Action Status"]] ?? 99;
  } else if (key === "action") val = row["Action Taken"];
  else if (key === "rtc") val = parseFloat(row["RTC Price"]) || 0;
  else if (key === "start" || key === "end" || key === "adate") {
    const raw = key === "start" ? row.Start : key === "end" ? row.End : row["Action Date"];
    const d = parseDate(raw);
    return d ? d.getTime() : 0;
  } else if (key === "transfer") val = row["Transfer To"];
  else if (key === "tqty") val = parseFloat(row["Transfer Qty"]) || 0;
  else if (key === "prevaction") val = row["Previous Action Info"];
  else if (key === "prevprice") val = row["Previous Price Info"];
  else val = r[key];

  if (val === undefined || val === null) val = "";
  if (type === "num") return parseFloat(String(val)) || 0;
  if (type === "date") {
    const d = parseDate(val);
    return d ? d.getTime() : 0;
  }
  return String(val).toLowerCase();
}

export function sortData<T extends Record<string, unknown>>(data: T[], st: SortState): T[] {
  if (!st.key) return data;
  const { key, type, dir } = st;
  return [...data].sort((a, b) => {
    const va = getSortVal(a, key, type);
    const vb = getSortVal(b, key, type);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

export function elaborateAction(actionStr: string) {
  if (!actionStr) return "";
  return actionStr
    .split(",")
    .map((p) => p.trim())
    .map((p) => {
      const lower = p.toLowerCase();
      if (lower === "rtc" || lower === "rtc price change") return "RTC Price Change";
      if (lower === "st" || lower === "store transfer") return "Store Transfer";
      if (lower === "m" || lower === "monitor") return "Monitor";
      if (lower === "cnp" || lower === "clear in normal price") return "Clear In Normal Price";
      if (lower === "rtc+st" || lower === "rtc price change+store transfer")
        return "RTC Price Change+Store Transfer";
      if (lower === "cnp+st" || lower === "clear in normal price+store transfer")
        return "Clear In Normal Price+Store Transfer";
      return p;
    })
    .join(", ");
}
