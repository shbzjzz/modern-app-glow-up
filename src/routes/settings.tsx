import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eraser, Eye, Plus, RotateCcw, Save, Sliders, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/expiry/app-shell";
import { Labeled } from "@/components/expiry/row-popup";
import { Button, EmptyState, Panel, PanelBody, TextInput } from "@/components/expiry/ui";
import { useApp } from "@/lib/expiry/app-context";
import {
  applyBuyerTemplate,
  articleCatalog,
  DEFAULT_BUYER_SETTINGS,
  findArticleInfo,
  getBuyerSettings,
  saveBuyerSettings,
  type BuyerSettings,
  type DisabledArticle,
} from "@/lib/expiry/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Buyer Settings — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Customize the Notify Store email template and manage disabled articles for this session.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { proc, isBuyer, disabledArticles, setDisabledArticles, emailMap } = useApp();
  const [settings, setSettings] = useState<BuyerSettings>(getBuyerSettings());
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState("");

  useEffect(() => {
    setSettings(getBuyerSettings());
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const disabledSet = new Set(disabledArticles.map((x) => x.article.toLowerCase()));
    return articleCatalog(proc)
      .filter(
        (x) =>
          !disabledSet.has(x.article.toLowerCase()) &&
          (x.article.toLowerCase().includes(q) ||
            x.barcode.toLowerCase().includes(q) ||
            x.description.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [query, proc, disabledArticles]);

  const addDisabled = (info: DisabledArticle | null) => {
    if (!info) {
      toast.error("Article not found in current data");
      return;
    }
    if (disabledArticles.some((x) => x.article.toLowerCase() === info.article.toLowerCase())) {
      toast("Article already disabled");
      return;
    }
    setDisabledArticles([...disabledArticles, info]);
    setQuery("");
  };

  const handlePaste = () => {
    const vals = paste
      .split(/\r?\n/)
      .flatMap((x) => x.split(/\t/)[0]!.split(/[;,]/))
      .map((x) => x.trim())
      .filter((x) => x && !/^article$/i.test(x));
    let added = 0;
    let next = [...disabledArticles];
    vals.forEach((v) => {
      const info = findArticleInfo(proc, v);
      if (info && !next.some((x) => x.article.toLowerCase() === info.article.toLowerCase())) {
        next = [...next, info];
        added++;
      }
    });
    if (added) {
      setDisabledArticles(next);
      toast.success(`${added} article(s) added from paste`);
    }
    setPaste("");
  };

  const removeDisabled = (i: number) => {
    const next = [...disabledArticles];
    next.splice(i, 1);
    setDisabledArticles(next);
  };

  const save = () => {
    saveBuyerSettings(settings);
    setStatus("Saved for this session");
    setTimeout(() => setStatus(""), 2200);
  };

  const resetDefaults = () => {
    saveBuyerSettings(DEFAULT_BUYER_SETTINGS);
    setSettings(DEFAULT_BUYER_SETTINGS);
    setStatus("Defaults restored");
    setTimeout(() => setStatus(""), 2200);
  };

  const runPreview = () => {
    saveBuyerSettings(settings);
    const ctx = {
      store: "Sample Store",
      code: "STORE001",
      week: "Week 2",
      month: "Sep-2026",
      count: 3,
      date: new Date().toLocaleDateString(),
      body: "[Action table is copied separately]",
    };
    const subject = applyBuyerTemplate(settings.subject, ctx);
    const body = applyBuyerTemplate(settings.body, ctx);
    const toEmail = emailMap[0]?.toEmail || "store email from Email Map";
    setPreview(`To: ${toEmail}\nCC: ${settings.cc || "None"}\nSubject: ${subject}\n\n${body}`);
  };

  if (!isBuyer) {
    return (
      <AppShell title="Buyer Settings" subtitle="Buyer workspace">
        <Panel>
          <EmptyState
            title="Buyers only"
            sub="Settings are only available to buyer accounts."
            icon={<Sliders className="size-5" />}
          />
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Buyer Settings"
      subtitle="Customize the Notify Store email used during this session"
    >
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel
          title="Disabled articles"
          sub="Hidden from Action Center and buyer-facing expiry views across all stores"
          icon={<X className="size-4 text-primary" />}
        >
          <PanelBody className="flex flex-col gap-4">
            <div>
              <Labeled label="Search / select article">
                <div className="flex gap-2">
                  <TextInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Article, barcode or description…"
                  />
                  <Button
                    variant="primary"
                    onClick={() => addDisabled(findArticleInfo(proc, query))}
                  >
                    <Plus className="size-3.5" /> Add
                  </Button>
                </div>
              </Labeled>
              {results.length > 0 && (
                <div className="scroll-slim mt-2 flex max-h-48 flex-col gap-1.5 overflow-auto">
                  {results.map((r) => (
                    <div
                      key={r.article + r.barcode}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {r.article || r.barcode}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {r.description || "—"}
                        </p>
                      </div>
                      <Button variant="primary" onClick={() => addDisabled(r)}>
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Labeled label="Paste from Excel">
              <textarea
                className="min-h-[6.5rem] w-full rounded-lg border border-input bg-surface px-2.5 py-2 font-mono text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="Paste one or multiple Article numbers from Excel here…"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
            </Labeled>
            <p className="-mt-2 text-[11px] text-muted-foreground">
              Paste a single column or multiple Excel rows. Barcode values are also accepted.
            </p>
            <div className="flex gap-2">
              <Button onClick={handlePaste} disabled={!paste.trim()}>
                Add pasted articles
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setPaste("");
                }}
              >
                <Eraser className="size-3.5" /> Clear input
              </Button>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">
                Disabled article list · {disabledArticles.length} article
                {disabledArticles.length === 1 ? "" : "s"}
              </p>
              {disabledArticles.length ? (
                <div className="scroll-slim flex max-h-64 flex-col gap-1.5 overflow-auto">
                  {disabledArticles.map((x, i) => (
                    <div
                      key={x.article + i}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {x.article || "—"}
                          {x.barcode ? ` · ${x.barcode}` : ""}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {x.description || "Description not found"}
                        </p>
                      </div>
                      <Button variant="danger" onClick={() => removeDisabled(i)}>
                        <X className="size-3.5" /> Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No disabled articles</p>
              )}
            </div>
          </PanelBody>
        </Panel>

        <Panel
          title="Mail settings"
          sub="Customize the Notify Store email"
          icon={<Sliders className="size-4 text-primary" />}
        >
          <PanelBody className="flex flex-col gap-3">
            <Labeled label="CC emails">
              <TextInput
                value={settings.cc}
                onChange={(v) => setSettings((s) => ({ ...s, cc: v }))}
                placeholder="cc1@example.com, cc2@example.com"
              />
            </Labeled>
            <Labeled label="Mail subject">
              <TextInput
                value={settings.subject}
                onChange={(v) => setSettings((s) => ({ ...s, subject: v }))}
              />
            </Labeled>
            <Labeled label="Body structure">
              <textarea
                className="min-h-[8rem] w-full rounded-lg border border-input bg-surface px-2.5 py-2 font-mono text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                value={settings.body}
                onChange={(e) => setSettings((s) => ({ ...s, body: e.target.value }))}
              />
            </Labeled>
            <p className="text-[11px] text-muted-foreground">
              Placeholders: {"{STORE} {STORE_CODE} {WEEK} {MONTH} {ITEM_COUNT} {DATE} {BODY}"}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["confirm", "Ask for confirmation before opening email"],
                  ["rememberActions", "Remember Notify Store action filters"],
                  ["rtc", "Include RTC Price Change by default"],
                  ["transfer", "Include Store Transfer by default"],
                  ["monitor", "Include Monitor by default"],
                  ["clear", "Include Clear In Normal Price by default"],
                ] as [keyof BuyerSettings, string][]
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-2 text-[11px] text-foreground"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-primary"
                    checked={Boolean(settings[key])}
                    onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="primary" onClick={save}>
                <Save className="size-3.5" /> Save settings
              </Button>
              <Button onClick={runPreview}>
                <Eye className="size-3.5" /> Preview
              </Button>
              <Button variant="danger" onClick={resetDefaults}>
                <RotateCcw className="size-3.5" /> Reset defaults
              </Button>
              {status && <span className="text-[11px] font-semibold text-low">{status}</span>}
            </div>

            {preview && (
              <div className="mt-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap">
                {preview}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>
    </AppShell>
  );
}
