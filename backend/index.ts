import {
  modelTrainingBucket,
  publicBucket,
  roleCreationCloudFormationStackObjectUrl,
} from "./s3";
import { api } from "./api";
import {
  ProjectTable,
  ProjectUserTable,
  UserTable,
  ProjectTenancyConfig,
  ProjectFunctions,
} from "./dynamodb";
import { output } from "./cognito";
import { Queues } from "./sqs";
import { collectAwsData, logCollectionLambda, createCsvData } from "./triggers";

Queues.globalScheduleProcessingQueue.onEvent("onPush", collectAwsData, {
  batchSize: 1,
});

Queues.logCollectionQueue.onEvent("onLogCollectPush", logCollectionLambda, {
  batchSize: 1,
});

Queues.csvCreationQueue.onEvent("onCsvCreateToS3", createCsvData, {
  batchSize: 1,
});

export const bucketName = publicBucket.bucket;
export const objectUrl = roleCreationCloudFormationStackObjectUrl;
export const apiUrl = api.url;
export const projectTable = ProjectTable.name;
export const projectUserTable = ProjectUserTable.name;
export const userTable = UserTable.name;
export const projectTenancyConfigTable = ProjectTenancyConfig.name;
export const userPoolId = output.userPoolId;
export const userPoolClientId = output.userPoolClientId;
export const identityPoolId = output.identityPoolId;
export const userPoolName = output.userPoolName;
export const userPoolArn = output.userPoolArn;
export const projectFunctionsTable = ProjectFunctions.name;
export const trainingBucketName = modelTrainingBucket.bucket;
