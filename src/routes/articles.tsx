import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Boxes, Download } from "lucide-react";
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
import { useFilters } from "@/lib/expiry/filters";
import { downloadSheet } from "@/lib/expiry/export";
import type { ProcRow } from "@/lib/expiry/types";
import { F, totalStock } from "@/lib/expiry/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/articles")({
  head: () => ({
    meta: [
      { title: "Article View — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Group near-expiry stock by article to spot repeat offenders across stores and departments.",
      },
      { property: "og:title", content: "Article View — Gala Markets" },
      {
        property: "og:description",
        content: "Article-level view of near-expiry stock across all stores.",
      },
    ],
  }),
  component: ArticlesPage,
});

function ArticlesPage() {
  const f = useFilters();
  const { sort, toggle } = useSort({ key: "items", dir: -1, type: "num" });
  const [drill, setDrill] = useState<{ label: string; rows: ProcRow[] } | null>(null);
  const [popRow, setPopRow] = useState<ProcRow | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, ProcRow[]>();
    f.filtered.forEach((r) => {
      const k = r.Article || r.Barcode || r.Description || "—";
      m.set(k, [...(m.get(k) || []), r]);
    });
    return [...m].map(([article, rows]) => ({
      article,
      description: rows[0]?.Description || "—",
      dept: rows[0]?.Department || "—",
      stores: new Set(rows.map((r) => r.StoreCode)).size,
      items: rows.length,
      units: totalStock(rows),
      pending: rows.filter(F.pend).length,
      crit: rows.filter((r) => F.b7(r) || F.expired(r)).length,
      rows,
    }));
  }, [f.filtered]);

  const sorted = useSorted(
    grouped as unknown as Record<string, unknown>[],
    sort,
  ) as unknown as typeof grouped;

  const exportArticles = () => {
    const data = sorted.map(({ rows: _r, ...rest }) => rest);
    const ok = downloadSheet(data, Object.keys(data[0] || {}), "Article_View", "Articles");
    if (!ok) toast.error("Nothing to export");
  };

  return (
    <AppShell title="Article View" subtitle="Expiry exposure grouped by article">
      <Filters f={f} />

      <Panel
        title="Articles"
        sub={`${sorted.length} distinct articles`}
        icon={<Boxes className="size-4 text-primary" />}
        badge={`${sorted.length}`}
        actions={
          <Button variant="export" onClick={exportArticles}>
            <Download className="size-3.5" /> Export
          </Button>
        }
      >
        {sorted.length ? (
          <TableWrap maxHeight="65vh">
            <thead>
              <tr>
                <Th label="Article" sortKey="article" sort={sort} toggle={toggle} />
                <Th label="Description" sortKey="description" sort={sort} toggle={toggle} />
                <Th label="Dept" sortKey="dept" sort={sort} toggle={toggle} />
                <Th label="Stores" sortKey="stores" type="num" sort={sort} toggle={toggle} />
                <Th label="Rows" sortKey="items" type="num" sort={sort} toggle={toggle} />
                <Th label="Units" sortKey="units" type="num" sort={sort} toggle={toggle} />
                <Th label="Pending" sortKey="pending" type="num" sort={sort} toggle={toggle} />
                <Th label="Critical" sortKey="crit" type="num" sort={sort} toggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr
                  key={a.article}
                  className="cursor-pointer"
                  onClick={() => setDrill({ label: `${a.article} · ${a.description}`, rows: a.rows })}
                >
                  <td className="font-mono font-semibold">{a.article}</td>
                  <td className="max-w-[20rem] truncate">{a.description}</td>
                  <td>{a.dept}</td>
                  <td className="tabular-nums">{a.stores}</td>
                  <td className="tabular-nums">{a.items}</td>
                  <td className="tabular-nums">{a.units.toLocaleString()}</td>
                  <td className="font-semibold text-high tabular-nums">{a.pending}</td>
                  <td className="text-crit tabular-nums">{a.crit}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No articles match" sub="Try widening the filters." />
        )}
      </Panel>

      <Modal
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill?.label || ""}
        sub={`${drill?.rows.length || 0} rows across stores`}
        icon={<Boxes className="size-4" />}
        width="max-w-5xl"
        footer={<Button onClick={() => setDrill(null)}>Close</Button>}
      >
        {drill?.rows.length ? (
          <TableWrap maxHeight="60vh">
            <thead>
              <tr>
                <th>Store</th>
                <th>Stock</th>
                <th>Expiry</th>
                <th>Days</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Action</th>
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
                  <td className="font-semibold">{r.StoreCode}</td>
                  <td className="tabular-nums">{r.Stock || "—"}</td>
                  <td className="font-mono">{r.ExpiryDate || "—"}</td>
                  <td className="tabular-nums">{r.DaysLeft === "" ? "—" : r.DaysLeft}</td>
                  <td>
                    <RiskBadge bucket={r["Expiry Risk Bucket"]} />
                  </td>
                  <td>
                    <StatusBadge status={r["Action Status"]} />
                  </td>
                  <td className="max-w-[12rem] truncate">{r["Action Taken"] || "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No rows" />
        )}
      </Modal>

      <RowPopup row={popRow} onClose={() => setPopRow(null)} />
    </AppShell>
  );
}
