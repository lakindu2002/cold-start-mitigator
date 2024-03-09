import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const stage = pulumi.getStack();

export const ProjectUserTable = new aws.dynamodb.Table(
  `${stage}-project-user-table`,
  {
    attributes: [
      { name: "userId", type: "S" },
      { name: "projectId", type: "S" },
    ],
    globalSecondaryIndexes: [
      {
        name: "projects-per-user",
        hashKey: "userId",
        rangeKey: "projectId",
        projectionType: "ALL",
      },
    ],
    hashKey: "projectId",
    rangeKey: "userId",
    billingMode: "PAY_PER_REQUEST",
    pointInTimeRecovery: { enabled: true },
    tableClass: "STANDARD",
  }
);
