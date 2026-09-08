import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Layers,
  PackageX,
  Store as StoreIcon,
  TimerReset,
} from "lucide-react";
import { AppShell } from "@/components/expiry/app-shell";
import { RowPopup } from "@/components/expiry/row-popup";
import {
  BarChart,
  Chips,
  Field,
  FilterBar,
  Kpi,
  KpiGrid,
  Modal,
  MultiSelect,
  Panel,
  PanelBody,
  RiskBadge,
  SearchInput,
  Select,
  StatusBadge,
  StoreDisplay,
  TableWrap,
  Button,
  EmptyState,
} from "@/components/expiry/ui";
import { useApp } from "@/lib/expiry/app-context";
import { useFilters } from "@/lib/expiry/filters";
import type { ProcRow } from "@/lib/expiry/types";
import { BUCKET_ORDER, F, cnt, isOverdueRow, totalStock } from "@/lib/expiry/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Live overview of near-expiry stock, pending buyer actions, risk buckets and store performance across Gala Markets.",
      },
      { property: "og:title", content: "Overview — Gala Markets Expiry Dashboard" },
      {
        property: "og:description",
        content: "Live near-expiry stock KPIs, risk buckets and store performance.",
      },
    ],
  }),
  component: OverviewPage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function OverviewPage() {
  const { user, codeToStore } = useApp();
  const f = useFilters();
  const d = f.filtered;
  const [drill, setDrill] = useState<{ title: string; rows: ProcRow[] } | null>(null);
  const [popRow, setPopRow] = useState<ProcRow | null>(null);

  const buckets = useMemo(
    () =>
      BUCKET_ORDER.map((b) => ({
        label: b,
        value: d.filter((r) => r["Expiry Risk Bucket"] === b).length,
      })).filter((x) => x.value > 0),
    [d],
  );

  const byDept = useMemo(() => {
    const m = new Map<string, number>();
    d.forEach((r) => m.set(r.Department || "—", (m.get(r.Department || "—") || 0) + 1));
    return [...m]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [d]);

  const byStore = useMemo(() => {
    const m = new Map<string, { total: number; pending: number }>();
    d.forEach((r) => {
      const k = r.StoreCode || "—";
      const cur = m.get(k) || { total: 0, pending: 0 };
      cur.total += 1;
      if (F.pend(r)) cur.pending += 1;
      m.set(k, cur);
    });
    return [...m]
      .map(([code, v]) => ({ code, name: codeToStore[code] || code, ...v }))
      .sort((a, b) => b.pending - a.pending || b.total - a.total)
      .slice(0, 8);
  }, [d, codeToStore]);

  const urgent = useMemo(
    () =>
      d
        .filter((r) => F.pend(r) && (F.le7(r) || F.expired(r)))
        .sort((a, b) => Number(a.DaysLeft || 0) - Number(b.DaysLeft || 0))
        .slice(0, 12),
    [d],
  );

  const pending = cnt(d, F.pend);
  const done = cnt(d, F.comp);
  const compliance = d.length ? Math.round((done / d.length) * 100) : 0;

  const open = (title: string, rows: ProcRow[]) => setDrill({ title, rows });

  return (
    <AppShell
      title="Overview"
      subtitle="Portfolio-wide expiry risk and action performance"
    >
      {/* Greeting */}
      <section className="overflow-hidden rounded-2xl border border-border brand-gradient p-5 text-primary-foreground shadow-lift">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
              {greeting()}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold">
              {user?.username || "there"} 👋
            </h2>
            <p className="mt-1 text-sm opacity-85">
              {pending > 0
                ? `${pending} item${pending === 1 ? "" : "s"} still need a buyer decision today.`
                : "Everything in view has been actioned. Nice work."}
            </p>
          </div>
          <div className="flex gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider opacity-80">Compliance</p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {compliance}%
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider opacity-80">Overdue</p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {cnt(d, isOverdueRow)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Filters f={f} />

      <KpiGrid>
        <Kpi
          label="Total items"
          value={d.length.toLocaleString()}
          sub={`${totalStock(d).toLocaleString()} units at risk`}
          icon={<Layers className="size-3.5" />}
          onClick={() => open("All items", d)}
        />
        <Kpi
          label="Pending action"
          tone="high"
          value={pending.toLocaleString()}
          sub="Awaiting buyer decision"
          icon={<ClipboardList className="size-3.5" />}
          onClick={() => open("Pending action", d.filter(F.pend))}
        />
        <Kpi
          label="Action taken"
          tone="low"
          value={done.toLocaleString()}
          sub={`${compliance}% of items`}
          icon={<CheckCircle2 className="size-3.5" />}
          onClick={() => open("Action taken", d.filter(F.comp))}
        />
        <Kpi
          label="Expiring < 7 days"
          tone="crit"
          value={cnt(d, F.b7).toLocaleString()}
          sub="Immediate attention"
          icon={<AlertTriangle className="size-3.5" />}
          onClick={() => open("Expiring in under 7 days", d.filter(F.b7))}
        />
        <Kpi
          label="Expired"
          tone="crit"
          value={cnt(d, F.expired).toLocaleString()}
          sub="Past expiry date"
          icon={<TimerReset className="size-3.5" />}
          onClick={() => open("Expired items", d.filter(F.expired))}
        />
        <Kpi
          label="Sold out"
          tone="info"
          value={cnt(d, F.soldout).toLocaleString()}
          sub="Zero stock on hand"
          icon={<PackageX className="size-3.5" />}
          onClick={() => open("Sold out items", d.filter(F.soldout))}
        />
        <Kpi
          label="7–30 days"
          tone="med"
          value={cnt(d, F.b30).toLocaleString()}
          sub="Plan RTC or transfer"
          icon={<CalendarClock className="size-3.5" />}
          onClick={() => open("Expiring in 7–30 days", d.filter(F.b30))}
        />
        <Kpi
          label="Stores reporting"
          tone="brand"
          value={new Set(d.map((r) => r.StoreCode).filter(Boolean)).size}
          sub={`${new Set(d.map((r) => r.Department).filter(Boolean)).size} departments`}
          icon={<StoreIcon className="size-3.5" />}
        />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Risk distribution" sub="Items by expiry bucket" badge={`${d.length} items`}>
          <PanelBody>
            <BarChart data={buckets} tone="crit" />
          </PanelBody>
        </Panel>
        <Panel title="Top departments" sub="Where the risk is concentrated">
          <PanelBody>
            <BarChart data={byDept} />
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Panel title="Stores needing attention" sub="Ranked by pending actions">
          {byStore.length ? (
            <TableWrap maxHeight="22rem">
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Items</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {byStore.map((s) => (
                  <tr
                    key={s.code}
                    className="cursor-pointer"
                    onClick={() =>
                      open(
                        `${s.name} (${s.code})`,
                        d.filter((r) => r.StoreCode === s.code),
                      )
                    }
                  >
                    <td>
                      <span className="font-semibold text-foreground">{s.code}</span>
                      <span className="ml-2 text-muted-foreground">{s.name}</span>
                    </td>
                    <td className="tabular-nums">{s.total}</td>
                    <td>
                      <span className="font-semibold text-high tabular-nums">{s.pending}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="No store data" sub="Adjust the filters above." icon={<StoreIcon className="size-5" />} />
          )}
        </Panel>

        <Panel
          title="Urgent queue"
          sub="Pending items expiring within 7 days or already expired"
          badge={`${urgent.length}`}
        >
          {urgent.length ? (
            <TableWrap maxHeight="22rem">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Description</th>
                  <th>Store</th>
                  <th>Days</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {urgent.map((r) => (
                  <tr key={r._idx} className="cursor-pointer" onClick={() => setPopRow(r)}>
                    <td className="font-mono font-semibold">{r.Article || "—"}</td>
                    <td className="max-w-[16rem] truncate">{r.Description || "—"}</td>
                    <td>{r.StoreCode}</td>
                    <td className="tabular-nums">{r.DaysLeft === "" ? "—" : r.DaysLeft}</td>
                    <td>
                      <RiskBadge bucket={r["Expiry Risk Bucket"]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="Nothing urgent"
              sub="No pending items expiring inside 7 days."
              icon={<CheckCircle2 className="size-5" />}
            />
          )}
        </Panel>
      </div>

      <Modal
        open={!!drill}
        onClose={() => setDrill(null)}
        title={drill?.title || ""}
        sub={`${drill?.rows.length || 0} items`}
        icon={<Boxes className="size-4" />}
        width="max-w-5xl"
        footer={<Button onClick={() => setDrill(null)}>Close</Button>}
      >
        {drill?.rows.length ? (
          <TableWrap maxHeight="60vh">
            <thead>
              <tr>
                <th>Article</th>
                <th>Description</th>
                <th>Store</th>
                <th>Dept</th>
                <th>Stock</th>
                <th>Expiry</th>
                <th>Risk</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drill.rows.slice(0, 500).map((r) => (
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
                  <td>{r.StoreCode}</td>
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

export function Filters({ f }: { f: ReturnType<typeof useFilters> }) {
  return (
    <div>
      <FilterBar>
        <Field label="Store code">
          <Select value={f.code} onChange={f.setCode}>
            <option value="">All stores</option>
            {f.codes.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Store name">
          <StoreDisplay name={f.code ? f.storeName : "All stores"} />
        </Field>
        <Field label="Submission month">
          <Select value={f.ym} onChange={f.setYm}>
            <option value="">All months</option>
            {f.months.map((m) => (
              <option key={m.ym} value={m.ym}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Week">
          <Select value={f.week} onChange={f.setWeek}>
            <option value="">All weeks</option>
            {f.weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Departments">
          <MultiSelect
            options={f.deptOptions}
            value={f.depts}
            onChange={f.setDepts}
            allLabel="All departments"
          />
        </Field>
        <Field label="Risk bucket">
          <MultiSelect
            options={f.bucketOptions}
            value={f.buckets}
            onChange={f.setBuckets}
            allLabel="All risk levels"
          />
        </Field>
        <Field label="Status">
          <Select value={f.status} onChange={f.setStatus}>
            <option value="">All statuses</option>
            <option value="Pending Action">Pending Action</option>
            <option value="Previously Actioned">Previously Actioned</option>
            <option value="Action Taken">Action Taken</option>
          </Select>
        </Field>
        <Field label="Search" className="min-w-[13rem] flex-1">
          <SearchInput
            value={f.search}
            onChange={f.setSearch}
            placeholder="Article, barcode or description"
          />
        </Field>
        <Button variant="ghost" onClick={f.reset}>
          Reset
        </Button>
      </FilterBar>
      <Chips items={f.activeChips} />
    </div>
  );
}
