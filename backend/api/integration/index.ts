import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsSdk from "aws-sdk";
import * as awsx from "@pulumi/awsx";
import {
  CustomResponse,
  SuccessTrue,
  SuccessWithData,
} from "../helpers/response-helpers";
import { ProjectTable } from "../../dynamodb";
import { Project } from "../../types";
import { roleCreationCloudFormationStackObjectUrl } from "../../s3";
import { createDefinedUUID } from "../helpers/nano-id-helpers";
import { Parse } from "../helpers/event-helpers";
import { integrateWithRole } from "./util";

const stage = pulumi.getStack();

export const redirectClientToRoleCreation = new aws.lambda.CallbackFunction(
  `${stage}-redirect-role-creation`,
  {
    memorySize: 2048,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const pe = Parse(event);
      const { pathParams } = pe;
      const { projectId } = pathParams;

      const customerId = createDefinedUUID(10);
      const externalId = createDefinedUUID(30);
      const stackCreationRegion = "us-east-1";
      const stackName = "HeatSheildIntegration";

      const dynamodb = new awsSdk.DynamoDB.DocumentClient();

      await dynamodb
        .update({
          Key: { id: projectId },
          TableName: ProjectTable.name.get(),
          UpdateExpression:
            "SET #customerId = :customerId, #externalId = :externalId",
          ExpressionAttributeNames: {
            "#customerId": "customerId",
            "#externalId": "externalId",
          },
          ExpressionAttributeValues: {
            ":customerId": customerId,
            ":externalId": externalId,
          },
        })
        .promise();

      const redirectUrl = `https://${stackCreationRegion}.console.aws.amazon.com/cloudformation/home?region=${stackCreationRegion}#/stacks/quickcreate?stackName=${stackName}&templateURL=${roleCreationCloudFormationStackObjectUrl}&param_ExternalId=${externalId}&param_CustomerId=${customerId}`;

      return SuccessWithData({ stackCreationUrl: redirectUrl });
    },
  }
);

export const testIntegration = new aws.lambda.CallbackFunction(
  `${stage}-test-integration`,
  {
    memorySize: 2048,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const pe = Parse(event);
      const { body, pathParams } = pe;
      const { projectId } = pathParams;
      const { roleArn } = body as { roleArn: string };

      const dynamodb = new awsSdk.DynamoDB.DocumentClient();

      const { Items = [] } = await dynamodb
        .query({
          TableName: ProjectTable.name.get(),
          KeyConditionExpression: "#id = :id",
          ProjectionExpression: "#externalId",
          ExpressionAttributeNames: {
            "#id": "id",
            "#externalId": "externalId",
          },
          ExpressionAttributeValues: {
            ":id": projectId,
          },
        })
        .promise();

      const project = Items[0] as Project;
      const { externalId } = project;

      const integrationStatus = await integrateWithRole(roleArn, externalId);
      if (integrationStatus === false) {
        return CustomResponse("Failed to create a link with AWS Account", 502);
      }

      await dynamodb
        .update({
          TableName: ProjectTable.name.get(),
          Key: { id: projectId },
          UpdateExpression: "SET #roleArn = :roleArn",
          ExpressionAttributeNames: {
            "#roleArn": "roleArn",
          },
          ExpressionAttributeValues: {
            ":roleArn": roleArn,
          },
        })
        .promise();

      return SuccessTrue();
    },
  }
);
