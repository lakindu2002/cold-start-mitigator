import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsSdk from "aws-sdk";
import * as awsx from "@pulumi/awsx";
import { SuccessTrue, SuccessWithData } from "../helpers/response-helpers";
import { Parse } from "../helpers/event-helpers";
import { ProjectFunctionLogs, ProjectTable } from "../../dynamodb";
import { Project, ProjectFunctionLog } from "../../types";

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

export const getProjectById = new aws.lambda.CallbackFunction(
  `${stage}-get-project-by-id`,
  {
    memorySize: 1024,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const { pathParams } = Parse(event);
      const { projectId } = pathParams;

      const dynamo = new awsSdk.DynamoDB.DocumentClient();
      const { Item: ProjectItem } = (await dynamo
        .get({
          TableName: ProjectTable.name.get(),
          Key: { id: projectId },
        })
        .promise()) as unknown as { Item: Project };

      // get project logs and get count of logs collected
      const logs: ProjectFunctionLog[] = [];
      let logsNextKey: any = undefined;

      do {
        const { LastEvaluatedKey: logKey, Items: newLogs = [] } = await dynamo
          .query({
            TableName: ProjectFunctionLogs.name.get(),
            IndexName: "by-project-id-invoked-at",
            KeyConditionExpression: "#projectId = :projectId",
            ExpressionAttributeNames: {
              "#projectId": "projectId",
            },
            ExpressionAttributeValues: {
              ":projectId": projectId,
            },
            ExclusiveStartKey: logsNextKey,
          })
          .promise();

        logs.push(...(newLogs as ProjectFunctionLog[]));
        logsNextKey = logKey;
      } while (logsNextKey);

      const coldStartLogs = logs.filter((log) => log.isCold);

      // filter invocations happened in the last week
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const lastWeekLogs = logs.filter(
        (log) => new Date(log.startUpTime) > lastWeek
      );

      // for each day, get count of logs for each function
      const logsByDay = lastWeekLogs.reduce((acc, log) => {
        const date = new Date(log.startUpTime).toDateString();
        if ((acc as any)[date]) {
          (acc as any)[date] = {
            ...(acc as any)[date],
            [log.functionName]: (acc as any)[date][log.functionName]
              ? (acc as any)[date][log.functionName] + 1
              : 1,
          };
        } else {
          (acc as any)[date] = {
            [log.functionName]: 1,
          };
        }
        return acc;
      }, {});

      let functionsWithMostColdStarts = coldStartLogs.reduce((acc, log) => {
        if (acc[log.functionName]) {
          acc[log.functionName] += 1;
        } else {
          acc[log.functionName] = 1;
        }
        return acc;
      }, {} as { [key: string]: number });

      // sort functionsWithMostColdStarts by value
      functionsWithMostColdStarts = Object.entries(functionsWithMostColdStarts)
        .sort(([, a], [, b]) => b - a)
        .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

      // delete entries after 5th key in functionsWithMostColdStarts
      const keys = Object.keys(functionsWithMostColdStarts);
      if (keys.length > 5) {
        keys.slice(5).forEach((key) => {
          delete functionsWithMostColdStarts[key];
        });
      }

      const projectDto = {
        id: ProjectItem.id,
        createdAt: ProjectItem.createdAt,
        updatedAt: ProjectItem.updatedAt,
        frequency: ProjectItem.frequency,
        patterns: ProjectItem.patterns,
        region: ProjectItem.region,
        role: ProjectItem.roleArn,
        functionCount: ProjectItem.functionCount,
        logCount: logs.length,
        name: ProjectItem.name,
        coldStartEvents: coldStartLogs.length,
        logsByDay,
        functionsWithMostColdStarts,
      };

      return SuccessWithData({ project: projectDto });
    },
  }
);

// Create a role and attach the AWSLambdaBasicExecutionRole policy
const predictNextInvocationRole = new aws.iam.Role(
  `${stage}-predict-next-invocation-role`,
  {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: "lambda.amazonaws.com",
    }),
  }
);

new aws.iam.RolePolicyAttachment(
  `${stage}-predict-next-invocation-assign-basic-execution-role`,
  {
    role: predictNextInvocationRole,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
  }
);

new aws.iam.RolePolicyAttachment(`${stage}-assign-s3-read`, {
  role: predictNextInvocationRole,
  policyArn: aws.iam.ManagedPolicy.AmazonS3ReadOnlyAccess,
});

new aws.iam.RolePolicyAttachment(`${stage}-assign-dynamodb-read`, {
  role: predictNextInvocationRole,
  policyArn: aws.iam.ManagedPolicy.AmazonDynamoDBReadOnlyAccess,
});

// Create a Lambda function using the Docker image
const predictNextInvocation = new aws.lambda.Function(
  `${stage}-predict-next-invocation`,
  {
    packageType: "Image",
    imageUri:
      // Image hosted on Heat Shield's ECR
      "932055394976.dkr.ecr.us-east-1.amazonaws.com/heat-shield-evaluate@sha256:9c00a7e2858763c9f14c80d252735c0d3414dd4de08083a0cddb4c18500a0d20",
    role: predictNextInvocationRole.arn,
    timeout: 50,
    memorySize: 10239,
  }
);

export const predictNextInvocationHandler = new aws.lambda.CallbackFunction(
  `${stage}-predict-next-invocation-handler`,
  {
    memorySize: 1024,
    timeout: 30,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const { pathParams, body } = Parse(event);
      const { projectId } = pathParams;
      const { functionName } = body as { functionName: string };

      const lambda = new awsSdk.Lambda();

      const resp = await lambda
        .invoke({
          FunctionName: predictNextInvocation.arn.get(),
          Payload: JSON.stringify({ projectId, functionName }),
        })
        .promise();

      return SuccessWithData({ resp });
    },
  }
);
