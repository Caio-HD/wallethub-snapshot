import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ListChecks,
  Wallet,
  X,
  Tag,
  Sparkles,
  PiggyBank,
  LineChart,
  Bell,
  Landmark,
  ShieldCheck,
  Send,
  MessageCircle,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@shared/utils/cn';
import { useAuth } from '@features/auth/AuthProvider';
import { Button } from '@shared/ui/button';
import { BrandMark } from '@shared/ui/BrandLogo';
import { useActiveOrganization } from '@shared/context/ActiveOrganizationContext';
import { OrganizationSelector } from './OrganizationSelector';
import { GlobalUserSelector } from './GlobalUserSelector';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

type NavSection = {
  id: string;
  title: string;
  items: readonly NavItem[];
};

const overviewNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
] as const;

const financeNavItems = [
  { to: '/entries', label: 'Lançamentos', icon: ListChecks },
  { to: '/budgets', label: 'Orçamentos', icon: Wallet },
  { to: '/investments', label: 'Investimentos', icon: LineChart },
] as const;

const assistantNavItems = [
  { to: '/ai', label: 'Wallet Assistant', icon: Sparkles },
  { to: '/alerts', label: 'Alertas', icon: Bell },
] as const;

const integrationNavItems = [
  { to: '/telegram', label: 'Telegram', icon: Send },
] as const;

const adminNavItems = [
  { to: '/categories', label: 'Categorias', icon: Tag },
  { to: '/accounts', label: 'Contas', icon: PiggyBank },
  { to: '/debts', label: 'Dívidas', icon: Landmark },
] as const;

const platformNavItems = [
  { to: '/platform', label: 'Console de plataforma', icon: ShieldCheck },
  { to: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
] as const;

function buildNavSections(
  isPlatformConsole: boolean,
  isPlatformOperator: boolean,
  showAdminNav: boolean,
  isSuperAdmin: boolean,
): NavSection[] {
  if (isPlatformOperator && isPlatformConsole) {
    return [{ id: 'platform', title: 'Plataforma', items: platformNavItems }];
  }

  const sections: NavSection[] = [
    { id: 'overview', title: 'Visão geral', items: overviewNavItems },
    { id: 'finance', title: 'Finanças', items: financeNavItems },
    { id: 'assistant', title: 'Assistente', items: assistantNavItems },
    { id: 'integrations', title: 'Integrações', items: integrationNavItems },
  ];

  if (showAdminNav) {
    sections.push({ id: 'admin', title: 'Configuração', items: adminNavItems });
  }

  if (isSuperAdmin) {
    sections.push({ id: 'platform', title: 'Plataforma', items: platformNavItems });
  }

  return sections;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NavItemLink = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      className={({ isActive }: { isActive: boolean }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150',
          isActive
            ? 'bg-white/[0.07] text-foreground'
            : 'text-muted-foreground hover:bg-white/[0.03] hover:text-foreground/90',
        )
      }
    >
      {({ isActive }: { isActive: boolean }) => (
        <>
          {isActive ? (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sky-400" />
          ) : null}
          <Icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              isActive ? 'text-sky-300' : 'text-muted-foreground/60 group-hover:text-muted-foreground',
            )}
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
};

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user } = useAuth();
  const { organizations, isLoadingOrganizations } = useActiveOrganization();
  const location = useLocation();
  const isPlatformOperator = user?.role === 'super_admin';
  const isPlatformConsole = location.pathname === '/platform';
  const showAdminNav = user?.role === 'admin' || isPlatformOperator;
  const navSections = buildNavSections(
    isPlatformConsole,
    isPlatformOperator,
    showAdminNav,
    user?.role === 'super_admin',
  );

  // Fecha ao mudar de rota. `onClose` deve ser estável (ex.: useCallback no layout); caso contrário
  // cada render disparava o efeito e fechava a sidebar logo após abrir no mobile.
  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  return (
    <>
      {/* Backdrop (Mobile) */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />

      {/* Sidebar Container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[15.5rem] flex-col border-r border-white/[0.06] bg-slate-950/95 px-3 py-5 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:w-60 lg:translate-x-0 lg:bg-slate-950/80',
          isOpen ? 'translate-x-0 shadow-2xl shadow-black/40' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="mb-4 flex shrink-0 items-center justify-between px-1">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark height={32} className="shrink-0" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                WalletHub
              </h2>
              <p className="truncate text-[10px] text-muted-foreground/80">
                {isPlatformOperator ? 'Operador de plataforma' : 'Painel pessoal'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground lg:hidden"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Context selectors */}
        <div className="mb-4 shrink-0 space-y-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
          {isLoadingOrganizations ? (
            <p className="px-1 text-[11px] text-muted-foreground">A carregar espaços…</p>
          ) : isPlatformOperator ? (
            organizations.length === 0 ? (
              <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                Nenhuma organização na plataforma. Crie uma no{' '}
                <NavLink to="/platform" className="text-sky-300 hover:underline">
                  Console → Organizações
                </NavLink>
                .
              </p>
            ) : (
              <OrganizationSelector />
            )
          ) : organizations.length === 0 ? (
            <p className="px-1 text-[11px] leading-relaxed text-amber-400/90">
              Sem organização associada. Inicie sessão novamente ou contacte o suporte.
            </p>
          ) : organizations.length === 1 ? (
            <p className="truncate px-1 text-[11px] text-muted-foreground" title={organizations[0]?.name}>
              {organizations[0]?.name}
            </p>
          ) : (
            <OrganizationSelector />
          )}
          {!isPlatformConsole ? <GlobalUserSelector /> : null}
        </div>

        {/* Navigation */}
        <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-0.5">
          {navSections.map((section, index) => (
            <div key={section.id} className={cn(index > 0 && 'pt-1')}>
              <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavItemLink key={item.to} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {isPlatformOperator && isPlatformConsole ? (
          <div className="mt-3 shrink-0 border-t border-white/[0.06] pt-3">
            <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
              Auditar tenant
            </p>
            <NavLink
              to="/dashboard"
              className="group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.03] hover:text-foreground/90"
            >
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:text-muted-foreground" />
              <span>Abrir app financeiro</span>
            </NavLink>
          </div>
        ) : null}
      </aside>
    </>
  );
};
