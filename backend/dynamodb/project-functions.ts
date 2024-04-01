import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const stage = pulumi.getStack();

export const ProjectFunctions = new aws.dynamodb.Table(
  `${stage}-project-functions`,
  {
    attributes: [
      { name: "id", type: "S" },
      { name: "projectId", type: "S" },
      { name: "name", type: "S" },
    ],
    hashKey: "id",
    rangeKey: "projectId",
    billingMode: "PAY_PER_REQUEST",
    pointInTimeRecovery: { enabled: true },
    tableClass: "STANDARD",
    globalSecondaryIndexes: [
      {
        name: "by-function-name-project",
        hashKey: "name",
        rangeKey: "projectId",
        projectionType: "KEYS_ONLY",
      },
    ],
  }
);
