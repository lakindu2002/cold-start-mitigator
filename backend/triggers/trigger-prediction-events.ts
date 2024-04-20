import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsSdk from "aws-sdk";
import { S3Event } from "aws-lambda";
import { ProjectFunctions, ProjectTable } from "../dynamodb";
import { Project, ProjectFunction } from "../types";
import { Queues } from "../sqs";

const stage = pulumi.getStack();

export const triggerPredictionEvents = new aws.lambda.CallbackFunction(
  `${stage}-trigger-preciction-events`,
  {
    callback: async (event: S3Event) => {
      // Read options from the event parameter.
      const rec = event.Records[0];

      if (rec.eventName !== "ObjectCreated:Put") {
        console.log("Not triggered for ObjectCreated:Put");
        return;
      }

      const projectModelTrainedMatch = rec.s3.object.key.includes("/model");
      if (!projectModelTrainedMatch) {
        console.log("Not triggered for model trained");
        return;
      }

      const projectId = rec.s3.object.key.split("/")[0];

      if (!rec.s3.object.key.endsWith("model.tar.gz")) {
        return;
      }

      console.log({ projectId, key: rec.s3.object.key });

      // get all functions in this project
      const dynamo = new awsSdk.DynamoDB.DocumentClient();

      const functions: ProjectFunction[] = [];
      let nextKey: any = undefined;

      const { Item: ProjectInformation } = await dynamo
        .get({
          TableName: ProjectTable.name.get(),
          Key: { id: projectId },
        })
        .promise();

      const { roleArn, externalId } = ProjectInformation as Project;

      do {
        const { Items = [], LastEvaluatedKey } = await dynamo
          .query({
            TableName: ProjectFunctions.name.get(),
            IndexName: "by-project-id-function-id",
            KeyConditionExpression: "projectId = :projectId",
            ExpressionAttributeValues: {
              ":projectId": projectId,
            },
            ExclusiveStartKey: nextKey,
          })
          .promise();

        functions.push(...(Items as ProjectFunction[]));
        nextKey = LastEvaluatedKey;
      } while (nextKey);

      const sqs = new awsSdk.SQS();
      const predictionRequests = functions.map(
        async (eachFunction: ProjectFunction) => {
          await sqs
            .sendMessage({
              QueueUrl: Queues.predictionQueue.url.get(),
              MessageBody: JSON.stringify({
                projectId,
                functionId: eachFunction.id,
                functionName: eachFunction.name,
                roleArn,
                externalId,
                functionArn: eachFunction.arn,
              }),
            })
            .promise();
        }
      );

      await Promise.all(predictionRequests);
    },
    timeout: 30,
    memorySize: 2048,
  }
);
