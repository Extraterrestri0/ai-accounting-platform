import type { XsdValidationResult } from '../domain/saft-xsd';

/**
 * Pluggable SAF-T XSD validation harness. The default implementation binds libxml2,
 * but it is INERT until an official schema is configured (then validate() returns
 * ok=true/false; until then ok=null). No NRA schema specifics are hardcoded — the
 * schema path/version come from configuration.
 */
export interface SaftXsdValidator {
  /** True when an XSD schema is configured (otherwise validate() is inert → ok=null). */
  isConfigured(): boolean;
  /** Validate an XML document string against the configured schema (if any). */
  validate(xml: string): Promise<XsdValidationResult>;
}
export const SAFT_XSD_VALIDATOR = Symbol('Saft.XsdValidator');
