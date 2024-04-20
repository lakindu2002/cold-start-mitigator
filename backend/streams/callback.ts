import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsSdk from "aws-sdk";
import { Project } from "../types";
import { ProjectTable, ProjectTenancyConfig } from "../dynamodb";
import { createDefinedUUID } from "../api/helpers/nano-id-helpers";
import { Queues } from "../sqs";
import { SchedulerInvokeRole } from "../iam";

const stage = pulumi.getStack();

export const projectTableStreamCallback = new aws.lambda.CallbackFunction(
  `${stage}-project-table-stream`,
  {
    memorySize: 1024,
    callback: async (event: aws.dynamodb.TableEvent): Promise<void> => {
      const scheduler = new awsSdk.Scheduler();
      const dynamo = new awsSdk.DynamoDB.DocumentClient();

      const promises = event.Records.map(async (record) => {
        const { dynamodb, eventName } = record;

        if (eventName === "REMOVE" || eventName === "INSERT") {
          return;
        }

        if (eventName === "MODIFY") {
          const { NewImage, OldImage } = dynamodb;
          const oldState: Project | undefined = OldImage
            ? (awsSdk.DynamoDB.Converter.unmarshall(OldImage) as Project)
            : undefined;

          const newState: Project | undefined = NewImage
            ? (awsSdk.DynamoDB.Converter.unmarshall(NewImage) as Project)
            : undefined;

          const {
            frequency: oldFrequency,
            id,
            functionCount = 0,
          } = oldState as Project;
          const { frequency: newFrequency, logCollectedCount = 0 } =
            newState as Project;

          const hasFrequencyChanged =
            newFrequency && oldFrequency !== newFrequency;

          const hasAllLogsCollected =
            functionCount > 0 && functionCount === logCollectedCount;

          if (hasAllLogsCollected) {
            const sqs = new awsSdk.SQS();

            await sqs
              .sendMessage({
                QueueUrl: Queues.csvCreationQueue.url.get(),
                MessageBody: JSON.stringify({ projectId: id }),
              })
              .promise();

            await dynamo
              .update({
                TableName: ProjectTable.name.get(),
                Key: { id },
                UpdateExpression: "SET #logCollectedCount = :logCollectedCount",
                ExpressionAttributeNames: {
                  "#logCollectedCount": "logCollectedCount",
                },
                ExpressionAttributeValues: {
                  ":logCollectedCount": 0,
                },
              })
              .promise();
          }

          if (hasFrequencyChanged) {
            // check if event schedule exists already
            const { Item } = await dynamo
              .get({
                TableName: ProjectTenancyConfig.name.get(),
                Key: { id },
              })
              .promise();

            let scheduleName = "";

            if (Item && Item.schedulerArn) {
              // event exists, let's just update
              scheduleName = Item.schedulerName;
            } else {
              scheduleName = `project-${id}-${createDefinedUUID(5)}`;
            }


            const parsedFrequency =
              (newFrequency as number) < 1
                ? Math.floor((newFrequency as number) * 60)
                : (newFrequency as number);

            const params = {
              Name: scheduleName,
              StartDate: new Date(),
              State: "ENABLED",
              ScheduleExpression: `rate(${parsedFrequency} ${
                (newFrequency as number) < 1 ? "minutes" : "hours"
              })`,
              FlexibleTimeWindow: {
                Mode: "FLEXIBLE",
                MaximumWindowInMinutes: 15,
              },
              Target: {
                Arn: Queues.globalScheduleProcessingQueue.arn.get(),
                RoleArn: SchedulerInvokeRole.arn.get(),
                Input: JSON.stringify({ project: newState }),
              },
            };

            const event = !Item
              ? await scheduler.createSchedule(params).promise()
              : await scheduler.updateSchedule(params).promise();

            if (!Item) {
              await dynamo
                .update({
                  TableName: ProjectTenancyConfig.name.get(),
                  Key: { id },
                  UpdateExpression:
                    "SET #schedulerArn = :schedulerArn, #schedulerName = :schedulerName",
                  ExpressionAttributeNames: {
                    "#schedulerArn": "schedulerArn",
                    "#schedulerName": "schedulerName",
                  },
                  ExpressionAttributeValues: {
                    ":schedulerArn": event.ScheduleArn,
                    ":schedulerName": scheduleName,
                  },
                })
                .promise();

              // manually trigger data collectio
              const sqs = new awsSdk.SQS();
              await sqs
                .sendMessage({
                  QueueUrl: Queues.globalScheduleProcessingQueue.url.get(),
                  MessageBody: JSON.stringify({ project: newState }),
                })
                .promise();
            }
          }
        }
      });

      await Promise.all(promises);
    },
  }
);
