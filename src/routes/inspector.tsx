import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Database, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/expiry/app-shell";
import {
  Button,
  EmptyState,
  Field,
  FilterBar,
  Panel,
  SearchInput,
  Select,
  TableWrap,
} from "@/components/expiry/ui";
import { useApp } from "@/lib/expiry/app-context";
import { downloadSheet } from "@/lib/expiry/export";
import type { RawRow } from "@/lib/expiry/types";

export const Route = createFileRoute("/inspector")({
  head: () => ({
    meta: [
      { title: "Data Inspector — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Inspect the raw expiry and buyer action records behind the dashboard, then export them for audit.",
      },
      { property: "og:title", content: "Data Inspector — Gala Markets" },
      {
        property: "og:description",
        content: "Raw expiry and action records with search and export.",
      },
    ],
  }),
  component: InspectorPage,
});

type Mode = "expiry" | "actions";

function InspectorPage() {
  const { rawE, rawL } = useApp();
  const [mode, setMode] = useState<Mode>("expiry");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState("200");

  const source: RawRow[] = mode === "expiry" ? rawE : rawL;

  const cols = useMemo(() => {
    const set = new Set<string>();
    source.slice(0, 50).forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    return [...set];
  }, [source]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? source.filter((r) =>
          Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(needle)),
        )
      : source;
    return filtered.slice(0, Number(limit) || 200);
  }, [source, q, limit]);

  return (
    <AppShell title="Data Inspector" subtitle="Raw records exactly as stored">
      <FilterBar>
        <Field label="Dataset">
          <Select value={mode} onChange={(v) => setMode(v as Mode)}>
            <option value="expiry">Expiry data ({rawE.length})</option>
            <option value="actions">Buyer actions ({rawL.length})</option>
          </Select>
        </Field>
        <Field label="Rows shown">
          <Select value={limit} onChange={setLimit}>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
            <option value="2000">2000</option>
          </Select>
        </Field>
        <Field label="Search" className="min-w-[16rem] flex-1">
          <SearchInput value={q} onChange={setQ} placeholder="Search any column" />
        </Field>
        <Button
          variant="export"
          onClick={() => {
            const ok = downloadSheet(
              source as Record<string, unknown>[],
              cols,
              mode === "expiry" ? "Raw_Expiry" : "Raw_Actions",
              "Raw",
            );
            if (!ok) toast.error("Nothing to export");
          }}
        >
          <Download className="size-3.5" /> Export all
        </Button>
      </FilterBar>

      <Panel
        title={mode === "expiry" ? "Expiry records" : "Buyer action records"}
        sub={`${rows.length} of ${source.length} rows`}
        icon={<Database className="size-4 text-primary" />}
        badge={`${cols.length} columns`}
      >
        {rows.length ? (
          <TableWrap maxHeight="65vh">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c} className="max-w-[16rem] truncate font-mono">
                      {String(r[c] ?? "") || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="No records"
            sub="Refresh the data or clear the search term."
            icon={<Database className="size-5" />}
          />
        )}
      </Panel>
    </AppShell>
  );
}
