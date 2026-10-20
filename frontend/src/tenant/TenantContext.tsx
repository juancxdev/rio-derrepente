import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { listSites } from '../api/ticketing';
import { useAuth } from '../auth/AuthProvider';
import type { Role, Site, Tenant, User } from '../types';

type TenantContextValue = {
  user: User | null;
  tenant: Tenant | null;
  sites: Site[];
  activeSite: Site | null;
  activeSiteID: string | null;
  role: Role | null;
  closureHour: number;
  canManage: boolean;
  canSell: boolean;
  selectSite: (siteID: string) => void;
  addSite: (site: Site) => void;
  refreshSites: () => Promise<void>;
  logout: () => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSiteID, setActiveSiteID] = useState<string | null>(null);

  useEffect(() => {
    const list = session?.sites ?? [];
    setSites(list);
    // Keep the selection only while it still belongs to this tenant.
    setActiveSiteID((current) => (current && list.some((site) => site.id === current) ? current : list[0]?.id ?? null));
  }, [session]);

  const selectSite = useCallback((siteID: string) => {
    setSites((current) => {
      if (current.some((site) => site.id === siteID)) setActiveSiteID(siteID);
      return current;
    });
  }, []);

  const addSite = useCallback((site: Site) => {
    setSites((current) => (current.some((item) => item.id === site.id) ? current : [...current, site]));
    setActiveSiteID(site.id);
  }, []);

  const refreshSites = useCallback(async () => {
    if (!session) return;
    const list = await listSites(session.tenant.id);
    setSites(list);
    setActiveSiteID((current) => (current && list.some((site) => site.id === current) ? current : list[0]?.id ?? null));
  }, [session]);

  const activeSite = sites.find((site) => site.id === activeSiteID) ?? null;
  const role = session?.tenant.role ?? null;

  const value = useMemo<TenantContextValue>(() => ({
    user: session?.user ?? null,
    tenant: session?.tenant ?? null,
    sites,
    activeSite,
    activeSiteID,
    role,
    closureHour: session?.closure_hour ?? 18,
    canManage: role === 'manager' || role === 'admin',
    canSell: role !== null,
    selectSite,
    addSite,
    refreshSites,
    logout: signOut,
  }), [session, sites, activeSite, activeSiteID, role, selectSite, addSite, refreshSites, signOut]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const value = useContext(TenantContext);
  if (!value) throw new Error('useTenant must be used inside TenantProvider');
  return value;
}
