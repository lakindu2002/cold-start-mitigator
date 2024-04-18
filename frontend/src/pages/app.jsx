import { Helmet } from 'react-helmet-async';

import { useAuth } from 'src/contexts/auth-context';

import { AppView } from 'src/sections/overview/view';

// ----------------------------------------------------------------------

export default function AppPage() {
  const { user } = useAuth();

  return (
    <>
      <Helmet>
        <title> Dashboard | {user?.currentProject?.name} </title>
      </Helmet>

      <AppView />
    </>
  );
}
