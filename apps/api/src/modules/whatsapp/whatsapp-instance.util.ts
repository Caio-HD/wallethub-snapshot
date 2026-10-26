export function evolutionInstanceNameForOrganization(organizationId: string): string {
  return `wh-${organizationId.replace(/-/g, '')}`;
}

export function legacyEvolutionInstanceName(): string | undefined {
  const name = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  return name || undefined;
}
