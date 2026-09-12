import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { CF_API, apiFetch, setUnauthorizedHandler } from "./api";
import type { AppUser, EmailMapEntry, ProcRow, RawRow, StoreRef } from "./types";
import { applyPreviouslyActioned, processRows } from "./utils";

type Status = "loading" | "ok" | "err";

interface AppState {
  token: string | null;
  user: AppUser | null;
  authReady: boolean;
  login: (u: string, p: string, remember: boolean) => Promise<boolean>;
  logout: () => void;
  rawE: RawRow[];
  rawL: RawRow[];
  proc: ProcRow[];
  setProc: React.Dispatch<React.SetStateAction<ProcRow[]>>;
  stores: StoreRef[];
  codeToStore: Record<string, string>;
  emailMap: EmailMapEntry[];
  loading: boolean;
  status: { e: [Status, string]; l: [Status, string]; s: [Status, string] };
  lastRefresh: string;
  loadAll: () => Promise<void>;
  density: number;
  setDensity: (n: number) => void;
  selected: Set<number>;
  setSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
  isAdmin: boolean;
  isAreaManager: boolean;
  userStores: string[];
  userDepartments: string[];
}

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [rawE, setRawE] = useState<RawRow[]>([]);
  const [rawL, setRawL] = useState<RawRow[]>([]);
  const [proc, setProc] = useState<ProcRow[]>([]);
  const [stores, setStores] = useState<StoreRef[]>([]);
  const [codeToStore, setCodeToStore] = useState<Record<string, string>>({});
  const [emailMap, setEmailMap] = useState<EmailMapEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState("—");
  const [density, setDensity] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<AppState["status"]>({
    e: ["loading", "Waiting for data…"],
    l: ["loading", "Waiting for actions…"],
    s: ["loading", "Waiting for stores…"],
  });

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setProc([]);
    setRawE([]);
    setRawL([]);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("current_user");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    const t =
      localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
    const uRaw =
      localStorage.getItem("current_user") ||
      sessionStorage.getItem("current_user");
    if (t) setToken(t);
    if (uRaw && uRaw !== "null") {
      try {
        setUser(JSON.parse(uRaw));
      } catch {
        /* ignore */
      }
    }
    setAuthReady(true);
  }, [logout]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setStatus({
      e: ["loading", "Fetching expiry data…"],
      l: ["loading", "Fetching buyer actions…"],
      s: ["loading", "Fetching stores…"],
    });
    const [er, sr, emr] = await Promise.allSettled([
      apiFetch(CF_API + "?action=allData&_t=" + Date.now()).then((r) => r.json()),
      apiFetch(CF_API + "?action=stores&_t=" + Date.now()).then((r) => r.json()),
      apiFetch(CF_API + "?action=getEmailMap&_t=" + Date.now()).then((r) =>
        r.json(),
      ),
    ]);

    const nextStatus: AppState["status"] = {
      e: ["err", "Data failed"],
      l: ["err", "—"],
      s: ["err", "Stores failed"],
    };
    const map: Record<string, string> = {};
    let storeList: StoreRef[] = [];
    if (sr.status === "fulfilled") {
      (Array.isArray(sr.value) ? sr.value : []).forEach(
        (s: { storeCode?: string; storeName?: string }) => {
          const code = String(s.storeCode || "").trim();
          const name = String(s.storeName || "").trim();
          if (code) {
            map[code] = name;
            storeList.push({ code, name });
          }
        },
      );
      nextStatus.s = ["ok", `${storeList.length} stores`];
    }
    if (emr.status === "fulfilled")
      setEmailMap(Array.isArray(emr.value) ? emr.value : []);

    if (er.status === "fulfilled" && er.value?.rows) {
      const rows: RawRow[] = er.value.rows;
      const actioned = rows.filter((r) => r['ActionTaken']);
      const processed = applyPreviouslyActioned(processRows(rows));
      processed.forEach((r) => {
        if (r.StoreCode && r.Store && !map[r.StoreCode]) map[r.StoreCode] = r.Store;
      });
      storeList = storeList.length
        ? storeList
        : Object.entries(map).map(([code, name]) => ({ code, name }));
      setRawE(rows);
      setRawL(actioned);
      setProc(processed);
      nextStatus.e = ["ok", `${rows.length} rows`];
      nextStatus.l = ["ok", `${actioned.length} actioned`];
    } else {
      setRawE([]);
      setRawL([]);
      setProc([]);
    }
    setCodeToStore(map);
    setStores(storeList);
    setStatus(nextStatus);
    setLastRefresh(new Date().toLocaleTimeString());
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) void loadAll();
  }, [token, loadAll]);

  const login = useCallback(
    async (username: string, password: string, remember: boolean) => {
      const res = await fetch(CF_API + "?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const out = await res.json();
      if (out.success) {
        const store = remember ? localStorage : sessionStorage;
        store.setItem("auth_token", out.token);
        store.setItem("current_user", JSON.stringify(out.user));
        setToken(out.token);
        setUser(out.user);
        toast.success(`Welcome back, ${out.user?.username || "user"}!`);
        return true;
      }
      toast.error(out.message || "Login failed");
      return false;
    },
    [],
  );

  const isAdmin = !!user?.isAdmin;
  const isAreaManager =
    !!user &&
    !user.isAdmin &&
    !!user.stores &&
    user.stores.trim() !== "" &&
    user.stores !== "ALL";
  const userStores = useMemo(
    () =>
      !user?.stores || user.stores === "ALL"
        ? []
        : user.stores.split(",").map((s) => s.trim()).filter(Boolean),
    [user],
  );
  const userDepartments = useMemo(
    () =>
      !user || user.isAdmin || !user.departments || user.departments === "ALL"
        ? []
        : user.departments.split(",").map((d) => d.trim()).filter(Boolean),
    [user],
  );

  const value: AppState = {
    token,
    user,
    authReady,
    login,
    logout,
    rawE,
    rawL,
    proc,
    setProc,
    stores,
    codeToStore,
    emailMap,
    loading,
    status,
    lastRefresh,
    loadAll,
    density,
    setDensity,
    selected,
    setSelected,
    isAdmin,
    isAreaManager,
    userStores,
    userDepartments,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
