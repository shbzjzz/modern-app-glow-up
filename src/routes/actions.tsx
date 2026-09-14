import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Upload, Zap } from "lucide-react";
import { AppShell } from "@/components/expiry/app-shell";
import { ConfirmActionModal, RowPopup } from "@/components/expiry/row-popup";
import {
  Button,
  EmptyState,
  Field,
  MultiSelect,
  Panel,
  RiskBadge,
  StatusBadge,
  TableWrap,
  Th,
  Tick,
  useSort,
  useSorted,
} from "@/components/expiry/ui";
import { Filters } from "@/routes/index";
import { useApp } from "@/lib/expiry/app-context";
import { useFilters } from "@/lib/expiry/filters";
import { CF_API, apiFetch } from "@/lib/expiry/api";
import { EXP_COLS, downloadSheet, flatRow, readSheetFile } from "@/lib/expiry/export";
import type { ProcRow } from "@/lib/expiry/types";
import { ACTIONS, F, elaborateAction } from "@/lib/expiry/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/actions")({
  head: () => ({
    meta: [
      { title: "Action Center — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Review pending expiry items and apply RTC price changes, store transfers or monitoring in bulk.",
      },
      { property: "og:title", content: "Action Center — Gala Markets" },
      {
        property: "og:description",
        content: "Bulk RTC pricing, transfers and monitoring for near-expiry stock.",
      },
    ],
  }),
  component: ActionsPage,
});

const STATUS_OPTIONS = [
  "Pending Action",
  "Validity Expired",
  "Previously Actioned",
  "Action Taken",
];

function ActionsPage() {
  const { selected, setSelected, setProc } = useApp();
  const f = useFilters();
  const { sort, toggle } = useSort({ key: "days", dir: 1, type: "num" });
  const [onlyPending, setOnlyPending] = useState(true);
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [hideLowStock, setHideLowStock] = useState(false);
  const [hideActionedBefore, setHideActionedBefore] = useState(false);
  const [popRow, setPopRow] = useState<ProcRow | null>(null);
  const [action, setAction] = useState<(typeof ACTIONS)[number] | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    let d = f.filtered;
    if (onlyPending) d = d.filter((r) => !F.comp(r));
    if (hideSoldOut) d = d.filter((r) => !F.soldout(r));
    if (hideLowStock) d = d.filter((r) => (parseFloat(r.Stock) || 0) > 4);
    if (hideActionedBefore) d = d.filter((r) => r["Action Status"] !== "Previously Actioned");
    return d;
  }, [f.filtered, onlyPending, hideSoldOut, hideLowStock, hideActionedBefore]);

  const sorted = useSorted(
    rows as unknown as Record<string, unknown>[],
    sort,
  ) as unknown as ProcRow[];
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r._idx)), [rows, selected]);
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r._idx));

  const validityRows = useMemo(
    () => f.filtered.filter((r) => r["Action Status"] === "Validity Expired"),
    [f.filtered],
  );

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) rows.forEach((r) => next.delete(r._idx));
      else rows.forEach((r) => next.add(r._idx));
      return next;
    });

  const toggleOne = (idx: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });

  const exportRows = () => {
    const ok = downloadSheet(sorted.map(flatRow), EXP_COLS, "Expiry_Actions");
    if (!ok) toast.error("Nothing to export");
  };

  const importActions = async (file: File) => {
    setImporting(true);
    try {
      const allRows = await readSheetFile(file);
      const actionRows = allRows.filter((r) => String(r["Action Taken"] || "").trim() !== "");
      if (!actionRows.length) {
        toast.error("No Action Taken values found");
        return;
      }
      toast(`Importing ${actionRows.length} actions…`);
      const results = await Promise.allSettled(
        actionRows.map((row) => {
          const rowIndex = String(row["RowIndex"] || "").trim();
          const actionTaken = elaborateAction(String(row["Action Taken"] || "").trim());
          if (!rowIndex || !actionTaken) return Promise.resolve({ success: false });
          return apiFetch(`${CF_API}?action=saveBuyerAction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rowIndex,
              actionTaken,
              rtcPrice: String(row["RTC Price"] || ""),
              transferTo: String(row["Transfer To"] || ""),
              transferQty: String(row["Transfer Qty"] || ""),
              start: String(row["Start"] || ""),
              end: String(row["End"] || ""),
              actionDate: new Date().toISOString(),
            }),
          }).then((r) => r.json());
        }),
      );
      const successCount = results.filter(
        (r) =>
          r.status === "fulfilled" &&
          (r as PromiseFulfilledResult<{ success?: boolean }>).value?.success !== false,
      ).length;
      const byRowIndex = new Map(actionRows.map((r) => [String(r["RowIndex"] || "").trim(), r]));
      setProc((prev) =>
        prev.map((p) => {
          const match = byRowIndex.get(String(p._idx));
          if (!match) return p;
          return {
            ...p,
            "Action Taken": elaborateAction(String(match["Action Taken"] || "").trim()),
            "Action Status": "Action Taken",
            "RTC Price": String(match["RTC Price"] || ""),
            "Transfer To": String(match["Transfer To"] || ""),
            "Transfer Qty": String(match["Transfer Qty"] || ""),
            Start: String(match["Start"] || ""),
            End: String(match["End"] || ""),
            "Action Date": new Date().toISOString(),
          };
        }),
      );
      const failCount = actionRows.length - successCount;
      if (successCount > 0)
        toast.success(`${successCount} imported${failCount ? ` (${failCount} skipped)` : ""}`);
      else toast.error("Import failed — check RowIndex column");
    } catch (err) {
      toast.error((err as Error).message || "Cannot read file");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AppShell title="Action Center" subtitle="Decide, price and transfer near-expiry stock">
      <Filters f={f} />

      <Field label="Status (multi-select)" className="max-w-xs">
        <MultiSelect
          options={STATUS_OPTIONS}
          value={f.statuses}
          onChange={f.setStatuses}
          allLabel="All statuses"
        />
      </Field>

      <Panel
        title="Items"
        sub={`${sorted.length} rows · ${selectedRows.length} selected`}
        icon={<Zap className="size-4 text-primary" />}
        badge={`${sorted.length}`}
        actions={
          <>
            <Tick checked={onlyPending} onChange={setOnlyPending} label="Hide completed" />
            <Tick checked={hideSoldOut} onChange={setHideSoldOut} label="Hide sold out" />
            <Tick checked={hideLowStock} onChange={setHideLowStock} label="Hide 0-4 stock" />
            <Tick
              checked={hideActionedBefore}
              onChange={setHideActionedBefore}
              label="Hide actioned before"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importActions(file);
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload className="size-3.5" /> {importing ? "Importing…" : "Import actions"}
            </Button>
            <Button variant="export" onClick={exportRows}>
              <Download className="size-3.5" /> Export
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/50 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bulk action
          </span>
          {ACTIONS.map((a) => (
            <Button
              key={a}
              variant={a === "RTC Price Change" ? "primary" : "default"}
              disabled={!selectedRows.length}
              onClick={() => setAction(a)}
            >
              {a}
            </Button>
          ))}
          {selectedRows.length > 0 && (
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          )}
        </div>

        {sorted.length ? (
          <TableWrap maxHeight="62vh">
            <thead>
              <tr>
                <th className="w-9">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <Th label="Store" sortKey="code" sort={sort} toggle={toggle} />
                <Th label="Article" sortKey="article" sort={sort} toggle={toggle} />
                <Th label="Description" sortKey="desc" sort={sort} toggle={toggle} />
                <Th label="Dept" sortKey="dept" sort={sort} toggle={toggle} />
                <Th label="Stock" sortKey="stock" type="num" sort={sort} toggle={toggle} />
                <Th label="Expiry" sortKey="expiry" type="date" sort={sort} toggle={toggle} />
                <Th label="Days" sortKey="days" type="num" sort={sort} toggle={toggle} />
                <Th label="Risk" sortKey="risk" sort={sort} toggle={toggle} />
                <Th label="Status" sortKey="status" sort={sort} toggle={toggle} />
                <Th label="Action" sortKey="action" sort={sort} toggle={toggle} />
                <Th label="RTC" sortKey="rtc" type="num" sort={sort} toggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r._idx}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).tagName === "INPUT") return;
                    setPopRow(r);
                  }}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selected.has(r._idx)}
                      onChange={() => toggleOne(r._idx)}
                      aria-label={`Select ${r.Article}`}
                    />
                  </td>
                  <td className="font-semibold">{r.StoreCode}</td>
                  <td className="font-mono font-semibold">{r.Article || "—"}</td>
                  <td className="max-w-[18rem] truncate">{r.Description || "—"}</td>
                  <td>{r.Department || "—"}</td>
                  <td className="tabular-nums">{r.Stock || "—"}</td>
                  <td className="font-mono">{r.ExpiryDate || "—"}</td>
                  <td className="tabular-nums">{r.DaysLeft === "" ? "—" : r.DaysLeft}</td>
                  <td>
                    <RiskBadge bucket={r["Expiry Risk Bucket"]} />
                  </td>
                  <td>
                    <StatusBadge status={r["Action Status"]} />
                  </td>
                  <td className="max-w-[12rem] truncate">
                    {elaborateAction(r["Action Taken"]) || "—"}
                  </td>
                  <td className="font-mono">{r["RTC Price"] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="No items match"
            sub="Try clearing a filter or switching the submission month."
          />
        )}
      </Panel>

      <Panel
        title="Further action required — validity expired"
        sub="RTC validity has ended while stock remains and the article has not yet expired"
        icon={<AlertTriangle className="size-4 text-med" />}
        badge={`${validityRows.length} items`}
      >
        {validityRows.length ? (
          <TableWrap maxHeight="20rem">
            <thead>
              <tr>
                <th>Store</th>
                <th>Code</th>
                <th>Article</th>
                <th>Description</th>
                <th>Stock</th>
                <th>Expiry</th>
                <th>Days left</th>
                <th>Previous action</th>
                <th>Previous price</th>
                <th>RTC end</th>
              </tr>
            </thead>
            <tbody>
              {validityRows.map((r) => (
                <tr key={r._idx} className="cursor-pointer" onClick={() => setPopRow(r)}>
                  <td className="font-semibold">{r.Store || "—"}</td>
                  <td className="font-mono">{r.StoreCode || "—"}</td>
                  <td className="font-mono font-semibold">{r.Article || "—"}</td>
                  <td className="max-w-[16rem] truncate">{r.Description || "—"}</td>
                  <td className="font-mono font-semibold tabular-nums">{r.Stock || "—"}</td>
                  <td className="font-mono">{r.ExpiryDate || "—"}</td>
                  <td className="font-mono font-semibold text-med tabular-nums">{r.DaysLeft}</td>
                  <td className="max-w-[12rem] truncate text-[11px]">
                    {r["Latest RTC Info"] || r["Previous Action Info"] || r["Action Taken"] || "—"}
                  </td>
                  <td className="max-w-[10rem] truncate text-[11px]">
                    {r["Previous Price Info"] || (r["RTC Price"] ? `AED ${r["RTC Price"]}` : "—")}
                  </td>
                  <td className="font-mono">{r["Latest RTC End"] || r.End || "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="No validity-expired items"
            icon={<AlertTriangle className="size-5" />}
          />
        )}
      </Panel>

      <ConfirmActionModal
        action={action}
        items={selectedRows}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          setSelected(new Set());
        }}
      />
      <RowPopup row={popRow} onClose={() => setPopRow(null)} />
    </AppShell>
  );
}
