const AWS = require('aws-sdk');
const fs = require('fs');
const { maxBy } = require('lodash');

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
getAllLambdaLogs();
