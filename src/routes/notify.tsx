import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Mail, Send } from "lucide-react";
import { AppShell } from "@/components/expiry/app-shell";
import {
  Button,
  Chips,
  EmptyState,
  Field,
  FilterBar,
  MultiSelect,
  Panel,
  Select,
  StoreDisplay,
  TableWrap,
  Tick,
} from "@/components/expiry/ui";
import { useApp } from "@/lib/expiry/app-context";
import { useFilters } from "@/lib/expiry/filters";
import { downloadSheet } from "@/lib/expiry/export";
import {
  F,
  applyBuyerTemplate,
  currentMonthYm,
  currentWeekLabel,
  getBuyerSettings,
  ymLabel,
  type BuyerSettings,
} from "@/lib/expiry/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/notify")({
  head: () => ({
    meta: [
      { title: "Notify Store — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Build a store-ready list of actioned expiry items with RTC prices, dates and transfer instructions.",
      },
      { property: "og:title", content: "Notify Store — Gala Markets" },
      {
        property: "og:description",
        content: "Share actioned RTC and transfer instructions with each store.",
      },
    ],
  }),
  component: NotifyPage,
});

export function NotifyPage() {
  const { emailMap, codeToStore } = useApp();
  const f = useFilters();
  const [settings, setSettings] = useState<BuyerSettings>(getBuyerSettings());
  const [rtc, setRtc] = useState(settings.rtc);
  const [transfer, setTransfer] = useState(settings.transfer);
  const [monitor, setMonitor] = useState(settings.monitor);
  const [clear, setClear] = useState(settings.clear);

  useEffect(() => {
    const s = getBuyerSettings();
    setSettings(s);
    setRtc(s.rtc);
    setTransfer(s.transfer);
    setMonitor(s.monitor);
    setClear(s.clear);
  }, []);

  // default to the current month/week, matching the original dashboard
  useEffect(() => {
    if (!f.ym) f.setYm(currentMonthYm());
    if (!f.week) f.setWeek(currentWeekLabel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    if (!f.code) return [];
    return f.filtered.filter((r) => {
      if (!F.comp(r)) return false;
      const act = r["Action Taken"] || "";
      if (rtc && act.includes("RTC Price Change")) return true;
      if (transfer && act.includes("Store Transfer")) return true;
      if (monitor && act.includes("Monitor")) return true;
      if (clear && act.includes("Clear In Normal Price")) return true;
      return false;
    });
  }, [f.filtered, f.code, rtc, transfer, monitor, clear]);

  const cols = useMemo(() => {
    const base = ["Article", "Barcode", "Description", "Expiry Date"];
    const out = [...base];
    if (rtc) out.push("RTC Price", "Start", "End");
    if (transfer) out.push("Transfer To", "Transfer Qty");
    return out;
  }, [rtc, transfer]);

  const recipients = emailMap.find((e) => e.storeCode === f.code);

  const exportList = () => {
    const data = rows.map((r) => ({
      Article: r.Article,
      Barcode: r.Barcode,
      Description: r.Description,
      "Expiry Date": r.ExpiryDate,
      "Action Taken": r["Action Taken"],
      "RTC Price": r["RTC Price"],
      Start: r.Start,
      End: r.End,
      "Transfer To": r["Transfer To"],
      "Transfer Qty": r["Transfer Qty"],
    }));
    const ok = downloadSheet(
      data,
      Object.keys(data[0] || {}),
      `Notify_${f.code || "Store"}`,
      "Notify",
    );
    if (!ok) toast.error("Nothing to export");
  };

  const copyList = async () => {
    if (!rows.length) {
      toast.error("Nothing to copy");
      return;
    }
    const text = [
      cols.join("\t"),
      ...rows.map((r) =>
        [
          r.Article,
          r.Barcode,
          r.Description,
          r.ExpiryDate,
          ...(rtc ? [r["RTC Price"], r.Start, r.End] : []),
          ...(transfer ? [r["Transfer To"], r["Transfer Qty"]] : []),
        ].join("\t"),
      ),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    toast.success("List copied to clipboard");
  };

  const mailto = () => {
    if (!f.code) {
      toast.error("Select a store first");
      return;
    }
    if (!rows.length) {
      toast.error("No actioned items to send");
      return;
    }
    if (
      settings.confirm &&
      !window.confirm(
        `Open Notify Store email for ${codeToStore[f.code] || f.code}?\n\n${rows.length} actioned item(s) will be copied.`,
      )
    ) {
      return;
    }
    const ctx = {
      store: codeToStore[f.code] || f.code,
      code: f.code,
      week: f.week || "All Weeks",
      month: f.ym ? ymLabel(f.ym) : "All Months",
      count: rows.length,
      date: new Date().toLocaleDateString(),
      body: rows
        .slice(0, 40)
        .map(
          (r) =>
            `${r.Article} · ${r.Description} · exp ${r.ExpiryDate}` +
            (r["RTC Price"] ? ` · RTC ${r["RTC Price"]}` : "") +
            (r["Transfer To"] ? ` · transfer to ${r["Transfer To"]}` : ""),
        )
        .join("\n"),
    };
    const subject = applyBuyerTemplate(settings.subject, ctx);
    const body = applyBuyerTemplate(settings.body, ctx);
    const cc = settings.cc
      ? `&cc=${encodeURIComponent(settings.cc)}`
      : recipients?.ccEmail
        ? `&cc=${encodeURIComponent(recipients.ccEmail)}`
        : "";
    window.location.href = `mailto:${recipients?.toEmail || ""}?subject=${encodeURIComponent(subject)}${cc}&body=${encodeURIComponent(body)}`;
  };

  return (
    <AppShell title="Notify Store" subtitle="Send actioned items to the store team">
      <div>
        <FilterBar>
          <Field label="Store code">
            <Select value={f.code} onChange={f.setCode}>
              <option value="">Select store…</option>
              {f.codes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Store name">
            <StoreDisplay name={f.code ? f.storeName : "—"} />
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
          <Button variant="ghost" onClick={f.reset}>
            Reset
          </Button>
        </FilterBar>
        <Chips items={f.activeChips} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tick checked={rtc} onChange={setRtc} label="RTC Price Change" />
        <Tick checked={transfer} onChange={setTransfer} label="Store Transfer" />
        <Tick checked={monitor} onChange={setMonitor} label="Monitor" />
        <Tick checked={clear} onChange={setClear} label="Clear In Normal Price" />
      </div>

      {f.code && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-xs shadow-card">
          <Mail className="size-4 text-primary" />
          <span className="text-muted-foreground">To</span>
          <strong className="text-foreground">{recipients?.toEmail || "not configured"}</strong>
          <span className="text-muted-foreground">Cc</span>
          <strong className="text-foreground">{settings.cc || recipients?.ccEmail || "—"}</strong>
        </div>
      )}

      <Panel
        title="Actioned items"
        sub={f.code ? `${f.storeName} · ${rows.length} items` : "Select a store to begin"}
        badge={`${rows.length} items`}
        actions={
          <>
            <Button onClick={copyList} disabled={!rows.length}>
              Copy list
            </Button>
            <Button variant="export" onClick={exportList} disabled={!rows.length}>
              <Download className="size-3.5" /> Export
            </Button>
            <Button variant="primary" onClick={mailto} disabled={!rows.length}>
              <Send className="size-3.5" /> Email store
            </Button>
          </>
        }
      >
        {!f.code ? (
          <EmptyState
            title="Select a store"
            sub="Pick a store code above to view its actioned items."
            icon={<Mail className="size-5" />}
          />
        ) : rows.length ? (
          <TableWrap maxHeight="60vh">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._idx}>
                  <td className="font-mono font-semibold">{r.Article || "—"}</td>
                  <td className="font-mono">{r.Barcode || "—"}</td>
                  <td className="max-w-[20rem] truncate">{r.Description || "—"}</td>
                  <td className="font-mono">{r.ExpiryDate || "—"}</td>
                  {rtc && (
                    <>
                      <td className="font-mono">
                        {r["RTC Price"] ? `AED ${r["RTC Price"]}` : "—"}
                      </td>
                      <td className="font-mono">{r.Start || "—"}</td>
                      <td className="font-mono">{r.End || "—"}</td>
                    </>
                  )}
                  {transfer && (
                    <>
                      <td>{r["Transfer To"] || "—"}</td>
                      <td className="font-mono">{r["Transfer Qty"] || "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No actioned items" sub="Nothing matches the current filters." />
        )}
      </Panel>
    </AppShell>
  );
}
