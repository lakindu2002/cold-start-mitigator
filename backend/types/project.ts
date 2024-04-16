export interface Project {
  id: string;
  externalId: string;
  customerId: string;
  roleArn: string;
  createdAt: number;
  updatedAt: number;
  name: string;

  /**
   * the lambda function patterns to get logs for
   */
  patterns?: string[];

  /**
   * the time in hours that will be used to collect logs from
   */
  frequency?: number;

  /**
   * the aws region to collect logs from
   */
  region?: string;

  /**
   * show the functions collected
   */
  functionCount?: number;

  /**
   * the number of functions logs have been collected for.
   */
  logCollectedCount?: number;
}
