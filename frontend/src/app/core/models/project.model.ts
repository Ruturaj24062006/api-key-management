export type Environment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  environment: Environment;
  activeKeyCount: number;
  createdAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  environment: Environment;
}

export interface UpdateProjectRequest {
  name: string;
  description?: string;
  environment: Environment;
}
