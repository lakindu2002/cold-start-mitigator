import { STS } from "aws-sdk";

export const integrateWithRole = async (
  roleArn: string,
  externalId: string,
  sessionName = "testing-integration"
): Promise<STS.AssumeRoleResponse | boolean> => {
  const assumeRoleParams = {
    RoleArn: roleArn,
    RoleSessionName: sessionName,
    ExternalId: externalId,
  };

  const sts = new STS();
  try {
    const assumeRoleResponse = await sts.assumeRole(assumeRoleParams).promise();
    return assumeRoleResponse;
  } catch (err) {
    console.log(err);
    return false;
  }
};
