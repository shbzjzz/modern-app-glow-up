import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, LayoutGrid, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/expiry/app-shell";
import { RowPopup } from "@/components/expiry/row-popup";
import {
  Button,
  EmptyState,
  Field,
  FilterBar,
  Kpi,
  KpiGrid,
  MultiSelect,
  Panel,
  RiskBadge,
  Select,
  StoreDisplay,
  TableWrap,
  Th,
  useSort,
  useSorted,
} from "@/components/expiry/ui";
import { useApp } from "@/lib/expiry/app-context";
import type { ProcRow } from "@/lib/expiry/types";
import { F, cnt } from "@/lib/expiry/utils";
import { downloadSheet } from "@/lib/expiry/export";

export const Route = createFileRoute("/area-view")({
  head: () => ({
    meta: [
      { title: "Area View — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content: "Complete expiry data for one assigned store, month, week and department.",
      },
    ],
  }),
  component: AreaViewPage,
});

function AreaViewPage() {
  const { proc, codeToStore, isAreaManager, userStores } = useApp();
  const [code, setCode] = useState("");
  const [ym, setYm] = useState("");
  const [week, setWeek] = useState("");
  const [depts, setDepts] = useState<string[]>([]);
  const [popRow, setPopRow] = useState<ProcRow | null>(null);
  const { sort, toggle } = useSort({ key: "store", dir: 1, type: "str" });

  const scoped = useMemo(
    () => proc.filter((r) => userStores.includes(r.StoreCode)),
    [proc, userStores],
  );

  const months = useMemo(() => {
    const m = new Map<string, string>();
    scoped.forEach((r) => {
      if (r["Submission Month"])
        m.set(r["Submission Month"], r["Sub Month Display"] || r["Submission Month"]);
    });
    return [...m].sort((a, b) => b[0].localeCompare(a[0])).map(([v, label]) => ({ ym: v, label }));
  }, [scoped]);

  const weeks = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];
  const deptOptions = useMemo(() => {
    const s = new Set<string>();
    scoped.forEach((r) => r.Department && s.add(r.Department));
    return [...s].sort();
  }, [scoped]);

  const rows = useMemo(() => {
    if (!code || !ym || !week) return [];
    return scoped.filter(
      (r) =>
        r.StoreCode === code &&
        r["Submission Month"] === ym &&
        r.Week === week &&
        (depts.length === 0 || depts.includes(r.Department)),
    );
  }, [scoped, code, ym, week, depts]);

  const sorted = useSorted(
    rows as unknown as Record<string, unknown>[],
    sort,
  ) as unknown as ProcRow[];

  const exportRows = () => {
    const data = sorted.map((r) => ({
      Store: r.Store,
      StoreCode: r.StoreCode,
      Article: r.Article,
      Barcode: r.Barcode,
      Description: r.Description,
      Department: r.Department,
      Stock: r.Stock,
      ExpiryDate: r.ExpiryDate,
      DaysLeft: r.DaysLeft,
      StaffName: r.StaffName,
    }));
    const ok = downloadSheet(data, Object.keys(data[0] || {}), "AreaView", "Area View");
    if (!ok) toast.error("Select filters with available data first");
  };

  if (!isAreaManager) {
    return (
      <AppShell title="Area View" subtitle="Area manager workspace">
        <Panel>
          <EmptyState
            title="Area managers only"
            sub="This view is only available to area manager accounts."
            icon={<MapPin className="size-5" />}
          />
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Area View"
      subtitle="View the complete data for one assigned store, month, week and department"
    >
      <KpiGrid>
        <Kpi label="Items" value={rows.length} />
        <Kpi label="Critical ≤7" tone="crit" value={cnt(rows, F.le7)} />
        <Kpi label="Pending" tone="high" value={cnt(rows, F.pend)} />
        <Kpi label="Actioned" tone="low" value={cnt(rows, F.comp)} />
      </KpiGrid>

      <FilterBar>
        <Field label="Store">
          <Select value={code} onChange={setCode}>
            <option value="">Select store</option>
            {userStores.map((c) => (
              <option key={c} value={c}>
                {c} — {codeToStore[c] || c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Store name">
          <StoreDisplay name={code ? codeToStore[code] || code : "—"} />
        </Field>
        <Field label="Month">
          <Select value={ym} onChange={setYm}>
            <option value="">Select month</option>
            {months.map((m) => (
              <option key={m.ym} value={m.ym}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Week">
          <Select value={week} onChange={setWeek}>
            <option value="">Select week</option>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Department">
          <MultiSelect
            options={deptOptions}
            value={depts}
            onChange={setDepts}
            allLabel="All depts"
          />
        </Field>
        <Button
          variant="ghost"
          onClick={() => {
            setCode("");
            setYm("");
            setWeek("");
            setDepts([]);
          }}
        >
          Reset
        </Button>
      </FilterBar>

      <Panel
        title="Store week data"
        sub="All records for the selected store and week"
        icon={<LayoutGrid className="size-4 text-primary" />}
        badge={`${sorted.length} items`}
        actions={
          <Button variant="export" onClick={exportRows}>
            <Download className="size-3.5" /> Export
          </Button>
        }
      >
        {!code || !ym || !week ? (
          <EmptyState title="Select a store, month and week" icon={<MapPin className="size-5" />} />
        ) : sorted.length ? (
          <TableWrap maxHeight="65vh">
            <thead>
              <tr>
                <Th label="Store" sortKey="store" sort={sort} toggle={toggle} />
                <Th label="Store code" sortKey="code" sort={sort} toggle={toggle} />
                <Th label="Article" sortKey="article" sort={sort} toggle={toggle} />
                <Th label="Barcode" sortKey="Barcode" sort={sort} toggle={toggle} />
                <Th label="Description" sortKey="desc" sort={sort} toggle={toggle} />
                <Th label="Department" sortKey="dept" sort={sort} toggle={toggle} />
                <Th label="Stock" sortKey="stock" type="num" sort={sort} toggle={toggle} />
                <Th label="Expiry" sortKey="expiry" type="date" sort={sort} toggle={toggle} />
                <Th label="Days left" sortKey="days" type="num" sort={sort} toggle={toggle} />
                <Th label="Risk" sortKey="risk" sort={sort} toggle={toggle} />
                <Th label="Staff" sortKey="StaffName" sort={sort} toggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r._idx} className="cursor-pointer" onClick={() => setPopRow(r)}>
                  <td className="font-semibold">{r.Store || "—"}</td>
                  <td className="font-mono font-semibold">{r.StoreCode || "—"}</td>
                  <td className="font-mono">{r.Article || "—"}</td>
                  <td className="font-mono">{r.Barcode || "—"}</td>
                  <td className="max-w-[16rem] truncate">{r.Description || "—"}</td>
                  <td>{r.Department || "—"}</td>
                  <td className="tabular-nums font-semibold">{r.Stock || "—"}</td>
                  <td className="font-mono">{r.ExpiryDate || "—"}</td>
                  <td className="tabular-nums">
                    {r.DaysLeft === "" ? "—" : Number(r.DaysLeft) < 0 ? "Expired" : r.DaysLeft}
                  </td>
                  <td>
                    <RiskBadge bucket={r["Expiry Risk Bucket"]} />
                  </td>
                  <td className="font-mono text-[11px]">{r.StaffName || "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No data for the selected filters" />
        )}
      </Panel>

      <RowPopup row={popRow} onClose={() => setPopRow(null)} />
    </AppShell>
  );
}
