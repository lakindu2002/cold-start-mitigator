import { lazy, Suspense } from 'react';
import { Outlet, Navigate, useRoutes } from 'react-router-dom';

import DashboardLayout from 'src/layouts/dashboard';

export const HomePage = lazy(() => import('src/pages/app'));
export const LandingPage = lazy(() => import('src/pages/landing'));
export const UserPage = lazy(() => import('src/pages/user'));
export const LoginPage = lazy(() => import('src/pages/login'));
export const ConfirmAccountPage = lazy(() => import('src/pages/confirm-account'));
export const SettingsPage = lazy(() => import('src/pages/settings'));
export const RegisterPage = lazy(() => import('src/pages/register'));
export const Page404 = lazy(() => import('src/pages/page-not-found'));
export const CreateProjectPage = lazy(() => import('src/pages/create-project'));

// ----------------------------------------------------------------------

export default function Router() {
  const routes = useRoutes([
    {
      element: (
        <DashboardLayout>
          <Suspense>
            <Outlet />
          </Suspense>
        </DashboardLayout>
      ),
      path: 'projects/:projectId',
      children: [
        {
          element: <HomePage />,
          index: true,
        },
        {
          path: 'settings',
          element: <SettingsPage />,
        },
      ],
    },
    {
      element: <Outlet />,
      path: '',
      children: [
        { element: <LandingPage />, index: true },
        { path: 'login', element: <LoginPage /> },
        { path: 'confirm-account', element: <ConfirmAccountPage /> },
        { path: 'register', element: <RegisterPage /> },
        { path: 'create-project', element: <CreateProjectPage /> },
      ],
    },
    {
      path: '404',
      element: <Page404 />,
    },
    {
      path: '*',
      element: <Navigate to="/404" replace />,
    },
  ]);

  return routes;
}
