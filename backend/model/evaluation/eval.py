import json
import tarfile
import joblib
import boto3
import pandas as pd
import numpy as np
from tensorflow.keras import models

# 10 sequences of data will be used to predict the next data point
sequence_length = 10
features_to_scale = [
    "time_since_last_invocation",
    "hour_of_day",
    "day_of_week",
    "initDuration",
    "duration",
    "maxMemoryUsed",
    "memorySize",
]


# Function to create sequences ensuring no boundary overlaps
def create_sequences(data, sequence_length, feature_columns):
    # Initialize empty lists to store sequences and targets
    sequences = []
    targets = []

    # Iterate through each group (function) in the dataset
    for _, group in data.groupby("functionName"):
        # Extract the feature data as a NumPy array
        group_data = group[feature_columns].values
        # Calculate how many sequences can be made
        num_sequences = len(group_data) - sequence_length

        # Create sequences for this group
        for i in range(num_sequences):
            sequence = group_data[i : i + sequence_length]
            sequences.append(sequence)
            targets.append(
                group_data[i + sequence_length][0]
            )  # the target is the first column

    return np.array(sequences), np.array(targets)


def preprocess_data(data, scaler, function_dummies, function_name_to_predict):

    recent_data = data[data["functionName"] == function_name_to_predict].head(
        sequence_length + 50
    )
    recent_data = recent_data.sort_values(by=["lastInvokedAt"], ascending=True)

    recent_data["lastInvokedAt"] = recent_data["lastInvokedAt"].apply(
        lambda x: int(x.split("#")[-1])
    )
    recent_data["lastInvokedDateTime"] = pd.to_datetime(
        recent_data["lastInvokedAt"], unit="ms"
    )

    recent_data["initDuration"].fillna(0, inplace=True)

    recent_data["hour_of_day"] = recent_data["lastInvokedDateTime"].dt.hour
    recent_data["day_of_week"] = recent_data[
        "lastInvokedDateTime"
    ].dt.dayofweek  # Monday=0, Sunday=6
    recent_data["is_weekend"] = recent_data["day_of_week"].apply(
        lambda x: 1 if x >= 5 else 0
    )  # Binary indicator for weekends

    recent_data.drop("cycleLogs", axis=1, inplace=True)
    recent_data.drop("functionArn", axis=1, inplace=True)
    recent_data.drop("projectId", axis=1, inplace=True)
    recent_data.drop("projectIdfunctionName", axis=1, inplace=True)
    recent_data.drop("requestId", axis=1, inplace=True)
    recent_data.drop("streamName", axis=1, inplace=True)
    recent_data.drop("startUpTime", axis=1, inplace=True)
    recent_data.drop("billedDuration", axis=1, inplace=True)
    recent_data.drop("id", axis=1, inplace=True)
    recent_data.drop("lastInvokedAt", axis=1, inplace=True)

    # Group by 'functionName' after sorting and calculate the time differences within each group
    recent_data["time_since_last_invocation"] = (
        recent_data.groupby("functionName")["lastInvokedDateTime"]
        .diff()
        .dt.total_seconds()
    )

    # Fill missing values with backfill within each group
    recent_data["time_since_last_invocation"] = recent_data.groupby("functionName")[
        "time_since_last_invocation"
    ].transform(lambda x: x.fillna(method="bfill"))

    recent_data = recent_data[
        (recent_data["time_since_last_invocation"].isnull())
        | (recent_data["time_since_last_invocation"] >= 60)
    ]

    # Move the 'time_since_last_invocation' column to the second position
    time_since_last_invocation_column = recent_data.pop("time_since_last_invocation")
    recent_data.insert(
        0, "time_since_last_invocation", time_since_last_invocation_column
    )

    recent_data_encoded = pd.concat([recent_data, function_dummies], axis=1)

    recent_data_encoded[features_to_scale] = scaler.fit_transform(
        recent_data_encoded[features_to_scale]
    )

    exclude_columns = [
        "lastInvokedDateTime",
        "functionName",
        "time_since_last_invocation",
    ]
    feature_columns = [
        col for col in recent_data_encoded.columns if col not in exclude_columns
    ]

    x_pred, _y_pred = create_sequences(
        recent_data_encoded, sequence_length, feature_columns
    )

    x_pred = x_pred.astype("float32")

    return x_pred


def handler(event, context):

    project_id = event["projectId"]
    function_name = event["functionName"]

    bucket_path = f"{project_id}/model"
    bucket_name = "hs-dev-model-training-6023493"

    # get all the files in specified bucket path
    s3 = boto3.client("s3")
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix=bucket_path)

    # get the latest model file
    contents = response.get("Contents", [])

    latest_model_file_path = contents[0]["Key"]

    # download the model file
    s3.download_file(bucket_name, latest_model_file_path, "/tmp/model.tar.gz")

    # extract the model file
    with tarfile.open("/tmp/model.tar.gz", "r:gz") as tar:
        tar.extractall("/tmp")

    # extracted files - model.h5, scaler.pkl, function_dummies.pkl
    model = models.load_model("/tmp/model.h5")
    scaler = joblib.load("/tmp/scaler.pkl")
    function_dummies = joblib.load("/tmp/function_dummies.pkl")

    # get all records from dynamodb for the function in the project
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table("hs-dev-project-function-logs-d043fda")

    # query index - by-project-id-function-name-invoked-at (scan index forward = false) -> descending order
    # get the latest 50 records for the function
    response = table.query(
        IndexName="by-project-id-function-name-invoked-at",
        KeyConditionExpression="projectIdfunctionName = :functionName",
        ExpressionAttributeValues={":functionName": f"{project_id}#{function_name}"},
        ScanIndexForward=False,
        Limit=100,
    )
    
    # Sort the data by 'lastInvokedAt' in descending order
    sort_data = sorted(response["Items"], key=lambda x: x["lastInvokedAt"], reverse=True)
    
    data = pd.DataFrame(sort_data)

    x = preprocess_data(data, scaler, function_dummies, function_name)
    
    # predictions are the scaled predictions from  model
    predictions = model.predict(x, batch_size=19)
    # prepare a dummy array with the same shape as the training feature array
    dummy = np.zeros(
        (predictions.shape[0], len(features_to_scale))
    )  # `features_to_scale` is your list of scaled features
    dummy[:, 0] = (
        predictions.ravel()
    )  # 'time_since_last_invocation' is the first column
    real_values = scaler.inverse_transform(dummy)[
        :, 0
    ]  # Inverse transform and select the correct column

    print(real_values)

    return {"statusCode": 200, "body": json.dumps({"data": real_values.tolist()})}
