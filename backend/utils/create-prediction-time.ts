import { predictNextInvocation } from "../api/projects";
import * as awsSdk from "aws-sdk";
import { ProjectFunctionLogs } from "../dynamodb";
import { ProjectFunctionLog } from "../types";
import { addSeconds } from "date-fns";

export const createPredictionTime = async (
  projectId: string,
  functionName: string
) => {
  const lambda = new awsSdk.Lambda();
  const resp = await lambda
    .invoke({
      FunctionName: predictNextInvocation.arn.get(),
      Payload: JSON.stringify({ projectId, functionName }),
    })
    .promise();

  const payload = JSON.parse(resp.Payload as string);

  let invocation: { time: number; functionName: string } = {
    time: 0,
    functionName,
  };

  console.log({ payload });

  if (
    payload.stackTrace &&
    payload.stackTrace?.[0]?.includes(
      'latest_model_file_path = contents[0]["Key"]'
    )
  ) {
    console.log("Model file not found and is in training");
    return { time: 0, functionName, message: "Model is in training" };
  }

  if (payload.statusCode && payload.statusCode === 200) {
    const body = JSON.parse(payload.body);
    const timestamps = (body.data || []) as number[];
    const lowestTimeStamp = timestamps.filter(
      (eachTimestamp: number) => eachTimestamp > 0
    )[0];

    invocation = { time: lowestTimeStamp, functionName };

    const dynamo = new awsSdk.DynamoDB.DocumentClient();
    const { Items = [] } = await dynamo
      .query({
        TableName: ProjectFunctionLogs.name.get(),
        IndexName: "by-project-id-function-name-invoked-at",
        KeyConditionExpression:
          "projectIdfunctionName = :projectIdfunctionName",
        ExpressionAttributeValues: {
          ":projectIdfunctionName": `${projectId}#${functionName}`,
        },
        Limit: 1,
        ScanIndexForward: false,
      })
      .promise();

    const resp = Items[0] as ProjectFunctionLog;
    if (!resp) {
      return { time: 0, functionName };
    }
    const { lastInvokedAt } = resp;
    const timestamp = Number(lastInvokedAt.split("#")[1]);

    const nextInvocationTime = addSeconds(timestamp, lowestTimeStamp);

    if (nextInvocationTime < new Date()) {
      console.log("Next invocation time is in the past");
      return { time: nextInvocationTime.getTime(), functionName };
    }
    return { time: nextInvocationTime.getTime(), functionName };
  } else {
    return { time: 0, functionName };
  }
};

export const toCronExpression = (isoString: string) => {
  const [year, month, day, hours, minutes, seconds] = isoString.split(/[-T:]/);
  return `cron(${minutes} ${hours} ${day} ${month} ? ${year})`;
};
