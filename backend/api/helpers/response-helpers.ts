import * as awsx from '@pulumi/awsx';

export async function NotFound(): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: 404,
    body: JSON.stringify('Not Found')
  };
}

export async function Forbidden(): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: 403,
    body: JSON.stringify('Forbidden')
  };
}

export async function SuccessTrue(): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
}

export async function SuccessWithData(data: any): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: 200,
    body: JSON.stringify(data)
  };
}
export async function BadRequest(): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: 400,
    body: JSON.stringify({ message: 'Bad Inputs Recieved' })
  };
}

export async function Redirect(redirectUrl: string): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: 301,
    headers: {
      Location: redirectUrl
    },
    body: JSON.stringify({ message: `Redirecting To URL - ${redirectUrl}` })
  };
}

export async function Conflict(message: string): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: 409,
    body: JSON.stringify({ message })
  };
}

export async function ServerError(message?: string): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: 502,
    body: JSON.stringify({ message: message || 'Internal Server Error' })
  };
}

export async function CustomResponse(message: string, code: number): Promise<awsx.classic.apigateway.Response> {
  return {
    statusCode: code,
    body: JSON.stringify({ message })
  };
}