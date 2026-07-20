import { UserRole } from './user.model';

export interface PlatformUsageSummary {
  totalApiCalls: number;
  activeKeyCount: number;
  errorRatePercent: number;
  totalOrganizations: number;
  totalProjects: number;
}

export interface UserMembershipSummary {
  organizationId: string;
  organizationName: string;
  role: string;
}

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
  memberships: UserMembershipSummary[];
}
