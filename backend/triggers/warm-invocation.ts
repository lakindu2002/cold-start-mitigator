import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsSdk from "aws-sdk";
import { integrateWithRole } from "../utils/integrate-with-role";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { ProjectFunctions } from "../dynamodb";

const stage = pulumi.getStack();

export const warmInvocation = new aws.lambda.CallbackFunction(
  `${stage}-warm-invocation`,
  {
    callback: async (event) => {
      console.log(event);
      const {
        externalId,
        roleArn,
        region,
        functionArn,
        functionId,
        projectId,
        functionName,
      } = event as {
        projectId: string;
        functionId: string;
        functionName: string;
        roleArn: string;
        externalId: string;
        functionArn: string;
        region: string;
      };

      const resp = await integrateWithRole(roleArn, externalId);
      if (!resp) {
        console.log("Failed to integrate with role");
        return;
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

      // provision 2
      await Promise.all([
        lambda
          .invoke({
            FunctionName: functionArn,
          })
          .promise(),
        lambda
          .invoke({
            FunctionName: functionArn,
          })
          .promise(),
      ]);

      const dynamo = new awsSdk.DynamoDB.DocumentClient();
      await dynamo
        .update({
          TableName: ProjectFunctions.name.get(),
          Key: { id: functionId, projectId },
          UpdateExpression:
            "REMOVE #warmerArn, #warmerTime SET #warmedAt = :warmedAt",
          ExpressionAttributeNames: {
            "#warmerArn": "warmerArn",
            "#warmerTime": "warmerTime",
            "#warmedAt": "warmedAt",
          },
          ExpressionAttributeValues: {
            ":warmedAt": Date.now(),
          },
        })
        .promise();

      const scheduler = new awsSdk.Scheduler();
      await scheduler
        .deleteSchedule({
          Name: `${projectId}-${functionName}`,
        })
        .promise();
    },
    memorySize: 2048,
    timeout: 30,
    role: new aws.iam.Role(`${stage}-warm-invocation-role`, {
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
                Action: [
                  "sts:AssumeRole",
                  "lambda:InvokeFunction",
                  "lambda:InvokeAsync",
                  "lambda:Invoke",
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
