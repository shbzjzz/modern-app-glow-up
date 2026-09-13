import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Check, Info, Pencil, Trash2, Zap } from "lucide-react";
import { CF_API, apiFetch } from "@/lib/expiry/api";
import { useApp } from "@/lib/expiry/app-context";
import type { ProcRow } from "@/lib/expiry/types";
import { ACTIONS, calcBucket, formatDateToStr, parseDate, today } from "@/lib/expiry/utils";
import { Button, Modal, RiskBadge, StatusBadge, TextInput } from "./ui";

function Pf({ k, v }: { k: string; v?: string | number | null }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/60 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{k}</p>
      <p className="mt-0.5 break-words text-xs font-semibold text-foreground">
        {v === "" || v === null || v === undefined ? "—" : v}
      </p>
    </div>
  );
}

type EditMode = "rtc" | "transfer" | "record" | null;

/** Detail popup for a single row — with inline edit + delete. */
export function RowPopup({ row, onClose }: { row: ProcRow | null; onClose: () => void }) {
  const { isAdmin, loadAll, setProc } = useApp();
  const [mode, setMode] = useState<EditMode>(null);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});

  if (!row) return null;

  const openEdit = (m: Exclude<EditMode, null>) => {
    setF(
      m === "rtc"
        ? { rtcPrice: row["RTC Price"], start: row.Start, end: row.End }
        : m === "transfer"
          ? { transferTo: row["Transfer To"], transferQty: row["Transfer Qty"] }
          : { stock: row.Stock, expiry: "" },
    );
    setMode(m);
  };

  const save = async () => {
    setBusy(true);
    try {
      if (mode === "record") {
        const out = await apiFetch(
          `${CF_API}?action=editRow&rowIndex=${row._idx}&stock=${encodeURIComponent(
            f.stock || "",
          )}&expiry=${encodeURIComponent(f.expiry || "")}`,
        ).then((r) => r.json());
        if (!out.success) throw new Error(out.message || "Update failed");
        setProc((prev) =>
          prev.map((p) => {
            if (p._idx !== row._idx) return p;
            const d = parseDate(f.expiry);
            const days = d ? Math.round((d.getTime() - today().getTime()) / 86400000) : p.DaysLeft;
            return {
              ...p,
              Stock: f.stock,
              ExpiryDate: d ? formatDateToStr(d) : p.ExpiryDate,
              DaysLeft: days,
              "Expiry Risk Bucket": calcBucket(days as number),
            };
          }),
        );
      } else {
        const body: Record<string, unknown> = { rowIndex: row._idx };
        if (mode === "rtc") {
          body.rtcPrice = (f.rtcPrice || "").trim();
          body.start = (f.start || "").trim();
          body.end = (f.end || "").trim();
        } else {
          body.transferTo = (f.transferTo || "").trim();
          body.transferQty = (f.transferQty || "").trim();
        }
        const out = await apiFetch(`${CF_API}?action=editBuyerAction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((r) => r.json());
        if (!out.success) throw new Error(out.message || "Update failed");
        setProc((prev) =>
          prev.map((p) =>
            p._idx === row._idx
              ? mode === "rtc"
                ? {
                    ...p,
                    "RTC Price": String(body.rtcPrice),
                    Start: String(body.start),
                    End: String(body.end),
                  }
                : {
                    ...p,
                    "Transfer To": String(body.transferTo),
                    "Transfer Qty": String(body.transferQty),
                  }
              : p,
          ),
        );
      }
      toast.success("Updated successfully");
      setMode(null);
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    setBusy(true);
    try {
      const out = await apiFetch(`${CF_API}?action=deleteRow&rowIndex=${row._idx}`).then((r) =>
        r.json(),
      );
      if (!out.success) throw new Error(out.message || "Failed to delete");
      toast.success("Item deleted");
      setDel(false);
      onClose();
      void loadAll();
    } catch (e) {
      toast.error((e as Error).message || "Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={!!row && !mode && !del}
        onClose={onClose}
        title={row.Article || "Item details"}
        sub={`${row.Description || ""}${row.Barcode ? " · " + row.Barcode : ""}`}
        icon={<Info className="size-4" />}
        width="max-w-3xl"
        footer={
          isAdmin ? (
            <Button variant="danger" onClick={() => setDel(true)}>
              <Trash2 className="size-3.5" /> Delete item
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-3">
          <RiskBadge bucket={row["Expiry Risk Bucket"]} />
          <StatusBadge status={row["Action Status"]} />
          <span className="text-[11px] text-muted-foreground">
            {row.Week} · {row["Sub Month Display"]}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Pf k="Store" v={`${row.StoreCode} · ${row.Store}`} />
          <Pf k="Department" v={row.Department} />
          <Pf k="Stock" v={row.Stock} />
          <Pf k="Expiry date" v={row.ExpiryDate} />
          <Pf k="Days left" v={row.DaysLeft === "" ? "—" : row.DaysLeft} />
          <Pf k="Submitted by" v={row.StaffName} />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h4 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Action details
          </h4>
          <Button variant="ghost" onClick={() => openEdit("record")}>
            <Pencil className="size-3.5" /> Edit stock / expiry
          </Button>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Pf k="Action taken" v={row["Action Taken"]} />
          <Pf k="Action date" v={String(row["Action Date"] || "").slice(0, 10)} />
          <Pf k="Previous action" v={row["Previous Action Info"]} />
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">RTC details</p>
              <Button variant="ghost" onClick={() => openEdit("rtc")}>
                <Pencil className="size-3.5" />
              </Button>
            </div>
            <div className="mt-2 grid gap-2">
              <Pf k="RTC price" v={row["RTC Price"] ? `AED ${row["RTC Price"]}` : ""} />
              <Pf k="Start" v={row.Start} />
              <Pf k="End" v={row.End} />
            </div>
          </div>
          <div className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Transfer details</p>
              <Button variant="ghost" onClick={() => openEdit("transfer")}>
                <Pencil className="size-3.5" />
              </Button>
            </div>
            <div className="mt-2 grid gap-2">
              <Pf k="Transfer to" v={row["Transfer To"]} />
              <Pf k="Transfer qty" v={row["Transfer Qty"]} />
              <Pf k="Previous price info" v={row["Previous Price Info"]} />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!mode}
        onClose={() => setMode(null)}
        title={
          mode === "rtc"
            ? "Edit RTC details"
            : mode === "transfer"
              ? "Edit transfer details"
              : "Edit stock & expiry"
        }
        sub={`${row.Article || "—"} · ${row.StoreCode}`}
        icon={<Pencil className="size-4" />}
        footer={
          <>
            <Button onClick={() => setMode(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy}>
              <Check className="size-3.5" /> Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {mode === "rtc" && (
            <>
              <Labeled label="RTC price (AED)">
                <TextInput
                  type="number"
                  value={f.rtcPrice || ""}
                  onChange={(v) => setF((s) => ({ ...s, rtcPrice: v }))}
                />
              </Labeled>
              <Labeled label="Start date">
                <TextInput
                  type="date"
                  value={f.start || ""}
                  onChange={(v) => setF((s) => ({ ...s, start: v }))}
                />
              </Labeled>
              <Labeled label="End date">
                <TextInput
                  type="date"
                  value={f.end || ""}
                  onChange={(v) => setF((s) => ({ ...s, end: v }))}
                />
              </Labeled>
            </>
          )}
          {mode === "transfer" && (
            <>
              <Labeled label="Transfer to">
                <TextInput
                  value={f.transferTo || ""}
                  onChange={(v) => setF((s) => ({ ...s, transferTo: v }))}
                />
              </Labeled>
              <Labeled label="Transfer qty">
                <TextInput
                  type="number"
                  value={f.transferQty || ""}
                  onChange={(v) => setF((s) => ({ ...s, transferQty: v }))}
                />
              </Labeled>
            </>
          )}
          {mode === "record" && (
            <>
              <Labeled label="Stock">
                <TextInput
                  type="number"
                  value={f.stock || ""}
                  onChange={(v) => setF((s) => ({ ...s, stock: v }))}
                />
              </Labeled>
              <Labeled label="Expiry date">
                <TextInput
                  type="date"
                  value={f.expiry || ""}
                  onChange={(v) => setF((s) => ({ ...s, expiry: v }))}
                />
              </Labeled>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={del}
        onClose={() => setDel(false)}
        title="Delete this item?"
        sub="This permanently removes the row from the expiry tracker."
        icon={<Trash2 className="size-4" />}
        footer={
          <>
            <Button onClick={() => setDel(false)}>Cancel</Button>
            <Button variant="danger" onClick={runDelete} disabled={busy}>
              <Trash2 className="size-3.5" /> Confirm delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {row.Article} · {row.Description} · {row.StoreCode}
        </p>
      </Modal>
    </>
  );
}

export function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Bulk action confirmation used by the Action Center. */
export function ConfirmActionModal({
  action,
  items,
  presetTransferTo,
  onClose,
  onDone,
}: {
  action: (typeof ACTIONS)[number] | null;
  items: ProcRow[];
  presetTransferTo?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { setProc } = useApp();
  const [busy, setBusy] = useState(false);
  const [rtcPrice, setRtc] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [transferTo, setTo] = useState(presetTransferTo || "");
  const [transferQty, setQty] = useState("");

  const run = async () => {
    setBusy(true);
    const actionDate = new Date().toISOString();
    const updates = items.map((r) => {
      const existing = r["Action Taken"] || "";
      const combinedAction = existing
        ? existing.includes(action!)
          ? existing
          : `${existing} + ${action}`
        : action!;
      const exRtc = r["RTC Price"] || "";
      const combinedRTC =
        rtcPrice && !exRtc.includes(rtcPrice)
          ? exRtc
            ? `${exRtc}, ${rtcPrice}`
            : rtcPrice
          : exRtc;
      const exTo = r["Transfer To"] || "";
      const combinedTo =
        transferTo && !exTo.includes(transferTo)
          ? exTo
            ? `${exTo}, ${transferTo}`
            : transferTo
          : exTo;
      return { r, combinedAction, combinedRTC, combinedTo };
    });
    const res = await Promise.allSettled(
      updates.map((u) =>
        apiFetch(`${CF_API}?action=saveBuyerAction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rowIndex: u.r._idx,
            actionTaken: u.combinedAction,
            rtcPrice: u.combinedRTC,
            transferTo: u.combinedTo,
            actionDate,
            transferQty,
            start,
            end,
          }),
        }).then((r) => r.json()),
      ),
    );
    const ok = res.filter((r) => r.status === "fulfilled" && r.value?.success !== false).length;
    const map = new Map(updates.map((u) => [u.r._idx, u]));
    setProc((prev) =>
      prev.map((p) => {
        const u = map.get(p._idx);
        if (!u) return p;
        return {
          ...p,
          "Action Taken": u.combinedAction,
          "Action Status": "Action Taken",
          "RTC Price": u.combinedRTC,
          "Transfer To": u.combinedTo,
          "Transfer Qty": transferQty || p["Transfer Qty"],
          Start: start || p.Start,
          End: end || p.End,
          "Action Date": actionDate,
        };
      }),
    );
    setBusy(false);
    if (ok) toast.success(`${ok} item${ok > 1 ? "s" : ""} saved`);
    else toast.error("Saving failed");
    onDone();
  };

  return (
    <Modal
      open={!!action}
      onClose={onClose}
      title={action || ""}
      sub={`Applying to ${items.length} item${items.length > 1 ? "s" : ""}.`}
      icon={<Zap className="size-4" />}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={run} disabled={busy}>
            <Check className="size-3.5" /> Confirm & save
          </Button>
        </>
      }
    >
      <div className="scroll-slim mb-3 max-h-40 overflow-auto rounded-xl border border-border bg-surface-2/60 p-2">
        {items.map((r) => (
          <p key={r._idx} className="truncate py-0.5 text-[11px] text-muted-foreground">
            {r.Article || "—"} · {r.Description} · {r.StoreCode} · {r.Week}
          </p>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {action === "RTC Price Change" && (
          <>
            <Labeled label="RTC price (AED)">
              <TextInput type="number" value={rtcPrice} onChange={setRtc} />
            </Labeled>
            <div />
            <Labeled label="Start date">
              <TextInput type="date" value={start} onChange={setStart} />
            </Labeled>
            <Labeled label="End date">
              <TextInput type="date" value={end} onChange={setEnd} />
            </Labeled>
          </>
        )}
        {action === "Store Transfer" && (
          <>
            <Labeled label="Transfer to">
              <TextInput
                value={transferTo}
                onChange={(v) => setTo(v.replace(/[\t\n\r]+/g, ", "))}
              />
            </Labeled>
            <Labeled label="Transfer qty">
              <TextInput type="number" value={transferQty} onChange={setQty} />
            </Labeled>
          </>
        )}
        {(action === "Monitor" || action === "Clear In Normal Price") && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarClock className="size-4" /> No extra details needed — this marks the selected
            items as actioned today.
          </p>
        )}
      </div>
    </Modal>
  );
}
