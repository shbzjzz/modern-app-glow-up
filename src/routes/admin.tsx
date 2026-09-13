import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  AlertTriangle,
  Loader2,
  Mail,
  Plus,
  Settings,
  ShoppingBag,
  Store as StoreIcon,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/expiry/app-shell";
import {
  Button,
  EmptyState,
  Modal,
  MultiSelect,
  Panel,
  PanelBody,
  TableWrap,
  TextInput,
} from "@/components/expiry/ui";
import { Labeled } from "@/components/expiry/row-popup";
import { useApp } from "@/lib/expiry/app-context";
import { CF_API, apiFetch } from "@/lib/expiry/api";
import { readSheetFile } from "@/lib/expiry/export";
import { DEPARTMENTS } from "@/lib/expiry/utils";
import type { AppUser } from "@/lib/expiry/types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Gala Markets Expiry Dashboard" },
      {
        name: "description",
        content:
          "Manage dashboard users, roles and store access, and upload the weekly expiry data file.",
      },
      { property: "og:title", content: "Admin Panel — Gala Markets" },
      {
        property: "og:description",
        content: "User management and weekly expiry data uploads.",
      },
    ],
  }),
  component: AdminPage,
});

type Role = "buyer" | "area";

function AdminPage() {
  const { user, isAdmin, stores, loadAll } = useApp();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [add, setAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadState, setUploadState] = useState<{ tone: string; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const articlesFileRef = useRef<HTMLInputElement>(null);
  const storesFileRef = useRef<HTMLInputElement>(null);
  const emailMapFileRef = useRef<HTMLInputElement>(null);
  const [masterStatus, setMasterStatus] = useState<
    Record<string, { tone: string; msg: string } | null>
  >({});
  const [delAction, setDelAction] = useState<"clearOldExpData" | "clearAllExpData" | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  // new user form
  const [nUser, setNUser] = useState("");
  const [nPass, setNPass] = useState("");
  const [nAdmin, setNAdmin] = useState(false);
  const [role, setRole] = useState<Role>("buyer");
  const [nDepts, setNDepts] = useState<string[]>([]);
  const [nStores, setNStores] = useState<string[]>([]);
  const [delUser, setDelUser] = useState<AppUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const list = await apiFetch(`${CF_API}?action=getUsers`).then((r) => r.json());
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      toast.error("Failed to fetch users");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void fetchUsers();
  }, [isAdmin, fetchUsers]);

  const createUser = async () => {
    if (!nUser || !nPass) {
      toast.error("Username and password are required");
      return;
    }
    setBusy(true);
    try {
      const payload = nAdmin
        ? { username: nUser, password: nPass, departments: "ALL", stores: "", isAdmin: true }
        : {
            username: nUser,
            password: nPass,
            departments: role === "buyer" ? nDepts.join(",") : "ALL",
            stores: role === "area" ? nStores.join(",") : "",
            isAdmin: false,
          };
      const out = await apiFetch(`${CF_API}?action=createUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
      if (out.success) {
        toast.success("User created");
        setAdd(false);
        setNUser("");
        setNPass("");
        setNAdmin(false);
        setNDepts([]);
        setNStores([]);
        void fetchUsers();
      } else toast.error(out.message || "Failed to create user");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async () => {
    if (!delUser) return;
    setBusy(true);
    try {
      const out = await apiFetch(`${CF_API}?action=deleteUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: delUser.id }),
      }).then((r) => r.json());
      if (out.success) {
        toast.success("User deleted");
        setDelUser(null);
        void fetchUsers();
      } else toast.error(out.message || "Failed to delete user");
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setUploadState({ tone: "text-muted-foreground", msg: "Processing file…" });
    try {
      const rows = await readSheetFile(file, { raw: false, cellDates: true });
      if (!rows.length) throw new Error("No data found in file");
      const out = await apiFetch(`${CF_API}?action=uploadExpiryData`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      }).then((r) => r.json());
      if (!out.success) throw new Error(out.message || "Upload failed");
      setUploadState({ tone: "text-low", msg: `Success — ${out.inserted} rows uploaded.` });
      toast.success(`${out.inserted} rows uploaded`);
      if (fileRef.current) fileRef.current.value = "";
      void loadAll();
    } catch (err) {
      setUploadState({ tone: "text-crit", msg: `Error: ${(err as Error).message}` });
    }
  };

  const MASTER_ACTIONS: Record<string, string> = {
    Articles: "uploadArticles",
    Stores: "uploadStores",
    EmailMap: "uploadEmailMap",
  };

  const uploadMaster = async (type: "Articles" | "Stores" | "EmailMap", file: File) => {
    setMasterStatus((s) => ({
      ...s,
      [type]: { tone: "text-muted-foreground", msg: "Reading file…" },
    }));
    try {
      const rows = await readSheetFile(file);
      setMasterStatus((s) => ({
        ...s,
        [type]: { tone: "text-muted-foreground", msg: `Uploading ${rows.length} rows…` },
      }));
      const out = await apiFetch(`${CF_API}?action=${MASTER_ACTIONS[type]}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      }).then((r) => r.json());
      if (out.success) {
        setMasterStatus((s) => ({
          ...s,
          [type]: { tone: "text-low", msg: `${type} uploaded — ${out.rows || rows.length} rows` },
        }));
        toast.success(`${type} uploaded`);
        if (type === "Stores") void loadAll();
      } else {
        setMasterStatus((s) => ({
          ...s,
          [type]: { tone: "text-crit", msg: out.message || "Upload failed" },
        }));
      }
    } catch (err) {
      setMasterStatus((s) => ({
        ...s,
        [type]: { tone: "text-crit", msg: (err as Error).message },
      }));
    }
  };

  const runDangerAction = async () => {
    if (!delAction) return;
    setDelBusy(true);
    try {
      const res = await apiFetch(`${CF_API}/?action=${delAction}`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Done");
        setDelAction(null);
        void loadAll();
      } else {
        toast.error(data.message || "Unauthorized");
      }
    } catch {
      toast.error("Network error occurred");
    } finally {
      setDelBusy(false);
    }
  };

  const roleOf = (u: AppUser) =>
    u.isAdmin
      ? { label: "Admin", detail: "Full access", cls: "border-low/25 bg-low-soft text-low" }
      : u.stores && u.stores.trim() !== "" && u.stores !== "ALL"
        ? {
            label: "Area Manager",
            detail: `Stores: ${u.stores}`,
            cls: "border-info/25 bg-info-soft text-info",
          }
        : {
            label: "Buyer",
            detail: `Departments: ${u.departments || "ALL"}`,
            cls: "border-primary/25 bg-primary-soft text-primary",
          };

  if (!isAdmin) {
    return (
      <AppShell title="Admin Panel" subtitle="Restricted area">
        <Panel>
          <EmptyState
            title="Admins only"
            sub="Your account does not have administrator access."
            icon={<Settings className="size-5" />}
          />
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin Panel" subtitle="Users, access and weekly data uploads">
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Users"
          sub={`${users.length} accounts`}
          icon={<Users className="size-4 text-primary" />}
          actions={
            <Button variant="primary" onClick={() => setAdd(true)}>
              <Plus className="size-3.5" /> Add user
            </Button>
          }
        >
          {loadingUsers ? (
            <div className="grid place-items-center py-14">
              <Loader2 className="size-5 animate-spin text-primary" />
            </div>
          ) : users.length ? (
            <TableWrap maxHeight="55vh">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Access</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const r = roleOf(u);
                  return (
                    <tr key={u.id ?? u.username}>
                      <td className="font-semibold">{u.username}</td>
                      <td>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${r.cls}`}
                        >
                          {r.label}
                        </span>
                      </td>
                      <td className="max-w-[18rem] truncate text-muted-foreground">{r.detail}</td>
                      <td>
                        {u.username !== user?.username && (
                          <Button variant="danger" onClick={() => setDelUser(u)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="No users" sub="Create the first account." />
          )}
        </Panel>

        <Panel
          title="Upload expiry data"
          sub="Excel or CSV export from the stock system"
          icon={<Upload className="size-4 text-primary" />}
        >
          <PanelBody className="flex flex-col gap-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface-2/50 px-4 py-10 text-center transition hover:border-primary/40 hover:bg-primary-soft/30">
              <Upload className="size-6 text-primary" />
              <span className="font-display text-sm font-semibold text-foreground">
                Choose a file
              </span>
              <span className="text-xs text-muted-foreground">
                .xlsx or .csv — the first sheet is imported
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
            {uploadState && (
              <p className={`text-xs font-semibold ${uploadState.tone}`}>{uploadState.msg}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Existing rows for the same store, article and week are replaced. The dashboard
              refreshes automatically after a successful upload.
            </p>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <MasterUploadCard
          title="Upload articles"
          sub="Columns required: Barcode, Article, Description, Department"
          icon={<ShoppingBag className="size-4 text-primary" />}
          fileRef={articlesFileRef}
          status={masterStatus["Articles"]}
          onFile={(file) => void uploadMaster("Articles", file)}
        />
        <MasterUploadCard
          title="Upload stores"
          sub="Columns required: StoreCode, StoreName, Password"
          icon={<StoreIcon className="size-4 text-primary" />}
          fileRef={storesFileRef}
          status={masterStatus["Stores"]}
          onFile={(file) => void uploadMaster("Stores", file)}
        />
        <MasterUploadCard
          title="Upload email map"
          sub="Columns required: StoreCode, ToEmail, CcEmail"
          icon={<Mail className="size-4 text-primary" />}
          fileRef={emailMapFileRef}
          status={masterStatus["EmailMap"]}
          onFile={(file) => void uploadMaster("EmailMap", file)}
        />
      </div>

      <Panel
        title="Data management"
        sub="Danger zone — permanent deletion of ExpiryTracker records"
        icon={<AlertTriangle className="size-4 text-crit" />}
        className="border-crit/25"
      >
        <PanelBody className="flex flex-wrap gap-2">
          <Button
            className="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-300"
            onClick={() => setDelAction("clearOldExpData")}
          >
            <Trash2 className="size-3.5" /> Clear data — before 4 months
          </Button>
          <Button variant="danger" onClick={() => setDelAction("clearAllExpData")}>
            <Trash2 className="size-3.5" /> Clear data — all expiry data
          </Button>
        </PanelBody>
      </Panel>

      <Modal
        open={!!delAction}
        onClose={() => setDelAction(null)}
        title={
          delAction === "clearOldExpData"
            ? "Delete data older than 4 months"
            : "DELETE ALL EXPIRY DATA"
        }
        sub="This action cannot be undone"
        icon={<AlertTriangle className="size-4" />}
        footer={
          <>
            <Button onClick={() => setDelAction(null)}>Cancel</Button>
            <Button variant="danger" onClick={runDangerAction} disabled={delBusy}>
              {delBusy ? "Processing…" : "Confirm delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {delAction === "clearOldExpData"
            ? "This will permanently delete all entries in the ExpiryTracker older than 4 months."
            : "This will permanently delete ALL entries in the ExpiryTracker table."}
        </p>
      </Modal>

      <Modal
        open={add}
        onClose={() => setAdd(false)}
        title="Add user"
        sub="Set credentials and access scope"
        icon={<Plus className="size-4" />}
        footer={
          <>
            <Button onClick={() => setAdd(false)}>Cancel</Button>
            <Button variant="primary" onClick={createUser} disabled={busy}>
              {busy ? "Creating…" : "Create user"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Labeled label="Username">
            <TextInput value={nUser} onChange={setNUser} placeholder="new.user" />
          </Labeled>
          <Labeled label="Password">
            <TextInput type="password" value={nPass} onChange={setNPass} placeholder="••••••••" />
          </Labeled>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
            <input
              type="checkbox"
              className="accent-primary"
              checked={nAdmin}
              onChange={(e) => setNAdmin(e.target.checked)}
            />
            Administrator (full access)
          </label>

          {!nAdmin && (
            <>
              <div className="flex gap-2">
                {(["buyer", "area"] as Role[]).map((r) => (
                  <Button
                    key={r}
                    variant={role === r ? "primary" : "default"}
                    onClick={() => setRole(r)}
                  >
                    {r === "buyer" ? "Buyer" : "Area Manager"}
                  </Button>
                ))}
              </div>
              {role === "buyer" ? (
                <Labeled label="Departments">
                  <MultiSelect
                    options={DEPARTMENTS}
                    value={nDepts}
                    onChange={setNDepts}
                    allLabel="All departments"
                  />
                </Labeled>
              ) : (
                <Labeled label="Stores">
                  <MultiSelect
                    options={stores.map((s) => s.code)}
                    value={nStores}
                    onChange={setNStores}
                    allLabel="All stores"
                  />
                </Labeled>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={!!delUser}
        onClose={() => setDelUser(null)}
        title="Delete user"
        sub="This cannot be undone"
        icon={<Trash2 className="size-4" />}
        footer={
          <>
            <Button onClick={() => setDelUser(null)}>Cancel</Button>
            <Button variant="danger" onClick={removeUser} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Remove <strong className="text-foreground">{delUser?.username}</strong> from the
          dashboard?
        </p>
      </Modal>
    </AppShell>
  );
}

function MasterUploadCard({
  title,
  sub,
  icon,
  fileRef,
  status,
  onFile,
}: {
  title: string;
  sub: string;
  icon: ReactNode;
  fileRef: RefObject<HTMLInputElement | null>;
  status: { tone: string; msg: string } | null | undefined;
  onFile: (file: File) => void;
}) {
  return (
    <Panel title={title} sub={sub} icon={icon}>
      <PanelBody className="flex flex-col gap-2.5">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface-2/50 px-3 py-5 text-center text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-primary-soft/30">
          <Upload className="size-4 text-primary" /> Choose file
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
        </label>
        {status && <p className={`text-[11px] font-semibold ${status.tone}`}>{status.msg}</p>}
      </PanelBody>
    </Panel>
  );
}
