import * as awsSdk from "aws-sdk";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { Project, ProjectFunctionLog } from "../types";
import { integrateWithRole } from "../utils/integrate-with-role";
import {
  filterLogsExludingAppLogs,
  getReportInformation,
  groupLogs,
  processLogMessageBasedOnType,
} from "../utils/log-collection";
import { ProjectFunctionLogs, ProjectTable } from "../dynamodb";
import { createDefinedUUID } from "../api/helpers/nano-id-helpers";

const stage = pulumi.getStack();

export const logCollectionLambda = new aws.lambda.CallbackFunction(
  `${stage}-log-collection-lambda`,
  {
    callback: async (event: aws.sqs.QueueEvent) => {
      const events = event.Records.map(async (record) => {
        const { functionName, project, functionArn, functionRuntime } =
          JSON.parse(record.body) as {
            project: Project;
            functionName: string;
            functionArn: string;
            functionRuntime: string;
          };
        const { roleArn, externalId, id, region } = project;

        const resp = await integrateWithRole(
          roleArn,
          externalId,
          "log-collection"
        );
        if (resp === false) {
          console.log("Role assumption failed");
          throw new Error("Failed to integrate");
        }

        const { Credentials } = resp as awsSdk.STS.AssumeRoleResponse;
        const { AccessKeyId, SecretAccessKey, SessionToken } =
          Credentials as awsSdk.STS.Credentials;

        const dynamodb = new awsSdk.DynamoDB.DocumentClient();

        const { Items: functionLogsInDb = [] } = await dynamodb
          .query({
            TableName: ProjectFunctionLogs.name.get(),
            KeyConditionExpression: "#projectIdfunctionName = :projectId",
            IndexName: "by-project-id-function-name-invoked-at",
            ExpressionAttributeNames: {
              "#projectIdfunctionName": "projectIdfunctionName",
            },
            ExpressionAttributeValues: {
              ":projectId": `${id}#${functionName}`,
            },
            ScanIndexForward: false,
            Limit: 1,
          })
          .promise();

        const startTime = functionLogsInDb[0]
          ? functionLogsInDb[0].lastInvokedAt.split("#")[1]
          : undefined;

        const cloudWatchLogs = new awsSdk.CloudWatchLogs({
          credentials: {
            accessKeyId: AccessKeyId,
            secretAccessKey: SecretAccessKey,
            sessionToken: SessionToken,
          },
          region,
        });

        const logGroupName = `/aws/lambda/${functionName}`;
        const logs: awsSdk.CloudWatchLogs.FilteredLogEvents = [];
        let nextToken: string | undefined = undefined;
        try {
          do {
            const params: awsSdk.CloudWatchLogs.FilterLogEventsRequest = {
              logGroupName,
              nextToken,
              startTime,
            };
            const data = await cloudWatchLogs.filterLogEvents(params).promise();
            logs.push(...(data.events || []));
            nextToken = data.nextToken;
          } while (nextToken);
        } catch (error) {
          if ((error as any)?.code === "ResourceNotFoundException") {
            console.log(`No logs found for function ${functionName}`);
          } else {
            throw error;
          }
        }

        const relevantLogs = filterLogsExludingAppLogs(logs);
        const groupedLogsPerInvocation = groupLogs(relevantLogs);

        const entries = groupedLogsPerInvocation.map(async (eachGroup) => {
          const groupInvokedAt = eachGroup[0].timestamp as number;
          const isCold =
            eachGroup[0].message?.startsWith("INIT_START") || false;
          const parsedGroup = eachGroup.map((log) => {
            const messageType = (log.message as string).split(" ")[0];
            const processedLog = processLogMessageBasedOnType(
              log.message as string,
              messageType
            );
            return { ...log, ...processedLog };
          });

          const newGroupLog: ProjectFunctionLog = {
            cycleLogs: parsedGroup,
            functionArn,
            functionName,
            id: createDefinedUUID(12),
            lastInvokedAt: `${id}#${groupInvokedAt as number}`,
            projectId: project.id,
            projectIdfunctionName: `${project.id}#${functionName}`,
            runtime: functionRuntime,
            startUpTime: groupInvokedAt,
            streamName: logGroupName,
            isCold,
            ...getReportInformation(eachGroup),
          };

          await dynamodb
            .put({
              TableName: ProjectFunctionLogs.name.get(),
              Item: newGroupLog,
            })
            .promise();
        });

        await Promise.all(entries);

        await dynamodb
          .update({
            TableName: ProjectTable.name.get(),
            Key: { id },
            UpdateExpression:
              "SET #logCollectedCount = if_not_exists(#logCollectedCount, :zero) + :one",
            ExpressionAttributeNames: {
              "#logCollectedCount": "logCollectedCount",
            },
            ExpressionAttributeValues: {
              ":zero": 0,
              ":one": 1,
            },
          })
          .promise();

        console.log(
          `Logs for function ${functionName}: ${groupedLogsPerInvocation.length} logs`
        );
      });

      await Promise.all(events);
    },
    timeout: 300,
    memorySize: 2048,
    role: new aws.iam.Role(`${stage}-log-collection-role`, {
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
                Resource: "*",
              },
              {
                Sid: "allowSQSPolling",
                Effect: "Allow",
                Action: [
                  "sqs:ReceiveMessage",
                  "sqs:DeleteMessage",
                  "sqs:GetQueueAttributes",
                  "sqs:SendMessage",
                ],
                Resource: "*",
              },
            ],
          }),
        },
      ],
    }),
  }
);
