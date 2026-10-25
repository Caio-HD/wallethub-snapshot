import { Menu, Transition } from '@headlessui/react';
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@features/auth/AuthProvider';
import { buildUserPhotoUrl } from '@shared/lib/walletHubApiBaseUrl';

export const UserMenu = () => {
  const { user, logout } = useAuth();
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);

  const photoSrc = user ? buildUserPhotoUrl(user.id, user.photoUrl) : null;

  useEffect(() => {
    setPhotoLoadFailed(false);
  }, [user?.id, user?.photoUrl]);

  const showPhoto = Boolean(photoSrc && !photoLoadFailed);

  return (
    <Menu as="div" className="relative inline-block text-left" data-testid="user-menu">
      <Menu.Button className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1 pr-3 transition-all hover:bg-white/10">
        {showPhoto ? (
          <img
            src={photoSrc!}
            alt={user?.name}
            className="h-8 w-8 rounded-full object-cover shadow-soft-sm ring-1 ring-white/20"
            onError={() => setPhotoLoadFailed(true)}
          />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-sm font-bold text-white shadow-soft-sm">
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
        <div className="hidden text-left lg:flex lg:flex-col">
          <span
            data-testid="user-name"
            className="max-w-[120px] truncate text-xs font-semibold text-foreground/90 group-hover:text-foreground"
          >
            {user?.name ?? 'Usuário'}
          </span>
        </div>
      </Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-3 w-56 origin-top-right overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 shadow-2xl backdrop-blur-2xl focus:outline-none">
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Sessão ativa
            </p>
          </div>
          <div className="border-t border-white/10" />
          <div className="p-1">
            <Menu.Item>
              {({ active }) => (
                <Link
                  to="/profile"
                  className={clsx(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                    active ? 'bg-white/10 text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <UserIcon className="h-4 w-4" />
                  Configuração de Perfil
                </Link>
              )}
            </Menu.Item>
            {user?.role === 'super_admin' ? (
              <Menu.Item>
                {({ active }) => (
                  <Link
                    to="/platform"
                    className={clsx(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all',
                      active ? 'bg-white/10 text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Console de plataforma
                  </Link>
                )}
              </Menu.Item>
            ) : null}
            <Menu.Item>
              {({ active }) => (
                <button
                  type="button"
                  data-testid="logout"
                  onClick={logout}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all text-rose-400',
                    active ? 'bg-rose-500/10' : '',
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Encerrar sessão
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};
