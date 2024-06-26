import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsSdk from "aws-sdk";
import * as awsx from "@pulumi/awsx";
import {
  CustomResponse,
  SuccessTrue,
  SuccessWithData,
} from "../helpers/response-helpers";
import { Parse } from "../helpers/event-helpers";
import {
  ProjectFunctionLogs,
  ProjectFunctions,
  ProjectTable,
} from "../../dynamodb";
import { Project, ProjectFunction, ProjectFunctionLog } from "../../types";
import { integrateWithRole } from "../../utils/integrate-with-role";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { subMinutes, subMonths } from "date-fns";
import {
  createPredictionTime,
  toCronExpression,
} from "../../utils/create-prediction-time";
import { SchedulerInvokeRole } from "../../iam";
import { warmInvocation } from "../../triggers";

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

      const { frequency, patterns, region, name, roleArn } = body as {
        patterns?: string[];
        frequency?: number;
        region?: string;
        name?: string;
        roleArn?: string;
      };

      const dynamo = new awsSdk.DynamoDB.DocumentClient();

      if (roleArn) {
        const { Items = [] } = await dynamo
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
          return CustomResponse(
            "Failed to create a link with AWS Account",
            502
          );
        }
      }

      const {
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        UpdateExpression,
      } = createUpdateParams({
        frequency,
        patterns,
        ...(region && { region }),
        ...(name && { name }),
        ...(roleArn && { roleArn }),
      });

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
    role: new aws.iam.Role(`${stage}-update-project-role`, {
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "lambda.amazonaws.com",
      }),
      managedPolicyArns: [
        ManagedPolicy.AWSXrayFullAccess,
        ManagedPolicy.LambdaFullAccess,
        ManagedPolicy.AmazonDynamoDBFullAccess,
        ManagedPolicy.AWSXrayFullAccess,
        ManagedPolicy.CloudWatchEventsFullAccess,
        ManagedPolicy.AWSLambdaBasicExecutionRole,
      ],
      inlinePolicies: [
        {
          name: "sts-assume-role",
          policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Sid: "allowStsAssumeRole",
                Effect: "Allow",
                Action: ["sts:AssumeRole"],
                Resource: ["*"],
              },
            ],
          }),
        },
      ],
    }),
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
          Limit:100,
          ExclusiveStartKey: logsNextKey,
        })
        .promise();

      logs.push(...(newLogs as ProjectFunctionLog[]));
      logsNextKey = logKey;

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
export const predictNextInvocation = new aws.lambda.Function(
  `${stage}-predict-next-invocation`,
  {
    packageType: "Image",
    imageUri:
      // Image hosted on Heat Shield's ECR
      "932055394976.dkr.ecr.us-east-1.amazonaws.com/heat-shield-evaluate:latest",
    role: predictNextInvocationRole.arn,
    timeout: 500,
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
      const { functionNames } = body as { functionNames: string[] };

      const promises = functionNames.map(async (functionName) => {
        const invocation = await createPredictionTime(
          projectId as string,
          functionName
        );
        return invocation;
      });
      const results = await Promise.all(promises);

      return SuccessWithData({ results });
    },
  }
);

export const getFunctionsPerProject = new aws.lambda.CallbackFunction(
  `${stage}-get-functions-per-project`,
  {
    memorySize: 1024,
    timeout: 30,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const { pathParams } = Parse(event);
      const { projectId } = pathParams;

      const dynamo = new awsSdk.DynamoDB.DocumentClient();
      const functions: ProjectFunction[] = [];
      let functionsNextKey: any = undefined;
      do {
        const { Items = [], LastEvaluatedKey } = await dynamo
          .query({
            TableName: ProjectFunctions.name.get(),
            IndexName: "by-project-id-function-id",
            KeyConditionExpression: "#projectId = :projectId",
            ExpressionAttributeNames: {
              "#projectId": "projectId",
            },
            ExpressionAttributeValues: {
              ":projectId": projectId,
            },
            ExclusiveStartKey: functionsNextKey,
          })
          .promise();

        functions.push(...(Items as ProjectFunction[]));
        functionsNextKey = LastEvaluatedKey;
      } while (functionsNextKey);

      const promises = functions.map(async (eachFunction) => {
        // get last invoked at
        const { Items = [] } = await dynamo
          .query({
            TableName: ProjectFunctionLogs.name.get(),
            IndexName: "by-project-id-function-name-invoked-at",
            KeyConditionExpression:
              "#projectIdfunctionName = :projectIdfunctionName",
            ExpressionAttributeNames: {
              "#projectIdfunctionName": "projectIdfunctionName",
            },
            ExpressionAttributeValues: {
              ":projectIdfunctionName": `${projectId}#${eachFunction.name}`,
            },
            ScanIndexForward: false,
            Limit: 1,
          })
          .promise();

        const lastInvokedAt = Items[0] as ProjectFunctionLog;

        return {
          ...eachFunction,
          ...(lastInvokedAt && {
            lastInvokedAt: Number(lastInvokedAt.lastInvokedAt.split("#")[1]),
            wasCold: lastInvokedAt.isCold,
          }),
        };
      });

      const functionsWithInvocationTime = await Promise.all(promises);

      return SuccessWithData({ functions: functionsWithInvocationTime });
    },
  }
);

export const getLogsPerFunctions = new aws.lambda.CallbackFunction(
  `${stage}-get-logs-per-function`,
  {
    memorySize: 1024,
    timeout: 30,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const { pathParams, body } = Parse(event);
      const { projectId } = pathParams;
      const {
        nextKey,
        limit = 10,
        functionName,
      } = body as { nextKey: any; limit?: number; functionName: string };

      const MAX_LIMIT = limit > 10 ? 10 : limit;

      const dynamo = new awsSdk.DynamoDB.DocumentClient();

      const { Items = [], LastEvaluatedKey } = await dynamo
        .query({
          TableName: ProjectFunctionLogs.name.get(),
          IndexName: "by-project-id-function-name-invoked-at",
          KeyConditionExpression:
            "#projectIdfunctionName = :projectIdfunctionName",
          ExpressionAttributeNames: {
            "#projectIdfunctionName": "projectIdfunctionName",
          },
          ExpressionAttributeValues: {
            ":projectIdfunctionName": `${projectId}#${functionName}`,
          },
          ScanIndexForward: false,
          Limit: MAX_LIMIT,
          ExclusiveStartKey: nextKey,
        })
        .promise();

      return SuccessWithData({ logs: Items, nextKey: LastEvaluatedKey });
    },
  }
);

export const warmFunction = new aws.lambda.CallbackFunction(
  `${stage}-warm-function`,
  {
    memorySize: 1024,
    timeout: 30,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const { pathParams, body } = Parse(event);
      const { projectId } = pathParams;
      const { functionName, invocationTime, functionId, functionArn } =
        body as {
          functionName: string;
          invocationTime: number;
          functionId: string;
          functionArn: string;
        };

      const dynamo = new awsSdk.DynamoDB.DocumentClient();
      const { Item } = await dynamo
        .get({
          TableName: ProjectTable.name.get(),
          Key: { id: projectId },
        })
        .promise();

      const scheduler = new awsSdk.Scheduler();
      const timer = subMinutes(invocationTime, 1);

      const project = Item as Project;

      const { Item: ProjectFunctionResp } = await dynamo
        .get({
          TableName: ProjectFunctions.name.get(),
          Key: { id: functionId, projectId },
        })
        .promise();

      const projectFunction = ProjectFunctionResp as ProjectFunction;

      const payload = {
        FlexibleTimeWindow: {
          Mode: "OFF",
        },
        Name: `${projectId}-${functionName}`,
        ScheduleExpression: toCronExpression(timer.toISOString()),
        Target: {
          Arn: warmInvocation.arn.get(),
          RoleArn: SchedulerInvokeRole.arn.get(),
          Input: JSON.stringify({
            projectId,
            functionId,
            functionName,
            roleArn: project.roleArn,
            externalId: project.externalId,
            functionArn,
          }),
        },
      };

      let schedulerArn;
      if (projectFunction.warmerArn) {
        const { ScheduleArn } = await scheduler
          .updateSchedule(payload)
          .promise();
        schedulerArn = ScheduleArn;
      } else {
        const { ScheduleArn } = await scheduler
          .createSchedule(payload)
          .promise();
        schedulerArn = ScheduleArn;
      }

      await dynamo
        .update({
          TableName: ProjectFunctions.name.get(),
          Key: { id: functionId, projectId },
          UpdateExpression:
            "set #warmerArn = :warmerArn, #warmerTime = :warmerTime",
          ExpressionAttributeNames: {
            "#warmerArn": "warmerArn",
            "#warmerTime": "warmerTime",
          },
          ExpressionAttributeValues: {
            ":warmerArn": schedulerArn,
            ":warmerTime": timer.toISOString(),
          },
        })
        .promise();

      return SuccessWithData({
        warmerArn: warmInvocation.arn.get(),
        warmerTime: timer.toISOString(),
      });
    },
  }
);
