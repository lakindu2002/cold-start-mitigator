import { Helmet } from 'react-helmet-async';

import { RegisterView } from 'src/sections/register';

// ----------------------------------------------------------------------

export default function LoginPage() {
  return (
    <>
      <Helmet>
        <title> Create An Account | HeatShield</title>
      </Helmet>

      <RegisterView />
    </>
  );
}
