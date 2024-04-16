import * as awsSdk from "aws-sdk";
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { parse } from "json2csv";
import { ProjectFunctionLog } from "../types";
import { ProjectFunctionLogs } from "../dynamodb";
import { modelTrainingBucket } from "../s3";
import { ManagedPolicy } from "@pulumi/aws/iam";

const stage = pulumi.getStack();

export const createCsvData = new aws.lambda.CallbackFunction(
  `${stage}-create-csv-data`,
  {
    callback: async (event: aws.sqs.QueueEvent) => {
      const events = event.Records.map(async (record) => {
        const { projectId } = JSON.parse(record.body) as {
          projectId: string;
        };
        const dynamodb = new awsSdk.DynamoDB.DocumentClient();

        // query log table
        const logs: ProjectFunctionLog[] = [];
        let nextKey: awsSdk.DynamoDB.DocumentClient.Key | undefined;

        do {
          const { Items = [], LastEvaluatedKey } = await dynamodb
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
              ExclusiveStartKey: nextKey,
            })
            .promise();

          logs.push(...(Items as ProjectFunctionLog[]));
          nextKey = LastEvaluatedKey;
        } while (nextKey);

        const csv = parse(logs);

        const s3 = new awsSdk.S3({ region: "us-east-1" });

        await s3
          .putObject({
            Bucket: modelTrainingBucket.bucket.get(),
            Key: `${projectId}/train_data.csv`,
            Body: csv,
          })
          .promise();

        // move past models to archive
        const modelPath = `${projectId}/model/`;

        const { Contents = [] } = await s3
          .listObjectsV2({
            Bucket: modelTrainingBucket.bucket.get(),
            Prefix: modelPath,
          })
          .promise();

        await Promise.all(
          Contents.map(async ({ Key = "" }) => {
            await s3
              .copyObject({
                Bucket: modelTrainingBucket.bucket.get(),
                CopySource: `${modelTrainingBucket.bucket.get()}/${Key}`,
                Key: `${projectId}/archive/${Key.replace(modelPath, "")}`,
              })
              .promise();

            await s3
              .deleteObject({
                Bucket: modelTrainingBucket.bucket.get(),
                Key,
              })
              .promise();
          })
        );

        // trigger sagemaker training job
        const sagemaker = new awsSdk.SageMaker({ region: "us-east-1" });

        await sagemaker
          .createTrainingJob({
            TrainingJobName: `${projectId}-${Date.now()}`,
            AlgorithmSpecification: {
              TrainingImage:
                "932055394976.dkr.ecr.us-east-1.amazonaws.com/heat-shield-training",
              TrainingInputMode: "File",
            },
            RoleArn:
              "arn:aws:iam::932055394976:role/service-role/AmazonSageMaker-ExecutionRole-20230501T203158",
            InputDataConfig: [
              {
                ChannelName: "train",
                DataSource: {
                  S3DataSource: {
                    S3DataType: "S3Prefix",
                    S3Uri: `s3://${modelTrainingBucket.bucket.get()}/${projectId}/train_data.csv`,
                    S3DataDistributionType: "FullyReplicated",
                  },
                },
              },
            ],
            OutputDataConfig: {
              S3OutputPath: `s3://${modelTrainingBucket.bucket.get()}/${projectId}/model/`,
            },
            ResourceConfig: {
              InstanceCount: 1,
              InstanceType: "ml.m5.large",
              VolumeSizeInGB: 10,
            },
            StoppingCondition: {
              MaxRuntimeInSeconds: 86400,
            },
            HyperParameters: {
              projectId: projectId,
            },
          })
          .promise();
      });

      await Promise.all(events);
    },
    timeout: 300,
    memorySize: 2048,
    role: new aws.iam.Role(`${stage}-create-csv-role`, {
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
                Action: ["sts:AssumeRole", "iam:PassRole"],
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
              {
                Sid: "allowSageMakerCreateTrainingJob",
                Effect: "Allow",
                Action: [
                  "sagemaker:CreateTrainingJob",
                  "sagemaker:DescribeTrainingJob",
                ],
                Resource: "*",
              },
              {
                Sid: "allowS3Actions",
                Effect: "Allow",
                Action: [
                  "s3:PutObject",
                  "s3:GetObject",
                  "s3:DeleteObject",
                  "s3:CopyObject",
                  "s3:ListBucket",
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
