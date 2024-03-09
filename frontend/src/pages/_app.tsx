import { Amplify } from 'aws-amplify';
import { withAuthenticator } from "@aws-amplify/ui-react";
import "heatshield/styles/globals.css";
import '@aws-amplify/ui-react/styles.css';
import type { AppProps } from "next/app";
import { amplifyConfig } from 'heatshield/config';

Amplify.configure(amplifyConfig);

const App = ({ Component, pageProps }: AppProps) => {
  return <Component {...pageProps} />;
}

export default withAuthenticator(App);