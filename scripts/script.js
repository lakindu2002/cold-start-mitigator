const AWS = require('aws-sdk');

async function getAllLambdaLogs() {
    const sts = new AWS.STS();
    const roleName = 'Sample-HeatShieldIntegrationRole-rlXuDtxuD25i'; // Replace with your role name
    const externalId = 'Sample'; // Replace with your external ID

    // Assume role
    const assumeRoleParams = {
        RoleArn: `arn:aws:iam::932055394976:role/${roleName}`,
        RoleSessionName: 'YourSessionName',
        ExternalId: externalId,
    };

    try {
        const assumeRoleResponse = await sts.assumeRole(assumeRoleParams).promise();

        AWS.config.update({
            credentials: {
                accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
                secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
                sessionToken: assumeRoleResponse.Credentials.SessionToken
            },
            region: 'us-east-1', // Replace with your preferred region
        });

        // Create Lambda client with temporary credentials and region
        const lambda = new AWS.Lambda();

        // List all regions
        const ec2 = new AWS.EC2();
        const regions = await ec2.describeRegions().promise();
        const regionNames = regions.Regions.map(region => region.RegionName);

        const functions = await lambda.listFunctions().promise();

        // Fetch CloudWatch logs for each Lambda function in each region
        for (const region of regionNames) {
            try {
                const regionScopedFunctions = functions.Functions.filter((lambdaFunction) => lambdaFunction.FunctionArn.includes(region));
                console.log(regionScopedFunctions.length);

                // Create CloudWatchLogs client with temporary credentials and region
                const cloudWatchLogs = new AWS.CloudWatchLogs({
                    credentials: {
                        accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
                        secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
                        sessionToken: assumeRoleResponse.Credentials.SessionToken
                    },
                    region: region,
                });

                for (const lambdaFunction of regionScopedFunctions) {
                    const logGroupName = `/aws/lambda/${lambdaFunction.FunctionName}`;

                    const logs = await cloudWatchLogs.filterLogEvents({
                        logGroupName,
                        startTime: new Date() - 60 * 60 * 1000, // Fetch logs for the last 1 hour
                    }).promise();

                    console.log(`Logs for Lambda function ${lambdaFunction.FunctionName} in region ${region}:`);
                    console.log(logs.events);
                }
            } catch (listFunctionsError) {
                console.error('Error listing functions:', listFunctionsError);
            }
        }

    } catch (err) {
        console.error('Error assuming role or fetching logs:', err);
    }
}

// Call the function
getAllLambdaLogs();
