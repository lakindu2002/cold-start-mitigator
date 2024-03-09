import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import type { AppProps } from "next/app";
import { amplifyConfig } from 'heatshield/config';
import { ThemeProvider, createTheme } from '@mui/material';

Amplify.configure(amplifyConfig);

const App = ({ Component, pageProps }: AppProps) => {
  return <ThemeProvider
    theme={createTheme()}
  >
    <Component {...pageProps} />
  </ThemeProvider>;
}

export default App;