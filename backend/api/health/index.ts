import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { SuccessWithData } from "../helpers/response-helpers";

const stage = pulumi.getStack();

export const healthLambda = new aws.lambda.CallbackFunction(`${stage}-health`, {
  memorySize: 1024,
  callback: (): Promise<awsx.classic.apigateway.Response> => {
    return SuccessWithData({ message: "HEALTHY" });
  },
});
