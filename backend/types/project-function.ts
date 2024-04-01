import * as awsSdk from "aws-sdk";

export interface ProjectFunction {
  name: string;
  arn: string;
  codeSize: number;
  architectureList: awsSdk.Lambda.ArchitecturesList;
  ephemeralStorageSize: number;
  functionUpdatedAt: string;
  memorySize: number;
  runtime: string;
  timeout: number;
  createdAt: number;
  updatedAt: number;
  id: string;
  projectId: string;
}
