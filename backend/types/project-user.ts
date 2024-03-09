export interface ProjectUser {
  projectId: string;
  userId: string;
  fullName: string;
  email: string;
  createdAt: number;
  updatedAt: number;
  role: ProjectUserRole;
}

export enum ProjectUserRole {
  SUPER_ADMINISTRATOR = "super_admin",
  ADMINISTRATOR = "admin",
  MEMBER = "member",
}
