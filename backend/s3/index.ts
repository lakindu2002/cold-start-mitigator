import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "fs";

const stage = pulumi.getStack();

export const publicBucket = new aws.s3.Bucket(`${stage}-heat-shield-public`, {
  acl: "private",
});

export const modelTrainingBucket = new aws.s3.Bucket(`${stage}-model-training`, {
  acl: "private",
});

// insert template.json to the public bucket
const fileContent = fs.readFileSync("./template.json", "utf-8");
const roleCreationCloudFormationStackObject = new aws.s3.BucketObject(
  "template.json",
  {
    bucket: publicBucket,
    key: "template.json",
    contentType: "application/json",
    content: fileContent,
  }
);

export const roleCreationCloudFormationStackObjectUrl = pulumi.interpolate`https://${publicBucket.bucketDomainName}/${roleCreationCloudFormationStackObject.key}`;

// allow public read access - update this in console
// new aws.s3.BucketPolicy(`${stage}-bucket-policy`, {
//   bucket: publicBucket.id,
//   policy: pulumi.all([publicBucket.arn]).apply(([bucketArn]) =>
//     JSON.stringify({
//       Version: "2012-10-17",
//       Statement: [
//         {
//           Effect: "Allow",
//           Principal: "*",
//           Action: ["s3:GetObject"],
//           Resource: `${bucketArn}/*`,
//         },
//       ],
//     })
//   ),
// });
