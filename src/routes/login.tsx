import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/expiry/app-context";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Sign in to the Gala Markets expiry dashboard to review near-expiry stock, buyer actions and store submissions.",
      },
      { property: "og:title", content: "Sign in — Gala Markets Expiry Dashboard" },
      {
        property: "og:description",
        content: "Secure access for Gala Markets store teams, buyers and administrators.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, token, authReady } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authReady && token) void navigate({ to: "/" });
  }, [authReady, token, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    try {
      const ok = await login(username, password, remember);
      if (ok) void navigate({ to: "/" });
    } catch {
      /* toast handled in context */
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Brand side */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-sidebar-accent">
            <img
              src="https://i.ibb.co/rfGVJp3F/Gala-EXP-2-removebg-preview-2.png"
              alt="Gala Markets logo"
              className="size-8 object-contain"
            />
          </div>
          <div>
            <p className="font-display text-base font-semibold">Gala Markets</p>
            <p className="text-[11px] text-sidebar-muted">Expiry Intelligence Platform</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Stop shrinkage before it starts.
          </h2>
          <p className="mt-3 text-sm text-sidebar-muted">
            Live visibility of near-expiry stock across every store, with buyer actions,
            RTC pricing and transfers tracked end to end.
          </p>
          <ul className="mt-8 flex flex-col gap-3 text-sm">
            {[
              { icon: TrendingUp, t: "Risk buckets from expired to 90+ days" },
              { icon: Sparkles, t: "Action Center with bulk RTC & transfers" },
              { icon: ShieldCheck, t: "Role-aware access for buyers & managers" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-xl bg-sidebar-accent">
                  <Icon className="size-4" />
                </span>
                <span className="text-sidebar-muted">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[11px] text-sidebar-muted">
          © {new Date().getFullYear()} Gala Markets · Internal use only
        </p>
      </section>

      {/* Form side */}
      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary-soft">
              <img
                src="https://i.ibb.co/rfGVJp3F/Gala-EXP-2-removebg-preview-2.png"
                alt="Gala Markets logo"
                className="size-8 object-contain"
              />
            </div>
            <div>
              <p className="font-display text-base font-semibold text-foreground">
                Gala Markets
              </p>
              <p className="text-[11px] text-muted-foreground">Expiry Dashboard</p>
            </div>
          </div>

          <h1 className="font-display text-2xl font-semibold text-foreground">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in with your Gala Markets credentials.
          </p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Username
              </span>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your.name"
                className="h-11 rounded-xl border border-input bg-surface px-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Password
              </span>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-input bg-surface px-3 pr-10 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="accent-primary"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me signed in on this device
            </label>

            <button
              type="submit"
              disabled={busy || !username || !password}
              className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LockKeyhole className="size-4" />
              )}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Trouble signing in? Contact your system administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
