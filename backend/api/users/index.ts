import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsSdk from "aws-sdk";
import * as awsx from "@pulumi/awsx";
import { SuccessWithData } from "../helpers/response-helpers";
import { Parse } from "../helpers/event-helpers";
import { ProjectTable, ProjectUserTable, UserTable } from "../../dynamodb";
import { Project, ProjectUser, User } from "../../types";

const stage = pulumi.getStack();

export const getLoggedInUserInformation = new aws.lambda.CallbackFunction(
  `${stage}-get-user-information`,
  {
    memorySize: 1024,
    callback: async (
      event: awsx.classic.apigateway.Request
    ): Promise<awsx.classic.apigateway.Response> => {
      const pe = Parse(event);
      const { userId } = pe;

      const dynamo = new awsSdk.DynamoDB.DocumentClient();

      const { Item: UserItem } = await dynamo
        .get({
          Key: { id: userId },
          TableName: UserTable.name.get(),
        })
        .promise();

      const { Items: ProjectUsers = [] } = await dynamo
        .query({
          TableName: ProjectUserTable.name.get(),
          KeyConditionExpression: "#userId = :userId",
          IndexName: "projects-per-user",
          ExpressionAttributeNames: {
            "#userId": "userId",
          },
          ExpressionAttributeValues: {
            ":userId": userId,
          },
        })
        .promise();

      const projectIds = (ProjectUsers as ProjectUser[]).map(
        (project) => project.projectId
      );

      let projects: Project[] = [];

      if (projectIds.length > 0) {
        const { Responses } = await dynamo
          .batchGet({
            RequestItems: {
              [ProjectTable.name.get()]: {
                Keys: projectIds.map((projectId) => ({ id: projectId })),
              },
            },
          })
          .promise();

        projects =
          (Responses?.[ProjectTable.name.get()] as Project[]) ||
          ([] as Project[]);
      }

      const { id, email, fullName } = UserItem as User;
      const projectsToReturn = projects.map((project) => {
        const { name, id } = project;
        const projectUser = (ProjectUsers as ProjectUser[]).find(
          (projectUser) => projectUser.projectId === id
        );
        return { name, id, role: projectUser?.role };
      });

      const response = {
        id,
        email,
        fullName,
        projects: projectsToReturn,
      };

      return SuccessWithData({ ...response });
    },
  }
);
