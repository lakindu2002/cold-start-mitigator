import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsSdk from "aws-sdk";
import { ProjectUserTable } from "../dynamodb";
import { ProjectUser } from "../types";
import { PreTokenGenerationTriggerEvent } from "aws-lambda";

const stage = pulumi.getStack()

export const preTokenGenerator = new aws.lambda.CallbackFunction(
  `${stage}-pre-token-generator`,
  {
    callback: async (event: PreTokenGenerationTriggerEvent) => {
      const { request } = event;
      const { userAttributes } = request;
      const { sub } = userAttributes;

      const dynamo = new awsSdk.DynamoDB.DocumentClient();
      const { Items } = await dynamo
        .query({
          TableName: ProjectUserTable.name.get(),
          IndexName: "projects-per-user",
          KeyConditionExpression: "#userId = :userId",
          ExpressionAttributeNames: {
            "#userId": "userId",
          },
          ExpressionAttributeValues: {
            ":userId": sub,
          },
        })
        .promise();

      const projectsPerUser = Items as ProjectUser[];

      const projectClaims = projectsPerUser.map((project) => ({
        id: project.userId,
        role: project.role,
      }));

      event.response = {
        claimsOverrideDetails: {
          claimsToAddOrOverride: {
            projects: JSON.stringify(projectClaims),
          },
        },
      };

      return event;
    },
    memorySize: 2048,
    timeout: 30,
  }
);
