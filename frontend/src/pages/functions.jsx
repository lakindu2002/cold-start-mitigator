import { Helmet } from 'react-helmet-async';

import { FunctionsView } from 'src/sections/funtions/view';

// ----------------------------------------------------------------------

export default function FunctionsPage() {
  return (
    <>
      <Helmet>
        <title> Lambda Functions | HeatShield</title>
      </Helmet>

      <FunctionsView />
    </>
  );
}
