import * as awsSdk from "aws-sdk";

const isRelevantLog = (message: string) => {
  return (
    message.startsWith("INIT_START") ||
    message.startsWith("START RequestId:") ||
    message.startsWith("END RequestId:") ||
    message.startsWith("REPORT RequestId:")
  );
};

export const processLogMessageBasedOnType = (
  logMessage: string,
  type: string
) => {
  switch (type) {
    case "INIT_START": {
      // Extract: Runtime Version, Runtime Version ARN
      const runtimeVersion = logMessage
        .split("Runtime Version: ")[1]
        .split("\t")[0];
      const runtimeVersionArn = logMessage
        .split("Runtime Version ARN: ")[1]
        .split("\n")[0];
      return { runtimeVersion, runtimeVersionArn };
    }
    case "START": {
      //  message: 'START RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4 Version: $LATEST\n',
      // Extract: RequestId, Version
      const requestId = logMessage.split("RequestId: ")[1].split(" ")[0];
      const version = logMessage.split("Version: ")[1].split("\n")[0];
      return { requestId, version };
    }
    case "END": {
      // message: 'END RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4\n',
      // Extract: RequestId
      const requestId = logMessage.split("RequestId: ")[1].split("\n")[0];
      return { requestId };
    }
    case "REPORT": {
      // message: 'REPORT RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4\tDuration: 5.56 ms\tBilled Duration: 6 ms\tMemory Size: 512 MB\tMax Memory Used: 58 MB\tInit Duration: 144.10 ms\t\n',
      // Extract: RequestId, Duration, Billed Duration, Memory Size, Max Memory Used, Init Duration
      const requestId = logMessage.split("RequestId: ")[1].split("\t")[0];

      const duration = Number(
        logMessage.split("Duration: ")[1].split(" ms")[0]
      );
      const billedDuration = Number(
        logMessage.split("Billed Duration: ")[1].split(" ms")[0]
      );
      const memorySize = Number(
        logMessage.split("Memory Size: ")[1].split(" MB")[0]
      );
      const maxMemoryUsed = Number(
        logMessage.split("Max Memory Used: ")[1].split(" MB")[0]
      );
      const doesInitDurationExist = logMessage.includes("Init Duration: ");
      let initDuration: number | undefined = undefined;
      if (doesInitDurationExist) {
        initDuration = Number(
          logMessage.split("Init Duration: ")?.[1].split(" ms")?.[0]
        );
      }

      return {
        requestId,
        duration,
        billedDuration,
        memorySize,
        maxMemoryUsed,
        ...(initDuration && { initDuration }),
      };
    }
    default:
      return null;
  }
};

export const getReportInformation = (
  logs: awsSdk.CloudWatchLogs.FilteredLogEvent[]
) => {
  const reportLogs = logs.filter((log) => log.message?.startsWith("REPORT"));
  const report = reportLogs[0];

  const information = processLogMessageBasedOnType(
    report.message as string,
    "REPORT"
  );
  return information;
};

export const groupLogs = (logs: awsSdk.CloudWatchLogs.FilteredLogEvent[]) => {
  const groupedLogs: awsSdk.CloudWatchLogs.FilteredLogEvent[][] = [];
  for (let i = 0; i < logs.length; i++) {
    const currentLog = logs[i];
    if (currentLog?.message?.startsWith("INIT_START")) {
      // Check the next three logs to ensure they are START, END, REPORT
      if (
        i + 3 < logs.length &&
        logs[i + 1].message?.startsWith("START") &&
        logs[i + 2].message?.startsWith("END") &&
        logs[i + 3].message?.startsWith("REPORT")
      ) {
        groupedLogs.push([currentLog, logs[i + 1], logs[i + 2], logs[i + 3]]);
        i += 3; // Skip the next three logs as they are already grouped
      }
    } else if (currentLog.message?.startsWith("START")) {
      // Check the next two logs to ensure they are END, REPORT
      if (
        i + 2 < logs.length &&
        logs[i + 1].message?.startsWith("END") &&
        logs[i + 2].message?.startsWith("REPORT")
      ) {
        groupedLogs.push([currentLog, logs[i + 1], logs[i + 2]]);
        i += 2; // Skip the next two logs as they are already grouped
      }
    }
  }
  return groupedLogs;
};

export const filterLogsExludingAppLogs = (
  logs: awsSdk.CloudWatchLogs.FilteredLogEvent[]
) => logs.filter((log) => isRelevantLog(log.message as string));
