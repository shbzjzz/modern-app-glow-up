import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Zap } from "lucide-react";
import { AppShell } from "@/components/expiry/app-shell";
import { ConfirmActionModal, RowPopup } from "@/components/expiry/row-popup";
import {
  Button,
  EmptyState,
  Kpi,
  KpiGrid,
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
import { ACTIONS, F, cnt, elaborateAction } from "@/lib/expiry/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/buyer-action")({
  head: () => ({
    meta: [
      { title: "Buyer's Action — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Department-scoped queue for buyers to clear near-expiry stock with RTC pricing and transfers.",
      },
      { property: "og:title", content: "Buyer's Action — Gala Markets" },
      {
        property: "og:description",
        content: "Department-scoped buyer queue for near-expiry stock decisions.",
      },
    ],
  }),
  component: BuyerActionPage,
});

function BuyerActionPage() {
  const { selected, setSelected, userDepartments } = useApp();
  const f = useFilters();
  const { sort, toggle } = useSort({ key: "days", dir: 1, type: "num" });
  const [onlyPending, setOnlyPending] = useState(true);
  const [popRow, setPopRow] = useState<ProcRow | null>(null);
  const [action, setAction] = useState<(typeof ACTIONS)[number] | null>(null);

  const rows = useMemo(
    () => (onlyPending ? f.filtered.filter((r) => !F.comp(r)) : f.filtered),
    [f.filtered, onlyPending],
  );
  const sorted = useSorted(
    rows as unknown as Record<string, unknown>[],
    sort,
  ) as unknown as ProcRow[];
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

  return (
    <AppShell
      title="Buyer's Action"
      subtitle={
        userDepartments.length
          ? `Your departments: ${userDepartments.join(", ")}`
          : "All departments"
      }
    >
      <KpiGrid>
        <Kpi label="In your scope" value={f.base.length.toLocaleString()} />
        <Kpi label="Pending" tone="high" value={cnt(f.base, F.pend).toLocaleString()} />
        <Kpi label="Actioned" tone="low" value={cnt(f.base, F.comp).toLocaleString()} />
        <Kpi
          label="Critical"
          tone="crit"
          value={cnt(f.base, (r) => F.b7(r) || F.expired(r)).toLocaleString()}
        />
      </KpiGrid>

      <Filters f={f} />

      <Panel
        title="Your queue"
        sub={`${sorted.length} rows · ${selectedRows.length} selected`}
        icon={<Zap className="size-4 text-primary" />}
        badge={`${sorted.length}`}
        actions={
          <>
            <Tick checked={onlyPending} onChange={setOnlyPending} label="Hide completed" />
            <Button
              variant="export"
              onClick={() => {
                const ok = downloadSheet(sorted.map(flatRow), EXP_COLS, "Buyer_Actions");
                if (!ok) toast.error("Nothing to export");
              }}
            >
              <Download className="size-3.5" /> Export
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/50 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Apply to selection
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
              Clear
            </Button>
          )}
        </div>

        {sorted.length ? (
          <TableWrap maxHeight="60vh">
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
                <Th label="Prev. action" sortKey="prevaction" sort={sort} toggle={toggle} />
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
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(r._idx)) next.delete(r._idx);
                          else next.add(r._idx);
                          return next;
                        })
                      }
                      aria-label={`Select ${r.Article}`}
                    />
                  </td>
                  <td className="font-semibold">{r.StoreCode}</td>
                  <td className="font-mono font-semibold">{r.Article || "—"}</td>
                  <td className="max-w-[16rem] truncate">{r.Description || "—"}</td>
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
                  <td className="max-w-[12rem] truncate text-muted-foreground">
                    {r["Previous Action Info"] || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="Queue is clear" sub="No items awaiting your decision." />
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
