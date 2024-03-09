import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsSdk from "aws-sdk";
import { PostConfirmationTriggerEvent } from "aws-lambda";
import { getDefaultUser } from "../utils/get-defaults";
import { UserTable } from "../dynamodb";

const stage = pulumi.getStack();

export const signUpConfirmation = new aws.lambda.CallbackFunction(
  `${stage}-user-on-sign-up-complete`,
  {
    callback: async (event: PostConfirmationTriggerEvent) => {
      const { triggerSource } = event;
      if (triggerSource === "PostConfirmation_ConfirmSignUp") {
        // execute event only on sign up.
        const { name, email, sub } = event.request.userAttributes;
        const user = getDefaultUser(email, name, sub);

        const dynamo = new awsSdk.DynamoDB.DocumentClient();

        await dynamo
          .put({
            TableName: UserTable.name.get(),
            Item: user,
          })
          .promise();
      }
      return event;
    },
    timeout: 20,
    memorySize: 512,
  }
);
