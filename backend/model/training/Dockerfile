# Use an official TensorFlow runtime as a parent image
FROM python:3.7-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Install any needed packages specified in requirements.txt
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /usr/src/app
COPY . .

# Set the entrypoint to the training script
ENTRYPOINT ["python3", "train.py"]
