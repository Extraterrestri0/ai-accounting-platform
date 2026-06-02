'use client';
import { useApp, type Role } from './AppContext';

const ROLES: Role[] = ['owner', 'accountant', 'approver', 'viewer'];
export function TopBar() {
  const { company, setCompany, companies, role, setRole } = useApp();
  return (
    <header className="h-14 border-b border-line bg-white flex items-center gap-4 px-5 sticky top-0 z-10">
      <label className="text-sm text-muted">Фирма
        <select className="ml-2 border border-line rounded-md px-2 py-1 text-sm text-ink"
          value={company.id} onChange={(e) => setCompany(companies.find((c) => c.id === e.target.value)!)}>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name} · ЕИК {c.eik}</option>)}
        </select>
      </label>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-muted">EUR · 1 € = 1.95583 лв.</span>
        <label className="text-sm text-muted">Роля
          <select className="ml-2 border border-line rounded-md px-2 py-1 text-sm text-ink capitalize"
            value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <div className="w-8 h-8 rounded-full bg-brand text-white grid place-items-center text-sm">МП</div>
      </div>
    </header>
  );
}
