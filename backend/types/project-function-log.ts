import * as awsSdk from "aws-sdk";

export interface ProjectFunctionLog {
  id: string;
  lastInvokedAt: string;
  cycleLogs: awsSdk.CloudWatchLogs.FilteredLogEvent[];
  startUpTime: number;
  functionName: string;
  runtime: string;
  functionArn: string;
  projectId: string;
  streamName: string;
  isCold: boolean;
  projectIdfunctionName: string;
}
