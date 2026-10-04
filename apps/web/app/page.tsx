import { redirect } from 'next/navigation';

/** `/` is served by the static marketing site (next.config rewrite); this is a safety fallback. */
export default function Home() {
  redirect('/dashboard');
}
