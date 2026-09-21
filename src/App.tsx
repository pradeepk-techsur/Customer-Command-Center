import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortalSnapshot, Role } from "../shared/types.ts";
import { api, setTokens, getAccessToken } from "./api.ts";
import { SortContext, type SortState } from "./hooks/useSort.ts";
import { Masthead, type Page } from "./components/Masthead.tsx";
import { CallOrderDetail, type Tab } from "./components/CallOrderDetail.tsx";
import { ContractDetailPage } from "./components/ContractDetailPage.tsx";
import { StaffDetailPage } from "./components/StaffDetailPage.tsx";
import { ActionItemsPage } from "./components/ActionItemsPage.tsx";
import { ContractDeliverablesPage } from "./components/ContractDeliverablesPage.tsx";
import { LoginPage } from "./components/LoginPage.tsx";
import { RegisterPage } from "./components/RegisterPage.tsx";
import { AdminPage } from "./components/admin/AdminPage.tsx";
import { ChangePasswordModal } from "./components/ChangePasswordModal.tsx";
import { ToastContainer, ConfirmDialog } from "./components/ui.tsx";

/** Runs a mutation against the API and replaces the snapshot with the server's response. */
export type Mutate = (fn: () => Promise<PortalSnapshot>) => Promise<PortalSnapshot | undefined>;

type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: Role;
  mustResetPassword?: boolean;
  canLockReports?: boolean;
};

export default function App() {
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [page, setPage] = useState<Page>("orders");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("General");
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [sorts, setSorts] = useState<Record<string, SortState>>({});

  // Check authentication on mount and handle OAuth callback
  useEffect(() => {
    const checkAuth = async () => {
      // Check if we're handling an OAuth callback
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get("accessToken");
      const refreshTokenParam = params.get("refreshToken");
      const error = params.get("error");

      // Handle OAuth errors
      if (error) {
        setError(decodeURIComponent(error));
        window.history.replaceState({}, "", "/");
        setAuthLoading(false);
        return;
      }

      // Handle magic-link callback (customer/CoR passwordless sign-in, spec §19)
      if (window.location.pathname === "/auth/magic-link") {
        const magicToken = params.get("token");
        window.history.replaceState({}, "", "/");
        if (!magicToken) {
          setError("Missing sign-in token.");
          setAuthLoading(false);
          return;
        }
        try {
          const res = await fetch("/api/auth/magic-link/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: magicToken }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.message || data.error || "Sign-in link is invalid or expired.");
            setAuthLoading(false);
            return;
          }
          setTokens(data.accessToken, data.refreshToken);
          const userData = await api.getMe();
          if (userData) setUser(userData);
        } catch (e) {
          setError("Failed to complete sign-in.");
        } finally {
          setAuthLoading(false);
        }
        return;
      }

      // Handle OAuth callback with tokens
      if (accessToken && refreshTokenParam) {
        setTokens(accessToken, refreshTokenParam);
        window.history.replaceState({}, "", "/");
        
        try {
          const userData = await api.getMe();
          if (userData) {
            setUser(userData);
            if (userData.mustResetPassword) {
              setShowPasswordChange(true);
            }
          }
        } catch (e) {
          setError("Failed to load user data");
        } finally {
          setAuthLoading(false);
        }
        return;
      }

      // Check if user is already logged in
      if (!getAccessToken()) {
        setAuthLoading(false);
        return;
      }

      try {
        const userData = await api.getMe();
        if (userData) {
          setUser(userData);
          if (userData.mustResetPassword) {
            setShowPasswordChange(true);
          }
        }
      } catch (e) {
        console.error("Auth check failed:", e);
      } finally {
        setAuthLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Load snapshot when authenticated
  useEffect(() => {
    if (user) {
      api.snapshot().then(setSnapshot).catch((e: Error) => setError(e.message));
    }
  }, [user]);

  const handleLogin = async (accessToken: string, refreshToken: string) => {
    setTokens(accessToken, refreshToken);
    try {
      const userData = await api.getMe();
      if (userData) {
        setUser(userData);
      }
    } catch (e) {
      setError("Failed to load user data");
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setSnapshot(null);
  };

  const handlePasswordChangeSuccess = async () => {
    setShowPasswordChange(false);
    // Reload user data to clear mustResetPassword flag
    try {
      const userData = await api.getMe();
      if (userData) {
        setUser(userData);
      }
    } catch (e) {
      console.error("Failed to reload user data:", e);
    }
  };

  const mutate: Mutate = useCallback(async (fn) => {
    try {
      const next = await fn();
      setSnapshot(next);
      setError(null);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    }
  }, []);

  const sortStore = useMemo(() => ({
    get: (key: string, def: string) => sorts[key] || { col: def, dir: "asc" as const },
    toggle: (key: string, def: string, col: string) => setSorts((s) => {
      const cur = s[key] || { col: def, dir: "asc" as const };
      const active = cur.col === col;
      return { ...s, [key]: { col, dir: active && cur.dir === "asc" ? "desc" : "asc" } };
    }),
  }), [sorts]);

  // Show login/register pages if not authenticated
  if (authLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return showRegister ? (
      <RegisterPage 
        onRegister={handleLogin} 
        onShowLogin={() => setShowRegister(false)} 
      />
    ) : (
      <LoginPage 
        onLogin={handleLogin} 
        onShowRegister={() => setShowRegister(true)} 
      />
    );
  }

  // canEdit: pm and program_manager can edit their assigned call orders
  const canEdit = user.role === "pm" || user.role === "program_manager" || user.role === "admin";
  const order = snapshot && selected ? snapshot.callOrders.find((c) => c.id === selected) : undefined;
  const selectedStaff = snapshot && selectedStaffId ? snapshot.callOrders.flatMap((c) => c.staff).find((s) => s.id === selectedStaffId) : undefined;
  const fallbackContract = { id: 0, name: "BPA", agency: "AOUSC", vehicle: "BPA for TSO Support Services", number: "47QTCA20D00C6", popStart: null, popEnd: null, funded: 0, spend: 0, eac: null, peopleAssigned: 0, clins: [], invoices: [], contractDocuments: [], deliverables: [], risks: [], issues: [] };

  return (
    <>
      <ToastContainer />
      <ConfirmDialog />
      <SortContext.Provider value={sortStore}>
        <Masthead 
        page={page} 
        role={user.role} 
        userName={user.name}
        contract={snapshot?.contract || fallbackContract}
        onPage={(p) => { setPage(p); if (p === "orders") { setSelected(null); setSelectedStaffId(null); } }} 
        onLogout={handleLogout}
      />
      {error && (
        <div className="notice"><div><span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button></div></div>
      )}
      {page === "admin" ? (
        <AdminPage role={user?.role || "customer"} />
      ) : !snapshot ? (
        <div className="loading">{error ? "The portal data could not be loaded." : "Loading portal data…"}</div>
      ) : page === "actionitems" ? (
        <ActionItemsPage snapshot={snapshot} isPm={canEdit} mutate={mutate} />
      ) : page === "deliverables" ? (
        <ContractDeliverablesPage snapshot={snapshot} isPm={canEdit} mutate={mutate} />
      ) : selectedStaff ? (
        <StaffDetailPage staff={selectedStaff} isPm={canEdit} mutate={mutate} onBack={() => setSelectedStaffId(null)} />
      ) : order ? (
        <CallOrderDetail snapshot={snapshot} order={order} tab={tab} isPm={canEdit} userName={user.name} mutate={mutate}
          onBack={() => setSelected(null)} onTab={setTab} onSelectPeriod={setSelected} onSelectStaff={setSelectedStaffId} />
      ) : (
        <ContractDetailPage snapshot={snapshot}
          onSelectCallOrder={(id) => { setSelected(id); setTab("General"); }} />
      )}
      </SortContext.Provider>
      {showPasswordChange && user && (
        <ChangePasswordModal
          email={user.email}
          onSuccess={handlePasswordChangeSuccess}
          isForced={user.mustResetPassword}
        />
      )}
    </>
  );
}
