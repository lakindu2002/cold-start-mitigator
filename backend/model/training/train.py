import joblib
import pandas as pd
import numpy as np
import argparse
import os
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from tensorflow.keras.regularizers import l2
from tensorflow.keras.losses import Huber
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


prefix = '/opt/ml/'
input_path = os.path.join(prefix, 'input/data')
output_path = os.path.join(prefix, 'output')
model_path = os.path.join(prefix, 'model')
param_path = os.path.join(prefix, 'input/config/hyperparameters.json')

channel_name = 'train'
channel_path = os.path.join(input_path, channel_name)


def save_artifacts(model, scaler, function_dummies):
    # Save the Keras model as an HDF5 file
    model.save(os.path.join(model_path, 'model.h5'))

    # Save the Scaler object as a pickle file
    joblib.dump(scaler, os.path.join(model_path, 'scaler.pkl'))

    # Save the one-hot encoded function dummies as a pickle file
    joblib.dump(function_dummies, os.path.join(model_path, 'function_dummies.pkl'))

def parse_arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument('--projectId', type=int, default='')
    return parser.parse_args()

def load_data():
    data_path = os.path.join(channel_path, 'train_data.csv')

    # Load the data into a pandas DataFrame
    data = pd.read_csv(data_path)
    return data

# 10 sequences of data will be used to predict the next data point
sequence_length = 10

# Function to create sequences ensuring no boundary overlaps
def create_sequences(data, sequence_length, feature_columns):
    # Initialize empty lists to store sequences and targets
    sequences = []
    targets = []

    # Iterate through each group (function) in the dataset
    for _, group in data.groupby('functionName'):
        # Extract the feature data as a NumPy array
        group_data = group[feature_columns].values
        # Calculate how many sequences can be made
        num_sequences = len(group_data) - sequence_length

        # Create sequences for this group
        for i in range(num_sequences):
            sequence = group_data[i:i+sequence_length]
            sequences.append(sequence)
            targets.append(group_data[i + sequence_length][0])  # the target is the first column

    return np.array(sequences), np.array(targets)

def preprocess_data(data):
    # Extract the timestamp (milliseconds)
    data['lastInvokedAt'] = data['lastInvokedAt'].apply(lambda x: int(x.split('#')[-1]))

    # Convert to datetime format
    data['lastInvokedDateTime'] = pd.to_datetime(data['lastInvokedAt'], unit='ms')
    
    # Handling missing values in 'initDuration'
    data['initDuration'].fillna(0, inplace=True)

    # Feature Engineering
    data['hour_of_day'] = data['lastInvokedDateTime'].dt.hour
    data['day_of_week'] = data['lastInvokedDateTime'].dt.dayofweek  # Monday=0, Sunday=6
    data['is_weekend'] = data['day_of_week'].apply(lambda x: 1 if x >= 5 else 0)  # Binary indicator for weekends

    # drop unnecessary columns
    data.drop('cycleLogs', axis=1, inplace=True)
    data.drop('functionArn', axis=1, inplace=True)
    data.drop('projectId', axis=1, inplace=True)
    data.drop('projectIdfunctionName', axis=1, inplace=True)
    data.drop('requestId', axis=1, inplace=True)
    data.drop('streamName', axis=1, inplace=True)
    data.drop('startUpTime', axis=1, inplace=True)
    data.drop('billedDuration',axis=1, inplace=True)
    data.drop('id',axis=1, inplace=True)
    data.drop('lastInvokedAt',axis=1, inplace=True)

    # Sort the data by 'functionName' and 'lastInvokedDateTime' to ensure correct order
    data = data.sort_values(by=['functionName', 'lastInvokedDateTime'])

    # Group by 'functionName' after sorting and calculate the time differences within each group
    data['time_since_last_invocation'] = data.groupby('functionName')['lastInvokedDateTime'].diff().dt.total_seconds()

    # Fill missing values with backfill within each group
    data['time_since_last_invocation'] = data.groupby('functionName')['time_since_last_invocation'].transform(lambda x: x.fillna(method='bfill'))

    # Move the 'time_since_last_invocation' column to the first position
    time_since_last_invocation_column = data.pop('time_since_last_invocation')
    data.insert(0, 'time_since_last_invocation', time_since_last_invocation_column)

    # One-hot encode the 'functionName' column
    function_dummies = pd.get_dummies(data['functionName'], prefix='function')
    data_encoded = pd.concat([data, function_dummies], axis=1)

    features_to_scale = ['time_since_last_invocation', 'hour_of_day', 'day_of_week', 'initDuration', 'duration', 'maxMemoryUsed', 'memorySize']

    # Apply StandardScaler
    scaler = StandardScaler()
    data_encoded[features_to_scale] = scaler.fit_transform(data_encoded[features_to_scale])

    # Define feature columns excluding non-feature and target columns
    exclude_columns = ['lastInvokedDateTime', 'functionName', 'time_since_last_invocation']
    feature_columns = [col for col in data_encoded.columns if col not in exclude_columns]

    # Create sequences and targets 
    x_all, y_all = create_sequences(data_encoded, sequence_length, feature_columns)

    return x_all, y_all, function_dummies, scaler

def split_data(x_all, y_all):
    x_train, x_test, y_train, y_test = train_test_split(x_all, y_all, test_size=0.24, random_state=42)
    
    x_train = x_train.astype('float32')
    y_train = y_train.astype('float32')
    x_test = x_test.astype('float32')
    y_test = y_test.astype('float32')
    
    return x_train, x_test, y_train, y_test

def build_model(x_train):
    # Define the model
    model = Sequential([
        LSTM(40, input_shape=(x_train.shape[1], x_train.shape[2]), return_sequences=True, kernel_regularizer=l2(0.01)),
        Dropout(0.33),
        LSTM(8, return_sequences=False, kernel_regularizer=l2(0.01)),  # Final LSTM layer with fewer units
        Dropout(0.33),
        Dense(1)
    ])

    # Compile the model
    model.compile(optimizer='adam', loss=Huber(delta=1.5))

    return model

def train_model(x_train, y_train, x_test, y_test):
    early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)

    model = build_model(x_train)
    model.fit(x_train, y_train, epochs=25, validation_data=(x_test, y_test), batch_size=19, verbose=1, callbacks=[early_stop])    
    
    return model

def create_model():
    data = load_data()

    x_all, y_all, function_dummies, scaler = preprocess_data(data)
    
    x_train, x_test, y_train, y_test = split_data(x_all, y_all)

    model = train_model(x_train, y_train, x_test, y_test)

    # Evaluate the model
    y_pred = model.predict(x_test, batch_size=19)  # batch_size should match what was used during training
    mae = mean_absolute_error(y_test, y_pred)
    mse = mean_squared_error(y_test, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y_test, y_pred)

    # Save the model
    save_artifacts(model, scaler, function_dummies)
    print(f'MAE: {mae}, MSE: {mse}, RMSE: {rmse}, R2: {r2}')

if __name__ == '__main__':
    print('Training the model...')
    create_model()   
    print('Model training completed!')