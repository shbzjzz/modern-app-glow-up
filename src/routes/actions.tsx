import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Zap } from "lucide-react";
import { AppShell } from "@/components/expiry/app-shell";
import { ConfirmActionModal, RowPopup } from "@/components/expiry/row-popup";
import {
  Button,
  EmptyState,
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
import { EXP_COLS, downloadSheet, flatRow } from "@/lib/expiry/export";
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

function ActionsPage() {
  const { selected, setSelected, isAdmin } = useApp();
  const f = useFilters();
  const { sort, toggle } = useSort({ key: "days", dir: 1, type: "num" });
  const [onlyPending, setOnlyPending] = useState(true);
  const [hideSoldOut, setHideSoldOut] = useState(false);
  const [popRow, setPopRow] = useState<ProcRow | null>(null);
  const [action, setAction] = useState<(typeof ACTIONS)[number] | null>(null);

  const rows = useMemo(() => {
    let d = f.filtered;
    if (onlyPending) d = d.filter((r) => !F.comp(r));
    if (hideSoldOut) d = d.filter((r) => !F.soldout(r));
    return d;
  }, [f.filtered, onlyPending, hideSoldOut]);

  const sorted = useSorted(rows as unknown as Record<string, unknown>[], sort) as unknown as ProcRow[];
  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r._idx)),
    [rows, selected],
  );
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r._idx));

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

  return (
    <AppShell title="Action Center" subtitle="Decide, price and transfer near-expiry stock">
      <Filters f={f} />

      <Panel
        title="Items"
        sub={`${sorted.length} rows · ${selectedRows.length} selected`}
        icon={<Zap className="size-4 text-primary" />}
        badge={`${sorted.length}`}
        actions={
          <>
            <Tick checked={onlyPending} onChange={setOnlyPending} label="Hide completed" />
            <Tick checked={hideSoldOut} onChange={setHideSoldOut} label="Hide sold out" />
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
      {!isAdmin && null}
    </AppShell>
  );
}
