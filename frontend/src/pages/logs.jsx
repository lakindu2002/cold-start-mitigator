import { Helmet } from 'react-helmet-async';

import LogsView from 'src/sections/logs/view/logs-view';

// ----------------------------------------------------------------------

export default function LogsPage() {
  return (
    <>
      <Helmet>
        <title> Logs | HeatShield</title>
      </Helmet>
      <LogsView />
    </>
  );
}
