import * as awsx from '@pulumi/awsx';

export const Parse = (event: awsx.classic.apigateway.Request) => (
  {
    userId: event.requestContext?.authorizer?.claims?.sub,
    email: event.requestContext?.authorizer?.claims?.email,
    body: JSON.parse(event?.body || '{}'),
    pathParams: event.pathParameters === null ? {} : event.pathParameters,
    queryParams: event.queryStringParameters!,
    name: event.requestContext?.authorizer?.claims?.name,
  }
);