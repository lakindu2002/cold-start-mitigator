import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import * as health from "./health";
import * as integrations from "./integration";
import { output } from "../cognito";

const stage = pulumi.getStack();

export const api = new awsx.classic.apigateway.API(`${stage}-api-gateway`, {
  routes: [
    { path: "/health", method: "GET", eventHandler: health.healthLambda },
    {
      path: "/projects/{projectId}/integration/create",
      method: "POST",
      eventHandler: integrations.redirectClientToRoleCreation,
      authorizers: output.cognitoAuthorizer,
    },
    {
      path: "/projects/{projectId}/integration/confirm",
      method: "POST",
      eventHandler: integrations.testIntegration,
      authorizers: output.cognitoAuthorizer,
    },
  ],
});
