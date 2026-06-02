'use client';
/** Reviewer Dashboard — queue health + my workload. */
import { useQuery } from '@tanstack/react-query';
interface Dash { pending: number; needsCorrection: number; approved: number; rejected: number; assignedToMe: number; }
export function ReviewerDashboardScreen() {
  const { data } = useQuery({ queryKey: ['review-dashboard'], queryFn: () => fetch('/api/reviews/dashboard').then((r) => r.json() as Promise<Dash>) });
  if (!data) return <p>Loading…</p>;
  const cards: [string, number][] = [['Pending', data.pending], ['Needs correction', data.needsCorrection], ['Assigned to me', data.assignedToMe], ['Approved', data.approved], ['Rejected', data.rejected]];
  return (
    <section>
      <h1>Табло на проверяващия · Reviewer dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
        {cards.map(([label, n]) => (<div key={label}><div>{label}</div><div style={{ fontSize: 24 }}>{n}</div></div>))}
      </div>
    </section>
  );
}
