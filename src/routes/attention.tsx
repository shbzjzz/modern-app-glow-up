import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, Download, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/expiry/app-shell";
import { RowPopup } from "@/components/expiry/row-popup";
import {
  Button,
  Chips,
  EmptyState,
  Field,
  FilterBar,
  Kpi,
  KpiGrid,
  MultiSelect,
  Panel,
  Select,
  StatusBadge,
  TableWrap,
  Th,
  useSort,
  useSorted,
} from "@/components/expiry/ui";
import { useApp } from "@/lib/expiry/app-context";
import { useFilters } from "@/lib/expiry/filters";
import { downloadSheet } from "@/lib/expiry/export";
import type { ProcRow } from "@/lib/expiry/types";
import {
  attentionReasonMatch,
  isAttentionCandidate,
  scoreAttentionRow,
  type AttentionReason,
} from "@/lib/expiry/utils";

export const Route = createFileRoute("/attention")({
  head: () => ({
    meta: [
      { title: "Needs My Attention — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "A focused buyer work queue prioritised by RTC validity, expiry urgency, pending action and stock exposure.",
      },
    ],
  }),
  component: AttentionPage,
});

const REASONS: { value: AttentionReason; label: string }[] = [
  { value: "", label: "All reasons" },
  { value: "validity", label: "RTC Validity Expired" },
  { value: "pending", label: "Pending 14+ Days" },
  { value: "critical3", label: "Expiry ≤3 Days" },
  { value: "critical7", label: "Expiry ≤7 Days" },
  { value: "critical10", label: "Expiry ≤10 Days" },
  { value: "critical30", label: "Expiry ≤30 Days" },
  { value: "highstock", label: "High Stock" },
];

function AttentionPage() {
  const { isBuyer } = useApp();
  const f = useFilters();
  const { sort, toggle } = useSort({ key: "priority", dir: -1, type: "num" });
  const [reason, setReason] = useState<AttentionReason>("");
  const [popRow, setPopRow] = useState<ProcRow | null>(null);

  const scored = useMemo(() => {
    const base = f.base.filter(isAttentionCandidate);
    const withScope = base.filter((r) => {
      if (f.code && r.StoreCode !== f.code) return false;
      if (f.ym && r["Submission Month"] !== f.ym) return false;
      if (f.week && r.Week !== f.week) return false;
      if (f.status && r["Action Status"] !== f.status) return false;
      if (f.depts.length && !f.depts.includes(r.Department)) return false;
      if (reason && !attentionReasonMatch(r, reason)) return false;
      if (f.search.trim()) {
        const q = f.search.trim().toLowerCase();
        const hay =
          `${r.Article} ${r.Description} ${r.Barcode} ${r.Store} ${r.StoreCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return withScope
      .map((r) => ({ row: r, ...scoreAttentionRow(r) }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          (Number(a.row.DaysLeft) || 999) - (Number(b.row.DaysLeft) || 999) ||
          (parseFloat(b.row.Stock) || 0) - (parseFloat(a.row.Stock) || 0),
      );
  }, [f.base, f.code, f.ym, f.week, f.status, f.depts, f.search, reason]);

  const flat = useMemo(
    () =>
      scored.map(({ row, score, reason: why }) => ({
        ...row,
        _attentionScore: score,
        _attentionReason: why,
      })),
    [scored],
  );
  const sorted = useSorted(
    flat as unknown as Record<string, unknown>[],
    sort,
  ) as unknown as ProcRow[];

  const validity = scored.filter((s) => s.row["Action Status"] === "Validity Expired").length;
  const pending = scored.filter((s) => s.row["Action Status"] === "Pending Action").length;
  const critical = scored.filter((s) => Number(s.row.DaysLeft) <= 7).length;
  const highStock = scored.filter((s) => parseFloat(s.row.Stock) >= 20).length;

  const exportRows = () => {
    const data = sorted.map((r) => ({
      RowID: r.RowIndex,
      Priority: r["_attentionScore"],
      Reason: r["_attentionReason"],
      Store: r.Store,
      StoreCode: r.StoreCode,
      Article: r.Article,
      Barcode: r.Barcode,
      Description: r.Description,
      Department: r.Department,
      Stock: r.Stock,
      ExpiryDate: r.ExpiryDate,
      DaysLeft: r.DaysLeft,
      Status: r["Action Status"],
      PreviousAction: r["Previous Action Info"],
      PreviousPrice: r["Previous Price Info"],
      RTCEnd: r["Latest RTC End"] || r.End,
      ActionTaken: r["Action Taken"],
    }));
    const ok = downloadSheet(
      data,
      Object.keys(data[0] || {}),
      "NeedsMyAttention",
      "Needs My Attention",
    );
    if (!ok) toast.error("Nothing to export");
  };

  if (!isBuyer) {
    return (
      <AppShell title="Needs My Attention" subtitle="Buyer priority queue">
        <Panel>
          <EmptyState
            title="Buyers only"
            sub="This priority queue is only available to buyer accounts."
            icon={<AlertTriangle className="size-5" />}
          />
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Needs My Attention"
      subtitle="Prioritised by RTC validity, expiry urgency, pending action and stock exposure"
    >
      <KpiGrid>
        <Kpi
          label="Needs attention"
          tone="crit"
          value={scored.length}
          sub="Current filtered queue"
        />
        <Kpi label="Validity expired" tone="med" value={validity} sub="RTC validity ended" />
        <Kpi label="Pending" tone="high" value={pending} sub="Awaiting action" />
        <Kpi label="Critical ≤7 days" tone="crit" value={critical} sub="Expiry approaching" />
        <Kpi label="High stock" tone="brand" value={highStock} sub="20+ units remaining" />
      </KpiGrid>

      <div>
        <FilterBar>
          <Field label="Store code">
            <Select value={f.code} onChange={f.setCode}>
              <option value="">All</option>
              {f.codes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Month">
            <Select value={f.ym} onChange={f.setYm}>
              <option value="">All</option>
              {f.months.map((m) => (
                <option key={m.ym} value={m.ym}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Week">
            <Select value={f.week} onChange={f.setWeek}>
              <option value="">All</option>
              {f.weeks.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Department">
            <MultiSelect
              options={f.deptOptions}
              value={f.depts}
              onChange={f.setDepts}
              allLabel="All depts"
            />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={f.setStatus}>
              <option value="">All</option>
              <option value="Pending Action">Pending Action</option>
              <option value="Validity Expired">Validity Expired</option>
            </Select>
          </Field>
          <Field label="Reason">
            <Select value={reason} onChange={(v) => setReason(v as AttentionReason)}>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" className="min-w-[13rem] flex-1">
            <input
              className="h-9 rounded-lg border border-input bg-surface px-2.5 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Search article, barcode, description, store…"
              value={f.search}
              onChange={(e) => f.setSearch(e.target.value)}
            />
          </Field>
          <Button
            variant="ghost"
            onClick={() => {
              f.reset();
              setReason("");
            }}
          >
            Reset
          </Button>
        </FilterBar>
        <Chips items={f.activeChips} />
      </div>

      <Panel
        title="Priority queue"
        sub="Expired and zero-stock articles are excluded. Click any row to review the full record."
        icon={<ListChecks className="size-4 text-primary" />}
        badge={`${sorted.length} items`}
        actions={
          <Button variant="export" onClick={exportRows}>
            <Download className="size-3.5" /> Export
          </Button>
        }
      >
        {sorted.length ? (
          <TableWrap maxHeight="65vh">
            <thead>
              <tr>
                <Th label="Priority" sortKey="priority" type="num" sort={sort} toggle={toggle} />
                <Th label="Reason" sortKey="reason" sort={sort} toggle={toggle} />
                <Th label="Store" sortKey="store" sort={sort} toggle={toggle} />
                <Th label="Code" sortKey="code" sort={sort} toggle={toggle} />
                <Th label="Article" sortKey="article" sort={sort} toggle={toggle} />
                <Th label="Description" sortKey="desc" sort={sort} toggle={toggle} />
                <Th label="Stock" sortKey="stock" type="num" sort={sort} toggle={toggle} />
                <Th label="Expiry" sortKey="expiry" type="date" sort={sort} toggle={toggle} />
                <Th label="Days left" sortKey="days" type="num" sort={sort} toggle={toggle} />
                <Th label="Status" sortKey="status" sort={sort} toggle={toggle} />
                <Th label="RTC end" sortKey="rtc" sort={sort} toggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const days = Number(r.DaysLeft);
                const score = (r as ProcRow & { _attentionScore: number })["_attentionScore"];
                const reasonTxt = (r as ProcRow & { _attentionReason: string })["_attentionReason"];
                return (
                  <tr key={r._idx} className="cursor-pointer" onClick={() => setPopRow(r)}>
                    <td>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          score >= 95
                            ? "border-med/30 bg-med-soft text-med"
                            : score >= 85
                              ? "border-high/25 bg-high-soft text-high"
                              : "border-info/25 bg-info-soft text-info"
                        }`}
                      >
                        {score}
                      </span>
                    </td>
                    <td className="text-[11px] font-semibold">{reasonTxt}</td>
                    <td className="font-semibold">{r.Store || "—"}</td>
                    <td className="font-mono">{r.StoreCode || "—"}</td>
                    <td className="font-mono font-semibold">{r.Article || "—"}</td>
                    <td className="max-w-[16rem] truncate">{r.Description || "—"}</td>
                    <td className="font-mono font-semibold tabular-nums">{r.Stock || "—"}</td>
                    <td className="font-mono">{r.ExpiryDate || "—"}</td>
                    <td
                      className={`tabular-nums font-semibold ${days <= 7 ? "text-crit" : "text-high"}`}
                    >
                      {days}
                    </td>
                    <td>
                      <StatusBadge status={r["Action Status"]} />
                    </td>
                    <td className="font-mono text-[11px]">{r["Latest RTC End"] || r.End || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="Nothing currently needs your attention"
            sub="Every open item outside your filters is either resolved or below the risk threshold."
            icon={<ListChecks className="size-5" />}
          />
        )}
      </Panel>

      <RowPopup row={popRow} onClose={() => setPopRow(null)} />
    </AppShell>
  );
}
