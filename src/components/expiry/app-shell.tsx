import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  Boxes,
  ClipboardCheck,
  Database,
  Gauge,
  ListChecks,
  LogOut,
  MapPin,
  Maximize2,
  Minimize2,
  Menu,
  RefreshCw,
  Send,
  Settings,
  Sliders,
  Store,
  Zap,
} from "lucide-react";
import { useApp } from "@/lib/expiry/app-context";
import { cn } from "@/lib/utils";
import { isOverdueRow } from "@/lib/expiry/utils";
import { useState } from "react";

const NAV = [
  { to: "/", label: "Overview", icon: Gauge, group: "Analytics" },
  {
    to: "/attention",
    label: "Needs My Attention",
    icon: ListChecks,
    group: "Analytics",
    buyerOnly: true,
    badge: true,
  },
  { to: "/area-view", label: "Area View", icon: MapPin, group: "Analytics", areaOnly: true },
  { to: "/actions", label: "Action Center", icon: Zap, group: "Analytics", hideAreaManager: true },
  { to: "/notify", label: "Notify Store", icon: Send, group: "Analytics", hideAreaManager: true },
  { to: "/stores", label: "Store Summary", icon: Store, group: "Analytics" },
  { to: "/articles", label: "Article View", icon: Boxes, group: "Reports" },
  { to: "/buyer-action", label: "Buyer's Action", icon: Zap, group: "Reports", buyerOrArea: true },
  { to: "/submission", label: "Submission Status", icon: ClipboardCheck, group: "Reports" },
  {
    to: "/inspector",
    label: "Data Inspector",
    icon: Database,
    group: "Reports",
    hideAreaManager: true,
  },
  { to: "/settings", label: "Buyer Settings", icon: Sliders, group: "System", buyerOnly: true },
  { to: "/admin", label: "Admin Panel", icon: Settings, group: "System", admin: true },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const {
    authReady,
    token,
    user,
    logout,
    loadAll,
    loading,
    status,
    lastRefresh,
    density,
    setDensity,
    buyerVisibleProc,
    isAdmin,
    isAreaManager,
    isBuyer,
  } = useApp();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (authReady && !token) void navigate({ to: "/login" });
  }, [authReady, token, navigate]);

  useEffect(() => {
    const pads = ["0.3rem 0.6rem", "0.5rem 0.75rem", "0.7rem 0.95rem"];
    const fonts = ["0.6875rem", "0.75rem", "0.8125rem"];
    document.documentElement.style.setProperty("--row-pad", pads[density]!);
    document.documentElement.style.setProperty("--row-font", fonts[density]!);
  }, [density]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!authReady || !token) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <RefreshCw className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  const attentionCount = buyerVisibleProc.filter(
    (r) =>
      ["Pending Action", "Validity Expired"].includes(r["Action Status"]) &&
      parseFloat(r.Stock) > 0 &&
      Number.isFinite(Number(r.DaysLeft)) &&
      Number(r.DaysLeft) >= 0,
  ).length;
  const overdue = buyerVisibleProc.filter(isOverdueRow).length;
  const visible = NAV.filter((n) => {
    if ("admin" in n && n.admin && !isAdmin) return false;
    if ("buyerOnly" in n && n.buyerOnly && !isBuyer) return false;
    if ("areaOnly" in n && n.areaOnly && !isAreaManager) return false;
    if ("buyerOrArea" in n && n.buyerOrArea && !isBuyer && !isAreaManager) return false;
    if ("hideAreaManager" in n && n.hideAreaManager && isAreaManager) return false;
    return true;
  });
  const groups = [...new Set(visible.map((n) => n.group))];

  const dots: Record<string, string> = {
    loading: "bg-med animate-pulse",
    ok: "bg-low",
    err: "bg-crit",
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-sidebar-accent">
            <img
              src="https://i.ibb.co/rfGVJp3F/Gala-EXP-2-removebg-preview-2.png"
              alt="Gala Markets logo"
              className="size-7 object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold">Gala Markets</p>
            <p className="text-[11px] text-sidebar-muted">Expiry Dashboard</p>
          </div>
        </div>

        <nav className="scroll-slim flex-1 overflow-y-auto p-3">
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-muted">
                {g}
              </p>
              {visible
                .filter((n) => n.group === g)
                .map((n) => {
                  const active = pathname === n.to;
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={cn(
                        "relative mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition",
                        active
                          ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                          : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{n.label}</span>
                      {"badge" in n && n.badge && attentionCount > 0 && (
                        <span className="ml-auto rounded-full bg-crit px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {attentionCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
          <button
            onClick={() => {
              logout();
              void navigate({ to: "/login" });
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-sidebar-muted transition hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" /> Logout
          </button>
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-muted">
          <div className="flex items-center justify-between">
            <span>Last refresh</span>
            <strong className="text-sidebar-foreground">{lastRefresh}</strong>
          </div>
          {overdue > 0 && <p className="mt-1 text-[10px] text-med">{overdue} overdue items</p>}
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
          <button
            className="rounded-lg border border-border p-2 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 md:flex">
            <Minimize2 className="size-3.5 text-muted-foreground" />
            <input
              type="range"
              min={0}
              max={2}
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="w-20 accent-primary"
              aria-label="Table density"
            />
            <Maximize2 className="size-3.5 text-muted-foreground" />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
            <span className="grid size-6 place-items-center rounded-full brand-gradient text-[10px] font-bold text-primary-foreground">
              {(user?.username || "?").slice(0, 2).toUpperCase()}
            </span>
            <span className="text-xs font-semibold text-foreground">{user?.username}</span>
          </div>
          <button
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </header>

        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {(["e", "l", "s"] as const).map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
            >
              <span className={cn("size-1.5 rounded-full", dots[status[k][0]])} />
              {status[k][1]}
            </span>
          ))}
        </div>

        <main className="flex flex-col gap-4 p-4">{children}</main>
      </div>
    </div>
  );
}
