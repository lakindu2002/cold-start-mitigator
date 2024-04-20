import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsSdk from "aws-sdk";
import { PostConfirmationTriggerEvent } from "aws-lambda";
import { getDefaultUser } from "../utils/get-defaults";
import { UserTable } from "../dynamodb";

const stage = pulumi.getStack();

export const predictNextInvocation = new aws.lambda.CallbackFunction(
  `${stage}-on-predict-next-invocation`,
  {
    callback: async (event: PostConfirmationTriggerEvent) => {
      return event;
    },
    timeout: 30,
    memorySize: 2048,
  }
);
