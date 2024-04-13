import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsSdk from "aws-sdk";
import { Project } from "../types";
import { ProjectTenancyConfig } from "../dynamodb";
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

        if (eventName === "INSERT" || eventName === "REMOVE") {
          return;
        }

        const { NewImage, OldImage } = dynamodb;
        const oldState: Project | undefined = OldImage
          ? (awsSdk.DynamoDB.Converter.unmarshall(OldImage) as Project)
          : undefined;

        const newState: Project | undefined = NewImage
          ? (awsSdk.DynamoDB.Converter.unmarshall(NewImage) as Project)
          : undefined;

        const { frequency: oldFrequency, id } = oldState as Project;
        const { frequency: newFrequency } = newState as Project;

        if (!newFrequency || newFrequency === oldFrequency) {
          return;
        }

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

        const params = {
          Name: scheduleName,
          StartDate: new Date(),
          State: "ENABLED",
          ScheduleExpression: `rate(${newFrequency} hours)`,
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
        }
      });

      await Promise.all(promises);
    },
  }
);