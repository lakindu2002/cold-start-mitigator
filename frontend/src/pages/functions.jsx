import { Helmet } from 'react-helmet-async';

import { FunctionsView } from 'src/sections/funtions/view';

// ----------------------------------------------------------------------

export default function FunctionsPage() {
  return (
    <>
      <Helmet>
        <title> Create a Project | HeatShield</title>
      </Helmet>

      <FunctionsView />
    </>
  );
}
