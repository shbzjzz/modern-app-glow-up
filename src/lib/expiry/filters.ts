import { useMemo, useState } from "react";
import { useApp } from "./app-context";
import type { ProcRow } from "./types";
import { BUCKET_ORDER, sortWeeks } from "./utils";

export interface FilterState {
  code: string;
  setCode: (v: string) => void;
  ym: string;
  setYm: (v: string) => void;
  week: string;
  setWeek: (v: string) => void;
  depts: string[];
  setDepts: (v: string[]) => void;
  status: string;
  setStatus: (v: string) => void;
  buckets: string[];
  setBuckets: (v: string[]) => void;
  search: string;
  setSearch: (v: string) => void;
  reset: () => void;
  storeName: string;
  codes: { code: string; name: string }[];
  months: { ym: string; label: string }[];
  weeks: string[];
  deptOptions: string[];
  bucketOptions: string[];
  base: ProcRow[];
  filtered: ProcRow[];
  activeChips: string[];
}

/** Shared filter engine for every screen. Scoped by user permissions. */
export function useFilters(): FilterState {
  const { proc, stores, codeToStore, userStores, userDepartments } = useApp();
  const [code, setCode] = useState("");
  const [ym, setYm] = useState("");
  const [week, setWeek] = useState("");
  const [depts, setDepts] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [buckets, setBuckets] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // permission-scoped base data
  const base = useMemo(() => {
    let d = proc;
    if (userStores.length) d = d.filter((r) => userStores.includes(r.StoreCode));
    if (userDepartments.length)
      d = d.filter((r) => userDepartments.includes(r.Department));
    return d;
  }, [proc, userStores, userDepartments]);

  const codes = useMemo(() => {
    const seen = new Map<string, string>();
    stores.forEach((s) => seen.set(s.code, s.name));
    base.forEach((r) => {
      if (r.StoreCode && !seen.has(r.StoreCode)) seen.set(r.StoreCode, r.Store);
    });
    let list = [...seen].map(([c, n]) => ({ code: c, name: n }));
    if (userStores.length) list = list.filter((s) => userStores.includes(s.code));
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [stores, base, userStores]);

  const months = useMemo(() => {
    const m = new Map<string, string>();
    base.forEach((r) => {
      if (r["Submission Month"])
        m.set(r["Submission Month"], r["Sub Month Display"] || r["Submission Month"]);
    });
    return [...m]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([v, label]) => ({ ym: v, label }));
  }, [base]);

  const weeks = useMemo(() => {
    const scoped = base.filter(
      (r) => (!code || r.StoreCode === code) && (!ym || r["Submission Month"] === ym),
    );
    return sortWeeks([...new Set(scoped.map((r) => r.Week).filter(Boolean))], scoped);
  }, [base, code, ym]);

  const deptOptions = useMemo(() => {
    const s = new Set<string>();
    base.forEach((r) => r.Department && s.add(r.Department));
    return [...s].sort();
  }, [base]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return base.filter((r) => {
      if (code && r.StoreCode !== code) return false;
      if (ym && r["Submission Month"] !== ym) return false;
      if (week && r.Week !== week) return false;
      if (depts.length && !depts.includes(r.Department)) return false;
      if (status && r["Action Status"] !== status) return false;
      if (buckets.length && !buckets.includes(r["Expiry Risk Bucket"])) return false;
      if (q) {
        const hay = `${r.Article} ${r.Description} ${r.Barcode} ${r.Store}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [base, code, ym, week, depts, status, buckets, search]);

  const activeChips = useMemo(() => {
    const c: string[] = [];
    if (code) c.push(`Store: ${code}`);
    if (ym) c.push(`Month: ${months.find((m) => m.ym === ym)?.label || ym}`);
    if (week) c.push(`Week: ${week}`);
    if (depts.length) c.push(`Dept: ${depts.join(", ")}`);
    if (status) c.push(`Status: ${status}`);
    if (buckets.length) c.push(`Risk: ${buckets.join(", ")}`);
    if (search.trim()) c.push(`Search: ${search.trim()}`);
    return c;
  }, [code, ym, week, depts, status, buckets, search, months]);

  return {
    code,
    setCode,
    ym,
    setYm,
    week,
    setWeek,
    depts,
    setDepts,
    status,
    setStatus,
    buckets,
    setBuckets,
    search,
    setSearch,
    reset: () => {
      setCode("");
      setYm("");
      setWeek("");
      setDepts([]);
      setStatus("");
      setBuckets([]);
      setSearch("");
    },
    storeName: code ? codeToStore[code] || "—" : "—",
    codes,
    months,
    weeks,
    deptOptions,
    bucketOptions: BUCKET_ORDER,
    base,
    filtered,
    activeChips,
  };
}
