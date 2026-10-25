import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '@features/auth/AuthProvider';
import { LoginPage } from '@pages/login/LoginPage';
import { LandingPage } from '@pages/landing/LandingPage';
import { DashboardPage } from '@pages/dashboard/DashboardPage';
import { EntriesPage } from '@pages/entries/EntriesPage';
import { BudgetsPage } from '@pages/budgets/BudgetsPage';
import { WhatsAppPage } from '@pages/whatsapp/WhatsAppPage';
import { TelegramPage } from '@pages/telegram/TelegramPage';
import { CategoriesPage } from '@pages/categories/CategoriesPage';
import { ProfilePage } from '@pages/profile/ProfilePage';
import { PlatformConsolePage } from '@pages/platform/PlatformConsolePage';
import { AiChatPage } from '@pages/ai/AiChatPage';
import { AlertsRemindersPage } from '@pages/alerts/AlertsRemindersPage';
import { AccountsPage } from '@pages/accounts/AccountsPage';
import { OfxAuditPage } from '@pages/accounts/OfxAuditPage';
import { DebtsPage } from '@pages/debts/DebtsPage';
import { InvestmentsPage } from '@pages/investments/InvestmentsPage';
import { AuthenticatedLayout } from '../layouts/AuthenticatedLayout';
import { PublicLayout } from '../layouts/PublicLayout';

const ProtectedRoute = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Landing page — public root */}
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />}
      />

      {/* Login */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <PublicLayout />}
      >
        <Route index element={<LoginPage />} />
      </Route>

      {/* Protected app routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/transactions" element={<Navigate to="/entries" replace />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route
            path="/categories"
            element={
              user?.role === 'admin' || user?.role === 'super_admin' ? (
                <CategoriesPage />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route path="/whatsapp" element={<WhatsAppPage />} />
          <Route path="/telegram" element={<TelegramPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<Navigate to="/profile" replace />} />
          {/* Legacy /settings/server retired — admin tooling consolidated into /platform. */}
          <Route path="/settings/server" element={<Navigate to="/platform" replace />} />
          <Route
            path="/accounts"
            element={
              user?.role === 'admin' || user?.role === 'super_admin' ? (
                <AccountsPage />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/accounts/imports"
            element={
              user?.role === 'admin' || user?.role === 'super_admin' ? (
                <OfxAuditPage />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/accounts/:accountId/imports"
            element={
              user?.role === 'admin' || user?.role === 'super_admin' ? (
                <OfxAuditPage />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/debts"
            element={
              user?.role === 'admin' || user?.role === 'super_admin' ? (
                <DebtsPage />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route path="/ai" element={<AiChatPage />} />
          <Route path="/alerts" element={<AlertsRemindersPage />} />
          <Route
            path="/platform"
            element={
              user?.role === 'super_admin' ? (
                <PlatformConsolePage />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
};
