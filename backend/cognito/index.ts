import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import { preTokenGenerator, signUpConfirmation } from "../triggers";

const stage = pulumi.getStack();
const config = new pulumi.Config();
const webDomain = config.require("web-domain");

const webUrl = `https://${webDomain}`;

const cognitoUserPool = new aws.cognito.UserPool(`${stage}-main-userpool`, {
  usernameAttributes: ["email"],
  autoVerifiedAttributes: ["email"],
  accountRecoverySetting: {
    recoveryMechanisms: [{ name: "verified_email", priority: 1 }],
  },
  passwordPolicy: {
    requireLowercase: false,
    requireUppercase: false,
    minimumLength: 8,
    requireSymbols: false,
    temporaryPasswordValidityDays: 14,
  },
  adminCreateUserConfig: {
    allowAdminCreateUserOnly: false,
  },
  lambdaConfig: {
    postConfirmation: signUpConfirmation.arn,
    preTokenGeneration: preTokenGenerator.arn,
  },
});

const allowOnSignUpCognito = new aws.lambda.Permission('AllowExecutionFromCognito', {
  action: 'lambda:InvokeFunction',
  function: signUpConfirmation.name,
  principal: 'cognito-idp.amazonaws.com',
  sourceArn: cognitoUserPool.arn,
});

const allowCognitoPreTokenGeneration = new aws.lambda.Permission(`${stage}-allow-pre-token-configuration-from-cognito`, {
  action: 'lambda:InvokeFunction',
  function: preTokenGenerator.name,
  principal: 'cognito-idp.amazonaws.com',
  sourceArn: cognitoUserPool.arn,
});

const client = new aws.cognito.UserPoolClient(`${stage}-web-userpool-client`, {
  userPoolId: cognitoUserPool.id,
  callbackUrls: ["http://localhost:3000", webUrl],
  logoutUrls: ["http://localhost:3000", webUrl],
  allowedOauthFlows: ["code"],
});

const cognitoIdentityPool = new aws.cognito.IdentityPool(
  `${stage}-identityPool`,
  {
    identityPoolName: `${stage}_identitypool`,
    allowUnauthenticatedIdentities: false,
    cognitoIdentityProviders: [
      {
        clientId: client.id,
        providerName: cognitoUserPool.endpoint,
        serverSideTokenCheck: false,
      },
    ],
  }
);

const authenticatedRole = new aws.iam.Role(`${stage}-authenticatedRole`, {
  assumeRolePolicy: pulumi.all([cognitoIdentityPool.id]).apply(([cognitoId]) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Federated: "cognito-identity.amazonaws.com",
          },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": `${cognitoId}`,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "authenticated",
            },
          },
        },
        {
          Effect: "Allow",
          Principal: {
            Federated: "cognito-identity.amazonaws.com",
          },
          Action: "sts:TagSession",
          Condition: {
            StringEquals: {
              "cognito-identity.amazonaws.com:aud": `${cognitoId}`,
            },
            "ForAnyValue:StringLike": {
              "cognito-identity.amazonaws.com:amr": "authenticated",
            },
          },
        },
      ],
    })
  ),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const identityPoolRoleAttachment = new aws.cognito.IdentityPoolRoleAttachment(
  `${stage}-identityPoolRoleAttachment`,
  {
    identityPoolId: cognitoIdentityPool.id,
    roles: {
      authenticated: authenticatedRole.arn,
    },
  }
);

export const output = {
  userPoolId: cognitoUserPool.id,
  userPoolClientId: client.id,
  identityPoolId: cognitoIdentityPool.id,
  cognitoAuthorizer: [
    awsx.classic.apigateway.getCognitoAuthorizer({
      providerARNs: [cognitoUserPool],
    }),
  ],
  userPoolName: cognitoUserPool.name,
  userPoolArn: cognitoUserPool.arn,
};
