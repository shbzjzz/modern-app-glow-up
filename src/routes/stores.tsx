import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Store as StoreIcon } from "lucide-react";
import { AppShell } from "@/components/expiry/app-shell";
import {
  Button,
  EmptyState,
  Modal,
  Panel,
  RiskBadge,
  StatusBadge,
  TableWrap,
  Th,
  useSort,
  useSorted,
} from "@/components/expiry/ui";
import { Filters } from "@/routes/index";
import { RowPopup } from "@/components/expiry/row-popup";
import { useApp } from "@/lib/expiry/app-context";
import { useFilters } from "@/lib/expiry/filters";
import { downloadSheet } from "@/lib/expiry/export";
import type { ProcRow } from "@/lib/expiry/types";
import { F, totalStock } from "@/lib/expiry/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/stores")({
  head: () => ({
    meta: [
      { title: "Store Summary — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Compare expiry exposure, pending actions and compliance across every Gala Markets store.",
      },
      { property: "og:title", content: "Store Summary — Gala Markets" },
      {
        property: "og:description",
        content: "Store-by-store expiry exposure, pending actions and compliance rates.",
      },
    ],
  }),
  component: StoresPage,
});

function StoresPage() {
  const { codeToStore } = useApp();
  const f = useFilters();
  const { sort, toggle } = useSort({ key: "pending", dir: -1, type: "num" });
  const [drill, setDrill] = useState<{ code: string; rows: ProcRow[] } | null>(null);
  const [popRow, setPopRow] = useState<ProcRow | null>(null);

  const summary = useMemo(() => {
    const m = new Map<string, ProcRow[]>();
    f.filtered.forEach((r) => {
      const k = r.StoreCode || "—";
      m.set(k, [...(m.get(k) || []), r]);
    });
    return [...m].map(([code, rows]) => ({
      code,
      store: codeToStore[code] || rows[0]?.Store || code,
      items: rows.length,
      units: totalStock(rows),
      pending: rows.filter(F.pend).length,
      done: rows.filter(F.comp).length,
      crit: rows.filter((r) => F.b7(r) || F.expired(r)).length,
      soldout: rows.filter(F.soldout).length,
      compliance: rows.length ? Math.round((rows.filter(F.comp).length / rows.length) * 100) : 0,
      rows,
    }));
  }, [f.filtered, codeToStore]);

  const sorted = useSorted(
    summary as unknown as Record<string, unknown>[],
    sort,
  ) as unknown as typeof summary;

  const exportSummary = () => {
    const data = sorted.map(({ rows: _rows, ...rest }) => rest);
    const ok = downloadSheet(data, Object.keys(data[0] || {}), "Store_Summary", "Stores");
    if (!ok) toast.error("Nothing to export");
  };

  return (
    <AppShell title="Store Summary" subtitle="Expiry exposure and compliance per store">
      <Filters f={f} />

      <Panel
        title="Stores"
        sub={`${sorted.length} stores in view`}
        icon={<StoreIcon className="size-4 text-primary" />}
        badge={`${sorted.length}`}
        actions={
          <Button variant="export" onClick={exportSummary}>
            <Download className="size-3.5" /> Export
          </Button>
        }
      >
        {sorted.length ? (
          <TableWrap maxHeight="65vh">
            <thead>
              <tr>
                <Th label="Code" sortKey="code" sort={sort} toggle={toggle} />
                <Th label="Store" sortKey="store" sort={sort} toggle={toggle} />
                <Th label="Items" sortKey="items" type="num" sort={sort} toggle={toggle} />
                <Th label="Units" sortKey="units" type="num" sort={sort} toggle={toggle} />
                <Th label="Pending" sortKey="pending" type="num" sort={sort} toggle={toggle} />
                <Th label="Actioned" sortKey="done" type="num" sort={sort} toggle={toggle} />
                <Th label="Critical" sortKey="crit" type="num" sort={sort} toggle={toggle} />
                <Th label="Sold out" sortKey="soldout" type="num" sort={sort} toggle={toggle} />
                <Th
                  label="Compliance"
                  sortKey="compliance"
                  type="num"
                  sort={sort}
                  toggle={toggle}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr
                  key={s.code}
                  className="cursor-pointer"
                  onClick={() => setDrill({ code: s.code, rows: s.rows })}
                >
                  <td className="font-semibold">{s.code}</td>
                  <td>{s.store}</td>
                  <td className="tabular-nums">{s.items}</td>
                  <td className="tabular-nums">{s.units.toLocaleString()}</td>
                  <td className="font-semibold text-high tabular-nums">{s.pending}</td>
                  <td className="text-low tabular-nums">{s.done}</td>
                  <td className="text-crit tabular-nums">{s.crit}</td>
                  <td className="tabular-nums">{s.soldout}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full brand-gradient"
                          style={{ width: `${s.compliance}%` }}
                        />
                      </div>
                      <span className="tabular-nums">{s.compliance}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No stores match" sub="Adjust the filters to see store data." />
        )}
      </Panel>

      <Modal
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill ? `${codeToStore[drill.code] || drill.code} (${drill.code})` : ""}
        sub={`${drill?.rows.length || 0} items`}
        icon={<StoreIcon className="size-4" />}
        width="max-w-5xl"
        footer={<Button onClick={() => setDrill(null)}>Close</Button>}
      >
        {drill?.rows.length ? (
          <TableWrap maxHeight="60vh">
            <thead>
              <tr>
                <th>Article</th>
                <th>Description</th>
                <th>Dept</th>
                <th>Stock</th>
                <th>Expiry</th>
                <th>Risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drill.rows.map((r) => (
                <tr
                  key={r._idx}
                  className="cursor-pointer"
                  onClick={() => {
                    setPopRow(r);
                    setDrill(null);
                  }}
                >
                  <td className="font-mono font-semibold">{r.Article || "—"}</td>
                  <td className="max-w-[18rem] truncate">{r.Description || "—"}</td>
                  <td>{r.Department || "—"}</td>
                  <td className="tabular-nums">{r.Stock || "—"}</td>
                  <td className="font-mono">{r.ExpiryDate || "—"}</td>
                  <td>
                    <RiskBadge bucket={r["Expiry Risk Bucket"]} />
                  </td>
                  <td>
                    <StatusBadge status={r["Action Status"]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No items" />
        )}
      </Modal>

      <RowPopup row={popRow} onClose={() => setPopRow(null)} />
    </AppShell>
  );
}
