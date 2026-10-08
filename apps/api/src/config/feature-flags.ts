import { Injectable } from '@nestjs/common';

/**
 * Runtime feature flags (env-driven, deploy-time). Optional — default OFF — so the
 * platform keeps its existing behavior unless a flag is explicitly enabled.
 */
@Injectable()
export class FeatureFlags {
  /**
   * SAF-T v2 async XML pipeline. OFF = v1 synchronous dataset behavior is preserved.
   * ON = POST /saft/exports enqueues a background job and returns 202.
   */
  saftXmlEnabled(): boolean {
    return process.env.SAFT_XML_ENABLED === 'true';
  }
}
