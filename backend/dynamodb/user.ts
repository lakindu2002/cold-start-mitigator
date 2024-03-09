import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const stage = pulumi.getStack();

export const UserTable = new aws.dynamodb.Table(`${stage}-user-table`, {
  attributes: [{ name: "id", type: "S" }],
  hashKey: "id",
  billingMode: "PAY_PER_REQUEST",
  pointInTimeRecovery: { enabled: true },
  tableClass:'STANDARD',
});
