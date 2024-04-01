import { Helmet } from 'react-helmet-async';

import { ConfirmAccountView } from 'src/sections/confirm-account';

// ----------------------------------------------------------------------

export default function ConfirmAccountPage() {
  return (
    <>
      <Helmet>
        <title> Verify Account | HeatShield</title>
      </Helmet>
      <ConfirmAccountView />
    </>
  );
}
