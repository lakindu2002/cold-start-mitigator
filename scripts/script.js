const AWS = require('aws-sdk');
const fs = require('fs');
const { maxBy } = require('lodash');
const { format } = require('date-fns');

const isRelevantLog = (message) => {
    return message.includes('INIT_START') || message.includes('START RequestId:') || message.includes('END RequestId:') || message.includes('REPORT RequestId:');
};

// Function to determine if a log entry is an INIT_START event
const isInitStart = (message) => message.includes('INIT_START');

// Function to create a unique identifier for each cycle
const createCycleKey = (log) => `${log.logStreamName}_${log.timestamp}`;

// Grouping logs including INIT_START
const groupLogsIncludingInitStart = (logs) => {
    const cycles = {};
    let currentCycleKey = null;

    logs.forEach(log => {
        // Check if the log is an INIT_START event to start a new cycle
        if (isInitStart(log.message)) {
            currentCycleKey = createCycleKey(log);
            if (!cycles[currentCycleKey]) {
                cycles[currentCycleKey] = { startupTime: log.timestamp, logsForThatCycle: [] };
            }
        }

        if (isRelevantLog(log.message) && currentCycleKey) {
            // Add the log to the current cycle
            cycles[currentCycleKey].logsForThatCycle.push(log);
        }
    });

    return cycles;
};

// Utility function to add "lastRequestAt" key with the last timestamp
function addLastRequestAtKey(logs) {
    const duplicateLogs = { ...logs };
    Object.entries(logs).forEach(([key, value]) => {
        const largestTimestampLog = Math.max(...value.logsForThatCycle.filter((log) => log.message.startsWith('START')).map(log => log.timestamp));
        duplicateLogs[key] = {
            ...value,
            lastInvoked: largestTimestampLog
        }
    })
    return duplicateLogs;
}

async function getAllLambdaLogs() {
    // Create CloudWatchLogs client with temporary credentials and region
    const cloudWatchLogs = new AWS.CloudWatchLogs({ region: 'us-east-1' });

    const logGroupName = `/aws/lambda/hs-dev-collect-aws-data-dd77035`;

    const logs = await cloudWatchLogs.filterLogEvents({
        logGroupName,
        startTime: new Date() - 60 * 60 * 1000, // Fetch logs for the last 1 hour
    }).promise();
    const groupedLogs = addLastRequestAtKey(groupLogsIncludingInitStart(logs.events));
    const json = JSON.stringify(groupedLogs);

    fs.writeFileSync('export.json', json)
}


// Call the function
// getAllLambdaLogs();

const scanDynamoDbTable = async (tableName) => {
    const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

    const params = {
        TableName: tableName,
        Limit: 1,
        ScanIndexForward: false,
    };

    const data = await dynamodb.scan(params).promise();
    return data.Items;
};

const processLogMessageBasedOnType = (logMessage, type) => {
    switch (type) {
        case 'INIT_START': {
            // message: 'INIT_START Runtime Version: nodejs:16.v32\tRuntime Version ARN: arn:aws:lambda:us-east-1::runtime:4e246d1debfc59ff89a11f72d8d5e9b36dad2bdc84b41b34734298b703ddf614\n',
            // Extract: Runtime Version, Runtime Version ARN
            const runtimeVersion = logMessage.split('Runtime Version: ')[1].split('\t')[0];
            const runtimeVersionArn = logMessage.split('Runtime Version ARN: ')[1].split('\n')[0];
            return { runtimeVersion, runtimeVersionArn };
        }
        case 'START': {
            //  message: 'START RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4 Version: $LATEST\n',
            // Extract: RequestId, Version
            const requestId = logMessage.split('RequestId: ')[1].split(' ')[0];
            const version = logMessage.split('Version: ')[1].split('\n')[0];
            return { requestId, version };
        }
        case 'END': {
            // message: 'END RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4\n',
            // Extract: RequestId
            const requestId = logMessage.split('RequestId: ')[1].split('\n')[0];
            return { requestId };
        }
        case 'REPORT': {
            // message: 'REPORT RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4\tDuration: 5.56 ms\tBilled Duration: 6 ms\tMemory Size: 512 MB\tMax Memory Used: 58 MB\tInit Duration: 144.10 ms\t\n',
            // Extract: RequestId, Duration, Billed Duration, Memory Size, Max Memory Used, Init Duration
            const requestId = logMessage.split('RequestId: ')[1].split('\t')[0];
            const duration = logMessage.split('Duration: ')[1].split(' ms')[0];
            const billedDuration = logMessage.split('Billed Duration: ')[1].split(' ms')[0];
            const memorySize = logMessage.split('Memory Size: ')[1].split(' MB')[0];
            const maxMemoryUsed = logMessage.split('Max Memory Used: ')[1].split(' MB')[0];
            const initDuration = logMessage.split('Init Duration: ')[1].split(' ms')[0];
            return { requestId, duration, billedDuration, memorySize, maxMemoryUsed, initDuration };

            break;
        }
        default:
            return null;
    }
};

const getLogs = async () => {
    const logs = await scanDynamoDbTable('hs-dev-project-function-logs-d043fda');
    console.log(logs[0]);
    // OUTPUT:
    // {
    //     log: {
    //       eventId: '38169784535955612374196236457040275359363469384663695360',
    //       message: 'INIT_START Runtime Version: nodejs:16.v32\tRuntime Version ARN: arn:aws:lambda:us-east-1::runtime:4e246d1debfc59ff89a11f72d8d5e9b36dad2bdc84b41b34734298b703ddf614\n',
    //       ingestionTime: 1711592339080,
    //       logStreamName: '2024/03/28/[$LATEST]31cd56bb526a40dd955611cee4836e60',
    //       timestamp: 1711592334523
    //     }
    //   }
    //   {
    //     log: {
    //       eventId: '38169784539189220427983176812562954508897481803030855681',
    //       message: 'START RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4 Version: $LATEST\n',
    //       ingestionTime: 1711592339080,
    //       logStreamName: '2024/03/28/[$LATEST]31cd56bb526a40dd955611cee4836e60',
    //       timestamp: 1711592334668
    //     }
    //   }
    //   {
    //     log: {
    //       eventId: '38169784539323024899174360551412168818533371972066738179',
    //       message: 'END RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4\n',
    //       ingestionTime: 1711592339080,
    //       logStreamName: '2024/03/28/[$LATEST]31cd56bb526a40dd955611cee4836e60',
    //       timestamp: 1711592334674
    //     }
    //   }
    //   {
    //     log: {
    //       eventId: '38169784539323024899174360551412168818533371972066738180',
    //       message: 'REPORT RequestId: 2e6604d2-865c-44c3-a1d1-38589d54ffc4\tDuration: 5.56 ms\tBilled Duration: 6 ms\tMemory Size: 512 MB\tMax Memory Used: 58 MB\tInit Duration: 144.10 ms\t\n',
    //       ingestionTime: 1711592339080,
    //       logStreamName: '2024/03/28/[$LATEST]31cd56bb526a40dd955611cee4836e60',
    //       timestamp: 1711592334674
    //     }
    //   }
    const logsWithRequestId = logs[0].cycleLogs.map((log) => {
        // INIT START is always the first log in the cycle
        // COLD START LOG IS ALWAYS THE FIRST LOG IN THE CYCLE

        // Every request log is a triplet of START, END, REPORT
        // Report has message that has useful information like duration, billed duration, memory size, max memory used, init duration
        // If init duration is not present in the report, it means that the function was not cold started

        // introduce new key RequestId in the cycleLogs object

        // get message type
        const messageType = log.message.split(' ')[0];
        const requestId = processLogMessageBasedOnType(log.message, messageType);
        console.log({ requestId, messageType });
        // const requestId = log.message.split('RequestId:')[1].split(' ')[0];
        // console.log(requestId);
    })
};

// getLogs();
const getLambdaFunctionsStartingWithHsDevAndLogs = async () => {
    // Get logs for each lambda function using cloudwatch logs
    const cloudWatchLogs = new AWS.CloudWatchLogs({ region: 'us-east-1' });
    // loop async through each function
    const logGroupName = `/aws/lambda/hs-dev-health-57a9989`;
    // collect all logs for the function using token
    let nextToken = undefined;
    let logs = [];
    try {
        do {
            const params = {
                logGroupName,
                nextToken,
            };
            const data = await cloudWatchLogs.filterLogEvents(params).promise();
            logs = [...logs, ...data.events];
            nextToken = data.nextToken;
        } while (nextToken);
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.log(`No logs found for function hs-dev-health-57a9989`);
            return;
        }
        throw error;
    }
    console.log(`Logs for function hs-dev-health-57a9989: ${logs.length} logs`);

    const groupedLogs = [];
    for (let i = 0; i < logs.length; i++) {
        const currentLog = logs[i];
        if (currentLog.message.startsWith('INIT_START')) {
            // Check the next three logs to ensure they are START, END, REPORT
            if (i + 3 < logs.length &&
                logs[i + 1].message.startsWith('START') &&
                logs[i + 2].message.startsWith('END') &&
                logs[i + 3].message.startsWith('REPORT')) {
                groupedLogs.push([currentLog, logs[i + 1], logs[i + 2], logs[i + 3]]);
                i += 3;  // Skip the next three logs as they are already grouped
            }
        } else if (currentLog.message.startsWith('START')) {
            // Check the next two logs to ensure they are END, REPORT
            if (i + 2 < logs.length &&
                logs[i + 1].message.startsWith('END') &&
                logs[i + 2].message.startsWith('REPORT')) {
                groupedLogs.push([currentLog, logs[i + 1], logs[i + 2]]);
                i += 2;  // Skip the next two logs as they are already grouped
            }
        }
    }

    console.log(groupedLogs);
};

// getLambdaFunctionsStartingWithHsDevAndLogs();

const createTrainingJob = () => {
    const sagemaker = new AWS.SageMaker({ region: 'us-east-1' });

    sagemaker.createTrainingJob({
        TrainingJobName: 'NodeJS-SageMaker-Job-' + Date.now(), // Ensure unique name
        AlgorithmSpecification: {
            TrainingImage: '763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-training:2.3.0-cpu-py37-ubuntu18.04',
            TrainingInputMode: 'File',
        },
        RoleArn: 'arn:aws:iam::932055394976:role/service-role/AmazonSageMaker-ExecutionRole-20230501T203158',
        InputDataConfig: [{
            ChannelName: 'train',
            DataSource: {
                S3DataSource: {
                    S3DataType: 'S3Prefix',
                    S3Uri: `s3://hs-dev-model-training-6023493/cswgg07mwj/`,
                    S3DataDistributionType: 'FullyReplicated'
                }
            }
        }],
        OutputDataConfig: {
            S3OutputPath: `s3://hs-dev-model-training-6023493/models/cswgg07mwj/`
        },
        ResourceConfig: {
            InstanceCount: 1,
            InstanceType: 'ml.m5.large',
            VolumeSizeInGB: 10
        },
        StoppingCondition: {
            MaxRuntimeInSeconds: 86400
        }
    }, (err, data) => {
        if (err) console.log(err, err.stack);
        else console.log(data);
    });
}


const getTrainingJobStatus = () => {
    const sagemaker = new AWS.SageMaker({ region: 'us-east-1' });

    const describeTrainingJobParams = {
        TrainingJobName: 'NodeJS-SageMaker-Job-1713205562217-copy-04-16'
    };

    sagemaker.describeTrainingJob(describeTrainingJobParams, (err, data) => {
        if (err) console.log(err, err.stack);
        else console.log(data);
    });
}

// createTrainingJob();
// getTrainingJobStatus();

const toCronExpression = (date) => {
    const [year, month, day, hours, minutes, seconds] = date.split(/[-T:]/);
    return `cron(${minutes} ${hours} ${day} ${month} ? ${year})`;
};

const createSchedule = async () => {
    const scheduler = new AWS.Scheduler({ region: "us-east-1" });

    // 5 minutes from now 
    const startTime = new Date(Date.now() + 5 * 60 * 1000);
    await scheduler
        .createSchedule({
            FlexibleTimeWindow: {
                Mode: "OFF",
            },
            Name: `123-123123`,
            ScheduleExpression: toCronExpression(startTime.toISOString()),
            Target: {
                Arn: 'arn:aws:lambda:us-east-1:932055394976:function:hs-dev-collect-aws-data-dd77035',
                RoleArn: 'arn:aws:iam::932055394976:role/hs-dev-scheduler-invoke-role-7c59807',
                Input: JSON.stringify({}),
            },
        })
        .promise();
}

createSchedule();