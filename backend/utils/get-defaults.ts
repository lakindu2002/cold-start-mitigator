import { User } from "../types";

export const getDefaultUser = (
  email: string,
  fullName: string,
  id: string
): User => {
  const timestamp = Date.now();
  return {
    createdAt: timestamp,
    updatedAt: timestamp,
    email,
    fullName,
    id,
  };
};
