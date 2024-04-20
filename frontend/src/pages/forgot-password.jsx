import { Helmet } from 'react-helmet-async';

import { ForgotPasswordView } from 'src/sections/forgot-password/view';

// ----------------------------------------------------------------------

export default function ConfirmAccountPage() {
  return (
    <>
      <Helmet>
        <title> Forgot Password | HeatShield</title>
      </Helmet>
      <ForgotPasswordView />
    </>
  );
}
