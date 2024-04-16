import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import * as health from "./health";
import * as users from "./users";
import * as projects from "./projects";
import * as integrations from "./integration";
import { output } from "../cognito";

const stage = pulumi.getStack();

export const api = new awsx.classic.apigateway.API(`${stage}-api-gateway`, {
  routes: [
    { path: "/health", method: "GET", eventHandler: health.healthLambda },
    {
      path: "/account",
      method: "GET",
      authorizers: output.cognitoAuthorizer,
      eventHandler: users.getLoggedInUserInformation,
    },
    {
      path: "/projects/integration/create",
      method: "POST",
      eventHandler: integrations.redirectClientToRoleCreation,
      authorizers: output.cognitoAuthorizer,
    },
    {
      path: "/projects/{projectId}",
      method: "PATCH",
      eventHandler: projects.updateProject,
      authorizers: output.cognitoAuthorizer,
    },
    {
      path: "/projects/{projectId}",
      method: "GET",
      eventHandler: projects.getProjectById,
      authorizers: output.cognitoAuthorizer,
    },
    {
      path: "/projects/{projectId}/integration/ping",
      method: "POST",
      eventHandler: integrations.testIntegration,
      authorizers: output.cognitoAuthorizer,
    },
    {
      path: "/projects/{projectId}/functions/predict",
      method: "POST",
      eventHandler: projects.predictNextInvocationHandler,
      authorizers: output.cognitoAuthorizer,
    },
  ],
  restApiArgs: {
    binaryMediaTypes: [],
  },
});
