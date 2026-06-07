import { redirect } from 'next/navigation';

/**
 * App root. The authenticated workspace lives under the (app) route group; the
 * root simply forwards to the dashboard, whose layout guard redirects to /login
 * when there is no session. (Restores `/` after the legacy index page was removed
 * during the design-system rebuild.)
 */
export default function RootPage() {
  redirect('/dashboard');
}
