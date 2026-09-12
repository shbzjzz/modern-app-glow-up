import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardCheck, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/expiry/app-shell";
import {
  Button,
  Chips,
  EmptyState,
  Field,
  FilterBar,
  Kpi,
  KpiGrid,
  Modal,
  Panel,
  Select,
  TableWrap,
  Th,
  useSort,
  useSorted,
} from "@/components/expiry/ui";
import { useApp } from "@/lib/expiry/app-context";
import { useFilters } from "@/lib/expiry/filters";
import { downloadSheet } from "@/lib/expiry/export";
import { CF_API, apiFetch } from "@/lib/expiry/api";
import { currentMonthYm } from "@/lib/expiry/utils";

export const Route = createFileRoute("/submission")({
  head: () => ({
    meta: [
      { title: "Submission Status — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Track which stores have submitted their weekly expiry report and send reminders to the ones that have not.",
      },
      { property: "og:title", content: "Submission Status — Gala Markets" },
      {
        property: "og:description",
        content: "Weekly expiry report submission tracking and reminders.",
      },
    ],
  }),
  component: SubmissionPage,
});

function SubmissionPage() {
  const { isAdmin } = useApp();
  const f = useFilters();
  const { sort, toggle } = useSort({ key: "code", dir: 1, type: "str" });
  const [remind, setRemind] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const scoped = f.base.filter(
      (r) =>
        (!f.ym || r["Submission Month"] === f.ym) && (!f.week || r.Week === f.week),
    );
    const byStore = new Map<string, number>();
    scoped.forEach((r) =>
      byStore.set(r.StoreCode, (byStore.get(r.StoreCode) || 0) + 1),
    );
    const lastSeen = new Map<string, string>();
    scoped.forEach((r) => {
      const cur = lastSeen.get(r.StoreCode);
      if (!cur || r.Week > cur) lastSeen.set(r.StoreCode, r.Week);
    });
    return f.codes.map((c) => {
      const items = byStore.get(c.code) || 0;
      return {
        code: c.code,
        store: c.name,
        items,
        week: lastSeen.get(c.code) || "—",
        submitted: items > 0 ? "Submitted" : "Not submitted",
      };
    });
  }, [f.base, f.codes, f.ym, f.week]);

  const sorted = useSorted(
    rows as unknown as Record<string, unknown>[],
    sort,
  ) as unknown as typeof rows;
  const missing = rows.filter((r) => r.items === 0);

  const send = async () => {
    if (!picked.length) {
      toast.error("Select at least one store");
      return;
    }
    setBusy(true);
    try {
      const out = await apiFetch(`${CF_API}?action=sendSubmissionReminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeCodes: picked,
          week: f.week || "Current Week",
          submissionMonth: f.ym || currentMonthYm(),
        }),
      }).then((r) => r.json());
      if (out.success) {
        toast.success(out.message || "Reminders sent");
        setRemind(false);
        setPicked([]);
      } else toast.error(out.message || "Failed to send reminders");
    } catch {
      toast.error("Network error sending reminders");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Submission Status" subtitle="Who has reported expiry this period">
      <KpiGrid>
        <Kpi label="Stores tracked" value={rows.length} />
        <Kpi label="Submitted" tone="low" value={rows.length - missing.length} />
        <Kpi label="Not submitted" tone="crit" value={missing.length} />
        <Kpi
          label="Submission rate"
          tone="brand"
          value={`${rows.length ? Math.round(((rows.length - missing.length) / rows.length) * 100) : 0}%`}
        />
      </KpiGrid>

      <div>
        <FilterBar>
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
          <Button variant="ghost" onClick={f.reset}>
            Reset
          </Button>
        </FilterBar>
        <Chips items={f.activeChips} />
      </div>

      <Panel
        title="Stores"
        sub={`${sorted.length} stores`}
        icon={<ClipboardCheck className="size-4 text-primary" />}
        badge={`${missing.length} missing`}
        actions={
          <>
            <Button
              variant="export"
              onClick={() => {
                const ok = downloadSheet(
                  sorted as unknown as Record<string, unknown>[],
                  ["code", "store", "week", "items", "submitted"],
                  "Submission_Status",
                  "Submissions",
                );
                if (!ok) toast.error("Nothing to export");
              }}
            >
              <Download className="size-3.5" /> Export
            </Button>
            {isAdmin && (
              <Button
                variant="primary"
                onClick={() => {
                  setPicked(missing.map((m) => m.code));
                  setRemind(true);
                }}
                disabled={!missing.length}
              >
                <Send className="size-3.5" /> Send reminders
              </Button>
            )}
          </>
        }
      >
        {sorted.length ? (
          <TableWrap maxHeight="60vh">
            <thead>
              <tr>
                <Th label="Code" sortKey="code" sort={sort} toggle={toggle} />
                <Th label="Store" sortKey="store" sort={sort} toggle={toggle} />
                <Th label="Latest week" sortKey="week" sort={sort} toggle={toggle} />
                <Th label="Items" sortKey="items" type="num" sort={sort} toggle={toggle} />
                <Th label="Status" sortKey="submitted" sort={sort} toggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.code}>
                  <td className="font-semibold">{s.code}</td>
                  <td>{s.store}</td>
                  <td>{s.week}</td>
                  <td className="tabular-nums">{s.items}</td>
                  <td>
                    <span
                      className={
                        s.items
                          ? "inline-flex rounded-full border border-low/25 bg-low-soft px-2 py-0.5 text-[10px] font-semibold text-low"
                          : "inline-flex rounded-full border border-crit/25 bg-crit-soft px-2 py-0.5 text-[10px] font-semibold text-crit"
                      }
                    >
                      {s.submitted}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No stores" sub="No stores are available for this view." />
        )}
      </Panel>

      <Modal
        open={remind}
        onClose={() => setRemind(false)}
        title="Send submission reminders"
        sub={`${picked.length} store${picked.length === 1 ? "" : "s"} selected`}
        icon={<Send className="size-4" />}
        footer={
          <>
            <Button onClick={() => setRemind(false)}>Cancel</Button>
            <Button variant="primary" onClick={send} disabled={busy || !picked.length}>
              {busy ? "Sending…" : "Send reminders"}
            </Button>
          </>
        }
      >
        <div className="scroll-slim max-h-72 overflow-auto rounded-xl border border-border p-2">
          {missing.length ? (
            missing.map((m) => (
              <label
                key={m.code}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted"
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={picked.includes(m.code)}
                  onChange={(e) =>
                    setPicked((p) =>
                      e.target.checked ? [...p, m.code] : p.filter((x) => x !== m.code),
                    )
                  }
                />
                <span className="font-semibold">{m.code}</span>
                <span className="text-muted-foreground">{m.store}</span>
              </label>
            ))
          ) : (
            <p className="p-3 text-xs text-muted-foreground">Every store has submitted.</p>
          )}
        </div>
      </Modal>
    </AppShell>
  );
}
