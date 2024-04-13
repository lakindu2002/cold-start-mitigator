import * as awsSdk from "aws-sdk";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Project, ProjectFunction } from "../types";
import { integrateWithRole } from "../utils/integrate-with-role";
import { ProjectFunctions, ProjectTable } from "../dynamodb";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { createDefinedUUID } from "../api/helpers/nano-id-helpers";
import { Queues } from "../sqs";

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
    timeout: 300,
    callback: async (event: aws.sqs.QueueEvent) => {
      await Promise.all(
        event.Records.map(async (record) => {
          const project = JSON.parse(record.body).project as Project;
          const { externalId, id, roleArn, patterns = [], region } = project;

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
                IndexName: "by-function-name-project",
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

          console.log(
            `Inserted ${filteredFunctions.length} functions for project ${id}`
          );

          await dynamodb
            .update({
              TableName: ProjectTable.name.get(),
              Key: { id },
              UpdateExpression: "SET #functionCount = :functionCount",
              ExpressionAttributeNames: {
                "#functionCount": "functionCount",
              },
              ExpressionAttributeValues: {
                ":functionCount": filteredFunctions.length,
              },
            })
            .promise();

          console.log(
            `Updated function count for project ${id} to ${filteredFunctions.length}`
          );

          // Collect logs for each function
          const sqs = new awsSdk.SQS();
          const logEvents = filteredFunctions.map(async (eachFunction) => {
            const { FunctionName, Runtime, FunctionArn } = eachFunction;
            await sqs
              .sendMessage({
                QueueUrl: Queues.logCollectionQueue.url.get(),
                MessageBody: JSON.stringify({
                  functionName: FunctionName,
                  runtime: Runtime,
                  functionArn: FunctionArn,
                  project,
                }),
              })
              .promise();

            console.log(`Queued log collection for ${FunctionName}`);
          });

          await Promise.all(logEvents);
        })
      );
    },

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
