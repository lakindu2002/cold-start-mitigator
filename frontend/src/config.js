const env = await import.meta.env;
export const hostConfig = {
  baseURL: env.VITE_BASE_URL,
};

export const amplifyConfig = {
  Auth: {
    Cognito: {
      identityPoolId: env.VITE_AWS_COGNITO_IDENTITY_POOL_ID,
      userPoolId: env.VITE_AWS_USER_POOLS_ID,
      userPoolClientId: env.VITE_AWS_USER_POOLS_WEB_CLIENT_ID,
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

// Frequencies denoted in hours
export const COLLECTION_FREQUENCIES = [0.17, 0.5, 1, 3, 5, 7, 9, 12, 24];

export const AWS_REGIONS = [
  {
    code: "us-east-1",
    name: "US East (N. Virginia)"
  },
  {
    code: "us-east-2",
    name: "US East (Ohio)"
  },
  {
    code: "us-west-1",
    name: "US West (N. California)"
  },
  {
    code: "us-west-2",
    name: "US West (Oregon)"
  },
  {
    code: "af-south-1",
    name: "Africa (Cape Town)"
  },
  {
    code: "ap-east-1",
    name: "Asia Pacific (Hong Kong)"
  },
  {
    code: "ap-south-1",
    name: "Asia Pacific (Mumbai)"
  },
  {
    code: "ap-northeast-3",
    name: "Asia Pacific (Osaka)"
  },
  {
    code: "ap-northeast-2",
    name: "Asia Pacific (Seoul)"
  },
  {
    code: "ap-southeast-1",
    name: "Asia Pacific (Singapore)"
  },
  {
    code: "ap-southeast-2",
    name: "Asia Pacific (Sydney)"
  },
  {
    code: "ap-northeast-1",
    name: "Asia Pacific (Tokyo)"
  },
  {
    code: "ca-central-1",
    name: "Canada (Central)"
  },
  {
    code: "eu-central-1",
    name: "Europe (Frankfurt)"
  },
  {
    code: "eu-west-1",
    name: "Europe (Ireland)"
  },
  {
    code: "eu-west-2",
    name: "Europe (London)"
  },
  {
    code: "eu-south-1",
    name: "Europe (Milan)"
  },
  {
    code: "eu-west-3",
    name: "Europe (Paris)"
  },
  {
    code: "eu-north-1",
    name: "Europe (Stockholm)"
  },
  {
    code: "me-south-1",
    name: "Middle East (Bahrain)"
  },
  {
    code: "sa-east-1",
    name: "South America (São Paulo)"
  }
];