import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsSdk from "aws-sdk";
import { SQSEvent } from "aws-lambda";
import {
  createPredictionTime,
  toCronExpression,
} from "../utils/create-prediction-time";
import { warmInvocation } from "./warm-invocation";
import { SchedulerInvokeRole } from "../iam";
import { ProjectFunctions } from "../dynamodb";
import { format, subMinutes } from "date-fns";
import { ProjectFunction } from "../types";

const stage = pulumi.getStack();

export const getNextInvocation = new aws.lambda.CallbackFunction(
  `${stage}-get-next-invocation`,
  {
    callback: async (event: SQSEvent) => {
      const recordPromises = event.Records.map(async (record) => {
        const { body } = record;
        const {
          projectId,
          functionId,
          functionArn,
          functionName,
          roleArn,
          externalId,
        } = JSON.parse(body) as {
          projectId: string;
          functionId: string;
          functionName: string;
          roleArn: string;
          externalId: string;
          functionArn: string;
        };

        console.log({ projectId, functionName });

        const invocation = await createPredictionTime(projectId, functionName);

        if (invocation.time < Date.now()) {
          console.log(`Function ${functionName} already invoked`);
          return;
        }

        if (invocation.time === 0) {
          console.log(`No invocation time found for function ${functionName}`);
          return;
        }

        const scheduler = new awsSdk.Scheduler();

        // two minutes less than invocation time
        const scheduleTime = subMinutes(invocation.time, 1);
        const dynamodb = new awsSdk.DynamoDB.DocumentClient();
        const { Item: ProjectFunctionResp } = await dynamodb
          .get({
            TableName: ProjectFunctions.name.get(),
            Key: { id: functionId, projectId },
          })
          .promise();

        const projectFunction = ProjectFunctionResp as ProjectFunction;

        const isScheduleExisting = !!projectFunction.warmerArn;

        const params = {
          FlexibleTimeWindow: {
            Mode: "OFF",
          },
          Name: `${projectId}-${functionName}`,
          ScheduleExpression: toCronExpression(scheduleTime.toISOString()),
          Target: {
            Arn: warmInvocation.arn.get(),
            RoleArn: SchedulerInvokeRole.arn.get(),
            Input: JSON.stringify({
              projectId,
              functionId,
              functionName,
              roleArn,
              externalId,
              functionArn,
            }),
          },
        };

        const { ScheduleArn } = isScheduleExisting
          ? await scheduler.updateSchedule(params).promise()
          : await scheduler.createSchedule(params).promise();

        await dynamodb
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
              ":warmerArn": ScheduleArn,
              ":warmerTime": scheduleTime.toISOString(),
            },
          })
          .promise();
      });

      await Promise.all(recordPromises);
    },
    timeout: 500,
    memorySize: 2048,
  }
);
