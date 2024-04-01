import * as awsSdk from "aws-sdk";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Project, ProjectFunction, ProjectFunctionLog } from "../types";
import { integrateWithRole } from "../utils/integrate-with-role";
import { ProjectFunctionLogs, ProjectFunctions } from "../dynamodb";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { groupLogsThroughInitPeriod } from "../utils/log-collection";
import { createDefinedUUID } from "../api/helpers/nano-id-helpers";

const stage = pulumi.getStack();

/**
 * When collecting AWS Data:
 * 1. Get all Lambda functions provisioned on the region that matches the prepend.
 * 2. Collect in DB with Names
 * 3. Collect logs for those functions
 */
export const collectAwsData = new aws.lambda.CallbackFunction(
  `${stage}-collect-aws-data`,
  {
    callback: async (event: aws.sqs.QueueEvent) => {
      await Promise.all(
        event.Records.map(async (record) => {
          const {
            externalId,
            id,
            roleArn,
            patterns = [],
            region,
          } = JSON.parse(record.body).project as Project;

          const resp = await integrateWithRole(
            roleArn,
            externalId,
            "data-collection"
          );

          if (resp === false) {
            console.log("Role assumption failed");
            throw new Error("Failed to integrate");
          }

          const { Credentials } = resp as awsSdk.STS.AssumeRoleResponse;
          const { AccessKeyId, SecretAccessKey, SessionToken } =
            Credentials as awsSdk.STS.Credentials;

          // fetch all functions
          const lambda = new awsSdk.Lambda({
            region,
            credentials: {
              accessKeyId: AccessKeyId,
              secretAccessKey: SecretAccessKey,
              sessionToken: SessionToken,
            },
          });

          let marker;
          const functions: awsSdk.Lambda.FunctionList = [];
          do {
            const { Functions = [], NextMarker } = await lambda
              .listFunctions()
              .promise();
            marker = NextMarker;
            functions.push(...Functions);
          } while (marker !== null);

          const dynamodb = new awsSdk.DynamoDB.DocumentClient();

          const filteredFunctions = functions.filter((eachFunction) => {
            const isStartingWithPattern = patterns.some((pattern) =>
              eachFunction.FunctionName?.startsWith(pattern)
            );
            return isStartingWithPattern;
          });

          const inserts = filteredFunctions.map(async (eachFunction) => {
            const {
              FunctionName,
              FunctionArn,
              CodeSize,
              Architectures = [],
              EphemeralStorage,
              LastModified,
              MemorySize,
              Runtime,
              Timeout,
            } = eachFunction;

            const { Items = [] } = await dynamodb
              .query({
                TableName: ProjectFunctions.name.get(),
                KeyConditionExpression: "#projectId = :id AND #name = :name",
                Limit: 1,
                ExpressionAttributeNames: {
                  "#projectId": "projectId",
                  "#name": "name",
                },
                ExpressionAttributeValues: {
                  ":name": FunctionName,
                  ":id": id,
                },
              })
              .promise();

            if (Items.length === 0) {
              const entry: ProjectFunction = {
                name: FunctionName as string,
                arn: FunctionArn as string,
                codeSize: CodeSize as number,
                architectureList: Architectures,
                ephemeralStorageSize: (
                  EphemeralStorage as awsSdk.Lambda.EphemeralStorage
                ).Size,
                functionUpdatedAt: LastModified as string,
                memorySize: MemorySize as number,
                runtime: Runtime as string,
                timeout: Timeout as number,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                id: createDefinedUUID(12),
                projectId: id,
              };

              // override everytime
              await dynamodb
                .put({
                  TableName: ProjectFunctions.name.get(),
                  Item: entry,
                })
                .promise();
            }
          });

          await Promise.all(inserts);

          const cloudWatchLogs = new awsSdk.CloudWatchLogs({
            credentials: {
              accessKeyId: AccessKeyId,
              secretAccessKey: SecretAccessKey,
              sessionToken: SessionToken,
            },
            region,
          });

          const logEvents = filteredFunctions.map(async (eachFunction) => {
            const { FunctionName, Runtime, FunctionArn } = eachFunction;
            const logGroupName = `/aws/lambda/${FunctionName}`;
            console.log(`Fetching Logs For: ${logGroupName}`);

            const { Items: functionLogsInDb = [] } = await dynamodb
              .query({
                TableName: ProjectFunctionLogs.name.get(),
                KeyConditionExpression: "#projectIdfunctionName = :projectId",
                IndexName: "by-project-id-invoked-at",
                ExpressionAttributeNames: {
                  "#projectIdfunctionName": "projectIdfunctionName",
                },
                ExpressionAttributeValues: {
                  ":projectId": `${id}#${FunctionName}`,
                },
                ScanIndexForward: false,
                Limit: 1,
              })
              .promise();

            let startTime;

            if (functionLogsInDb.length > 0) {
              startTime = (
                functionLogsInDb[0] as ProjectFunctionLog
              ).lastInvokedAt.split("#")[1] as unknown as number;
            }
            try {
              const logs = await cloudWatchLogs
                .filterLogEvents({
                  logGroupName,
                  startTime,
                })
                .promise();

              const logsByInitStream = groupLogsThroughInitPeriod(
                logs.events || []
              );

              Object.entries(logsByInitStream).map(
                async ([streamName, logs]) => {
                  const functionLog: ProjectFunctionLog = {
                    id: createDefinedUUID(12),
                    projectId: id,
                    lastInvokedAt: `${id}#${logs.lastInvoked as number}`,
                    startUpTime: logs.startupTime,
                    cycleLogs: logs.logsForThatCycle,
                    functionName: FunctionName as string,
                    runtime: Runtime as string,
                    functionArn: FunctionArn as string,
                    streamName,
                    projectIdfunctionName: `${id}#${FunctionName}`,
                  };

                  await dynamodb
                    .put({
                      Item: functionLog,
                      TableName: ProjectFunctionLogs.name.get(),
                    })
                    .promise();
                }
              );
            } catch (err) {
              if ((err as any)?.code === "ResourceNotFoundException") {
                console.log("Function not yet invoked");
                return;
              }
              throw new Error((err as any)?.message);
            }
          });

          await Promise.all(logEvents);
        })
      );
    },

    timeout: 60,
    memorySize: 2048,
    role: new aws.iam.Role(`${stage}-collect-aws-data-role`, {
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
