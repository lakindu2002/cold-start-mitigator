import { Toaster } from 'react-hot-toast';

import Router from 'src/routes/sections';

import { useScrollToTop } from 'src/hooks/use-scroll-to-top';

import 'src/global.css';
import ThemeProvider from 'src/theme';

import { AuthGuard } from './guard/auth-guard';

// ----------------------------------------------------------------------

export default function App() {
  useScrollToTop();

  return (
    <AuthGuard>
        <Toaster />
        <ThemeProvider>
          <Router />
        </ThemeProvider>
      </AuthGuard>
  );
}
