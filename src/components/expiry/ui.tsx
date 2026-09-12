import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortState } from "@/lib/expiry/utils";
import { bucketTone, sortData } from "@/lib/expiry/utils";

/* ───────────── Panel ───────────── */
export function Panel({
  title,
  sub,
  badge,
  actions,
  children,
  className,
  icon,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-card overflow-hidden",
        className,
      )}
    >
      {(title || actions || badge) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
              {icon}
              {title}
            </h3>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {badge != null && (
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary">
                {badge}
              </span>
            )}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

/* ───────────── KPI ───────────── */
const TONES: Record<string, string> = {
  brand: "border-primary/25 bg-primary-soft/60 text-primary",
  crit: "border-crit/25 bg-crit-soft text-crit",
  high: "border-high/25 bg-high-soft text-high",
  med: "border-med/30 bg-med-soft text-med",
  low: "border-low/25 bg-low-soft text-low",
  info: "border-info/25 bg-info-soft text-info",
  na: "border-border bg-surface-2 text-muted-foreground",
};

export function Kpi({
  label,
  value,
  sub,
  tone = "brand",
  icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: keyof typeof TONES | string;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-1 rounded-2xl border bg-card p-4 text-left shadow-card transition",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lift",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "grid size-7 place-items-center rounded-lg border",
              TONES[tone] || TONES['brand'],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <span className="font-display text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </Comp>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

/* ───────────── Badges ───────────── */
export function RiskBadge({ bucket }: { bucket: string }) {
  if (!bucket) return <span className="text-muted-foreground">—</span>;
  const t = bucketTone(bucket);
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        TONES[t] || TONES['na'],
      )}
    >
      {bucket}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Action Taken" ? "low" : status === "Previously Actioned" ? "info" : "high";
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        TONES[tone],
      )}
    >
      {status}
    </span>
  );
}

/* ───────────── Filter bar bits ───────────── */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-[9rem] flex-col gap-1", className)}>
      <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

const controlCls =
  "h-9 rounded-lg border border-input bg-surface px-2.5 text-xs text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20";

export function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <select
      className={cn(controlCls, className)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className,
  type = "text",
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  type?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      type={type}
      className={cn(controlCls, className)}
      value={value}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        className={cn(controlCls, "w-full pl-8")}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function StoreDisplay({ name }: { name: string }) {
  return (
    <div className="flex h-9 min-w-[10rem] items-center rounded-lg border border-dashed border-border bg-surface-2 px-2.5 text-xs font-semibold text-foreground">
      {name || "—"}
    </div>
  );
}

export function MultiSelect({
  options,
  value,
  onChange,
  allLabel,
  className,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  allLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const label = value.length === 0 ? allLabel : value.length === 1 ? value[0] : `${value.length} selected`;

  return (
    <div ref={ref} className={cn("relative min-w-[10rem]", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(controlCls, "flex w-full items-center justify-between gap-2 text-left")}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="scroll-slim absolute z-50 mt-1 max-h-64 w-full min-w-[13rem] overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lift">
          <button
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-primary hover:bg-muted"
            onClick={() => onChange([])}
          >
            {allLabel}
          </button>
          {options.map((o) => (
            <label
              key={o}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted"
            >
              <input
                type="checkbox"
                className="accent-primary"
                checked={value.includes(o)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...value, o] : value.filter((x) => x !== o),
                  )
                }
              />
              <span className="truncate">{o}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  className,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "accent" | "danger" | "ghost" | "export";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const v: Record<string, string> = {
    default: "border-border bg-surface text-foreground hover:bg-muted",
    primary: "border-transparent bg-primary text-primary-foreground hover:opacity-90",
    accent: "border-transparent mint-gradient text-accent-foreground hover:opacity-90",
    danger: "border-crit/30 bg-crit-soft text-crit hover:bg-crit/15",
    ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-muted",
    export: "border-low/30 bg-low-soft text-low hover:bg-low/15",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        v[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tick({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-foreground">
      <input
        type="checkbox"
        className="accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function Chips({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((c) => (
        <span
          key={c}
          className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

/* ───────────── Tables ───────────── */
export function TableWrap({
  children,
  maxHeight = "60vh",
}: {
  children: ReactNode;
  maxHeight?: string;
}) {
  return (
    <div className="scroll-slim overflow-auto" style={{ maxHeight }}>
      <table className="data-table">{children}</table>
    </div>
  );
}

export function useSort(initial: SortState = { key: null, dir: 1, type: "str" }) {
  const [sort, setSort] = useState<SortState>(initial);
  const toggle = (key: string, type = "str") =>
    setSort((s) =>
      s.key === key ? { key, type, dir: s.dir === 1 ? -1 : 1 } : { key, type, dir: 1 },
    );
  return { sort, toggle };
}

export function Th({
  label,
  sortKey,
  type = "str",
  sort,
  toggle,
  className,
}: {
  label: ReactNode;
  sortKey?: string;
  type?: string;
  sort?: SortState;
  toggle?: (k: string, t?: string) => void;
  className?: string;
}) {
  if (!sortKey || !toggle) return <th className={className}>{label}</th>;
  const active = sort?.key === sortKey;
  return (
    <th className={cn("cursor-pointer select-none", className)} onClick={() => toggle(sortKey, type)}>
      <span className="inline-flex items-center gap-1">
        {label}
        <ChevronsUpDown
          className={cn("size-3", active ? "text-primary" : "text-muted-foreground/50")}
        />
      </span>
    </th>
  );
}

export function useSorted<T extends Record<string, unknown>>(rows: T[], sort: SortState) {
  return useMemo(() => sortData(rows, sort), [rows, sort]);
}

export function EmptyState({
  title,
  sub,
  icon,
}: {
  title: string;
  sub?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-2xl bg-surface-2 text-muted-foreground">
        {icon || <X className="size-5" />}
      </div>
      <p className="font-display text-sm font-semibold text-foreground">{title}</p>
      {sub && <p className="max-w-sm text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ───────────── Bar chart ───────────── */
export function BarChart({
  data,
  tone = "brand",
}: {
  data: { label: string; value: number; hint?: string }[];
  tone?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length)
    return <p className="py-8 text-center text-xs text-muted-foreground">No data</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <div key={d.label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {d.label}
          </span>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                tone === "crit" ? "bg-crit" : "brand-gradient",
              )}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="text-right text-[11px] font-semibold tabular-nums text-foreground">
            {d.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Modal ───────────── */
export function Modal({
  open,
  onClose,
  title,
  sub,
  icon,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-auto bg-foreground/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "my-8 w-full rounded-2xl border border-border bg-card shadow-lift",
          width,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          {icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="scroll-slim max-h-[70vh] overflow-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
