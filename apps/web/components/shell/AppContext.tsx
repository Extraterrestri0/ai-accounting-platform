'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Role = 'owner' | 'accountant' | 'approver' | 'viewer';
export interface Company { id: string; name: string; eik: string; }
interface AppState { role: Role; setRole: (r: Role) => void; company: Company; setCompany: (c: Company) => void; companies: Company[]; }

const COMPANIES: Company[] = [
  { id: 'co-1', name: 'Акме ООД', eik: '111111113' },
  { id: 'co-2', name: 'Бета ЕООД', eik: '202400016' },
];
const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('accountant');
  const [company, setCompany] = useState<Company>(COMPANIES[0]);
  const value = useMemo(() => ({ role, setRole, company, setCompany, companies: COMPANIES }), [role, company]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used within AppProvider');
  return v;
}
