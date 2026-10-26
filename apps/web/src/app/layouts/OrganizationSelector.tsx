import { Building2 } from 'lucide-react';
import { Select } from '@shared/ui/select';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';

export const OrganizationSelector = () => {
  const {
    organizations,
    activeOrganizationId,
    setActiveOrganizationId,
    isLoadingOrganizations,
    isPlatformOperator,
  } = useActiveOrganization();

  if (isLoadingOrganizations || organizations.length === 0) {
    return null;
  }

  const value = activeOrganizationId ?? organizations[0]?.id ?? '';

  return (
    <div className="flex flex-col gap-1">
      {isPlatformOperator ? (
        <span className="text-[10px] font-medium uppercase tracking-wide text-sky-300/90">
          Modo auditoria
        </span>
      ) : null}
      <Select
        className="min-w-[10rem] max-w-[14rem] sm:max-w-[18rem]"
        label="Organização"
        icon={<Building2 className="h-3.5 w-3.5" />}
        options={organizations.map((o) => ({ id: o.id, name: o.name }))}
        value={value}
        onChange={setActiveOrganizationId}
        placeholder="Organização"
      />
    </div>
  );
};
