import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsSdk from "aws-sdk";
import * as awsx from "@pulumi/awsx";
import { SuccessTrue } from "../helpers/response-helpers";
import { Parse } from "../helpers/event-helpers";
import { ProjectTable } from "../../dynamodb";

const stage = pulumi.getStack();

const createUpdateParams = (patchObject: {}) => {
  let UpdateExpression = "";
  let ExpressionAttributeNames = {};
  let ExpressionAttributeValues = {};

  Object.entries(patchObject).forEach(([key, value]) => {
    if (UpdateExpression.length > 0) {
      UpdateExpression += `, #${key} = :${key}`;
    } else {
      UpdateExpression = `SET #${key} = :${key}`;
    }
    ExpressionAttributeNames = {
      ...ExpressionAttributeNames,
      [`#${key}`]: key,
    };
    ExpressionAttributeValues = {
      ...ExpressionAttributeValues,
      [`:${key}`]: value,
    };
  });

  return {
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
  };
};

export const updateProject = new aws.lambda.CallbackFunction(
  `${stage}-update-project`,
  {
    memorySize: 1024,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const { body, pathParams } = Parse(event);
      const { projectId } = pathParams;

      const { frequency, patterns, region } = body as {
        patterns?: string[];
        frequency?: number;
        region?: string;
      };

      const {
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        UpdateExpression,
      } = createUpdateParams({ frequency, patterns, region });

      const dynamo = new awsSdk.DynamoDB.DocumentClient();

      await dynamo
        .update({
          TableName: ProjectTable.name.get(),
          UpdateExpression,
          ExpressionAttributeNames,
          ExpressionAttributeValues,
          Key: { id: projectId },
        })
        .promise();

      return SuccessTrue();
    },
  }
);
