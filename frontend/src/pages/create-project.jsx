import { Helmet } from 'react-helmet-async';

import { CreateProjectView } from 'src/sections/create-project';

// ----------------------------------------------------------------------

export default function CreateProjectPage() {
  return (
    <>
      <Helmet>
        <title> Create a Project | HeatShield</title>
      </Helmet>
      <CreateProjectView />
    </>
  );
}
