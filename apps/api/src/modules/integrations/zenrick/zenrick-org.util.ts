import { ForbiddenException } from '@nestjs/common';

/**
 * The connector's org allowlist (ADR adr-zenrick-connector §4). Single source of
 * truth for both ingestion and the read-only reports surface — a request may only
 * touch an organization explicitly listed in WALLETHUB_CONNECTOR_ALLOWED_ORGS.
 */
export function allowedConnectorOrgs(): Set<string> {
  return new Set(
    (process.env.WALLETHUB_CONNECTOR_ALLOWED_ORGS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Normalize + assert the org is allowlisted; throws 403 otherwise. Returns the normalized id. */
export function assertConnectorOrgAllowed(organizationId: string | undefined): string {
  const normalized = (organizationId ?? '').trim().toLowerCase();
  if (!normalized || !allowedConnectorOrgs().has(normalized)) {
    throw new ForbiddenException('Organização fora da allowlist do connector.');
  }
  return normalized;
}
