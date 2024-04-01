import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const stage = pulumi.getStack();

const deadLetterQueue = new aws.sqs.Queue(`${stage}-dead-letter-queue`, {
  messageRetentionSeconds: 1209600, // 14 days
});

const globalScheduleProcessingQueue = new aws.sqs.Queue(
  `${stage}-global-schedule-processing-queue`,
  {
    delaySeconds: 5,
    visibilityTimeoutSeconds: 60,
    redrivePolicy: deadLetterQueue.arn.apply((arn) =>
      JSON.stringify({
        maxReceiveCount: 5, // if consumer fails to process message 5 times, move to DLQ and remove from client
        deadLetterTargetArn: arn,
      })
    ),
  }
);

export const Queues = {
  globalScheduleProcessingQueue,
};
