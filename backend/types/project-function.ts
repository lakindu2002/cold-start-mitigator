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

  /**
   * Filled only for the query, Otherwise omit it.
   */
  lastInvokedAt?: number;

  /**
   * Filled only for the query, Otherwise omit it.
   */
  wasCold?: boolean;

  /**
   * Filled from scheduler when the function is scheduled to be warmed
   */
  warmerArn?: string;

  /**
   * Filled from scheduler when the function is scheduled to be warmed
   */
  warmerTime?: string;

  /**
   * Filled from scheduler when the function has been warmed
   */
  warmedAt?: number;
}
