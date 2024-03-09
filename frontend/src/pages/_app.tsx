import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import type { AppProps } from "next/app";
import { amplifyConfig } from 'heatshield/config';
import { ThemeProvider } from '@mui/material';
import { defaultTheme } from 'heatshield/theme';

Amplify.configure(amplifyConfig);

const App = ({ Component, pageProps }: AppProps) => {
  return <ThemeProvider
    theme={defaultTheme}
  >
    <Component {...pageProps} />
  </ThemeProvider>;
}

export default App;