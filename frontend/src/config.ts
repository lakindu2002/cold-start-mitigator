import { ResourcesConfig } from "aws-amplify";

export const hostConfig = {
  baseURL: process.env.NEXT_PUBLIC_BASE_URL,
};

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      identityPoolId: process.env
        .NEXT_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID as string,
      userPoolId: process.env.NEXT_PUBLIC_AWS_USER_POOLS_ID as string,
      userPoolClientId: process.env
        .NEXT_PUBLIC_AWS_USER_POOLS_WEB_CLIENT_ID as string,
      allowGuestAccess: false,
      loginWith: {
        email: true,
      },
      userAttributes: {
        name: {
          required: true,
        },
      },
    },
  },
};
