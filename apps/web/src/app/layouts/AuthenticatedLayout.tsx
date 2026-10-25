import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { UserMenu } from './UserMenu';
import { AuditModeBanner } from './AuditModeBanner';
import { Button } from '@shared/ui/button';
import { cn } from '@shared/utils/cn';
import { GlobalScopeProvider } from '@shared/context/GlobalScopeContext';

export const AuthenticatedLayout = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const { pathname } = useLocation();
  const contentMaxWidth = pathname === '/platform' ? 'max-w-7xl' : 'max-w-6xl';

  return (
    <GlobalScopeProvider>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-foreground">
        <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-60">
            <div className="blur-3xl">
              <div className="absolute -left-20 top-[-60px] h-40 w-40 rounded-full bg-sky-500/40" />
              <div className="absolute right-[-60px] top-20 h-52 w-52 rounded-full bg-emerald-500/30" />
              <div className="absolute bottom-[-80px] left-10 h-48 w-48 rounded-full bg-fuchsia-500/25" />
            </div>
          </div>

          <header className="sticky top-0 z-20 border-b border-white/10 bg-gradient-to-r from-slate-950/85 via-slate-900/85 to-slate-950/85 px-4 py-3 backdrop-blur-xl">
            <div className={cn('mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3', pathname === '/platform' && 'max-w-7xl')}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Abrir menu</span>
                </Button>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="hidden h-6 w-px bg-white/10 sm:block" />
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="relative z-10 flex-1 px-4 py-4">
            <div className={cn('mx-auto flex h-full flex-col gap-4', contentMaxWidth)}>
              <AuditModeBanner />
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </GlobalScopeProvider>
  );
};
