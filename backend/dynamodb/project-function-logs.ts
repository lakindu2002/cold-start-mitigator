import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const stage = pulumi.getStack();

export const ProjectFunctionLogs = new aws.dynamodb.Table(
  `${stage}-project-function-logs`,
  {
    attributes: [
      { name: "id", type: "S" },
      { name: "projectId", type: "S" },
      { name: "lastInvokedAt", type: "S" },
      { name: "projectIdfunctionName", type: "S" },
    ],
    hashKey: "id",
    rangeKey: "lastInvokedAt",
    billingMode: "PAY_PER_REQUEST",
    pointInTimeRecovery: { enabled: true },
    tableClass: "STANDARD",
    globalSecondaryIndexes: [
      {
        name: "by-project-id-function-name-invoked-at",
        hashKey: "projectIdfunctionName",
        rangeKey: "lastInvokedAt",
        projectionType: "ALL",
      },
      {
        name: "by-project-id-invoked-at",
        hashKey: "projectId",
        rangeKey: "lastInvokedAt",
        projectionType: "ALL",
      },
    ],
  }
);
