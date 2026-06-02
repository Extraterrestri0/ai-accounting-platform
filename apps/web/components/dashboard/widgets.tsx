'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-white p-5 ${className}`}>{children}</div>;
}
export function Metric({ label, value, sub, tone = 'ink', href }: { label: string; value: string; sub?: string; tone?: 'ink' | 'ok' | 'warn' | 'info' | 'danger'; href?: string }) {
  const color = { ink: 'text-ink', ok: 'text-ok', warn: 'text-warn', info: 'text-info', danger: 'text-danger' }[tone];
  const inner = (
    <Card className="hover:shadow-sm transition">
      <div className="text-sm text-muted">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
export function ActivityList({ items }: { items: { when: string; text: string }[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((a, i) => (
        <li key={i} className="py-2.5 flex items-start gap-3 text-sm">
          <span className="text-xs text-muted w-24 shrink-0">{a.when}</span>
          <span className="text-ink">{a.text}</span>
        </li>
      ))}
    </ul>
  );
}
