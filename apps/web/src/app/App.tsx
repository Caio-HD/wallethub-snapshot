import { Suspense } from 'react';
import { Toaster } from 'sonner';
import { AppRoutes } from './routes/AppRoutes';
import { useAuth } from '@features/auth/AuthProvider';

const SplashScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-neutral-100">
    <div className="flex flex-col items-center gap-4 text-neutral-500">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm font-medium">Carregando WalletHub…</p>
    </div>
  </div>
);

function App() {
  const { isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <SplashScreen />;
  }

  return (
    <>
      <Suspense fallback={<SplashScreen />}>
        <AppRoutes />
      </Suspense>
      <Toaster richColors position="top-right" />
    </>
  );
}

export default App;
