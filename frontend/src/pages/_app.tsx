import { Amplify } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';
import type { AppProps } from "next/app";
import { amplifyConfig } from 'heatshield/config';

Amplify.configure(amplifyConfig);

const App = ({ Component, pageProps }: AppProps) => {
  return <Component {...pageProps} />;
}

export default App;