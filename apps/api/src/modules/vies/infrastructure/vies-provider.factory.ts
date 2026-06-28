import { Logger } from '@nestjs/common';
import type { ViesProvider } from '../application/vies.provider';
import { DefaultViesProvider } from './default-vies-provider';
import { HttpViesProvider } from './http-vies-provider';

/**
 * Select the VIES provider from configuration. With no VIES_API_URL set, returns the
 * deterministic format-based DefaultViesProvider so validation always completes.
 *   VIES_API_URL=<eu-proxy>  → HttpViesProvider (live)
 *   (unset)                  → DefaultViesProvider (format fallback)  [default]
 */
export function createViesProvider(env: NodeJS.ProcessEnv = process.env): ViesProvider {
  const log = new Logger('VIES.Factory');
  if (env.VIES_API_URL) { log.log('VIES provider: live EU endpoint.'); return new HttpViesProvider(); }
  log.log('VIES provider: deterministic format fallback (no VIES_API_URL).');
  return new DefaultViesProvider();
}
