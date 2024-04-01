import * as awsSdk from "aws-sdk";

const isInitStart = (message: string): boolean =>
  message.includes("INIT_START");

// Function to create a unique identifier for each cycle
const createCycleKey = (log: awsSdk.CloudWatchLogs.FilteredLogEvent): string =>
  `${log.logStreamName}_${log.timestamp}`;

const isRelevantLog = (message: string) => {
  return (
    message.includes("INIT_START") ||
    message.includes("START RequestId:") ||
    message.includes("END RequestId:") ||
    message.includes("REPORT RequestId:")
  );
};

const addLastRequestAtKey = (logs: {
  [key: string]: {
    startupTime: number;
    logsForThatCycle: awsSdk.CloudWatchLogs.FilteredLogEvent[];
    lastInvoked?: number;
  };
}) => {
  const duplicateLogs = { ...logs };
  Object.entries(logs).forEach(([key, value]) => {
    const largestTimestampLog = Math.max(
      ...value.logsForThatCycle
        .filter(
          (log) =>
            (log.message as string).startsWith("START") ||
            (log.message as string).startsWith("INIT_START")
        )
        .map((log) => log.timestamp as number)
    );
    duplicateLogs[key] = {
      ...value,
      lastInvoked: largestTimestampLog,
    };
  });
  return duplicateLogs;
};

export const groupLogsThroughInitPeriod = (
  logs: awsSdk.CloudWatchLogs.FilteredLogEvent[]
) => {
  const cycles: {
    [key: string]: {
      startupTime: number;
      logsForThatCycle: awsSdk.CloudWatchLogs.FilteredLogEvent[];
    };
  } = {};
  let currentCycleKey: string | undefined = undefined;

  logs.forEach((log) => {
    // Check if the log is an INIT_START event to start a new cycle
    if (isInitStart(log.message as string)) {
      currentCycleKey = createCycleKey(log);
      if (!cycles[currentCycleKey]) {
        cycles[currentCycleKey] = {
          startupTime: log.timestamp as number,
          logsForThatCycle: [],
        };
      }
    }

    if (isRelevantLog(log.message as string) && currentCycleKey) {
      // Add the log to the current cycle
      cycles[currentCycleKey].logsForThatCycle.push(log);
    }
  });

  return addLastRequestAtKey(cycles);
};
