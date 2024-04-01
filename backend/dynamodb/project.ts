import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { projectTableStreamCallback } from "../streams/callback";

const stage = pulumi.getStack();

export const ProjectTable = new aws.dynamodb.Table(`${stage}-project-table`, {
  attributes: [{ name: "id", type: "S" }],
  hashKey: "id",
  billingMode: "PAY_PER_REQUEST",
  pointInTimeRecovery: { enabled: true },
  tableClass: "STANDARD",
  streamEnabled: true,
  streamViewType: "NEW_AND_OLD_IMAGES",
});

ProjectTable.onEvent("ProjectTableStream", projectTableStreamCallback, {
  batchSize: 1,
  startingPosition: "LATEST",
});
