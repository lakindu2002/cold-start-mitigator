import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const stage = pulumi.getStack();
export const SchedulerInvokeRole = new aws.iam.Role(
  `${stage}-scheduler-invoke-role`,
  {
    assumeRolePolicy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: {
            Service: "scheduler.amazonaws.com",
          },
          Action: "sts:AssumeRole",
        },
      ],
    }),
    inlinePolicies: [
      {
        name: "InlinePolicySet",
        policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "allowLambdaInvoke",
              Effect: "Allow",
              Action: "lambda:InvokeFunction",
              Resource: "*",
            },
            {
              Sid: "allowSqsSendMessage",
              Effect: "Allow",
              Action: "sqs:SendMessage",
              Resource: "*",
            },
          ],
        }),
      },
    ],
  }
);
