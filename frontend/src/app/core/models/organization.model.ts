export type PlanTier = 'FREE' | 'PRO' | 'ENTERPRISE';
export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
  ownerId: string;
  currentUserRole: MembershipRole;
  createdAt: string;
}

export interface CreateOrganizationRequest {
  name: string;
}

export interface Membership {
  id: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  role: MembershipRole;
  joinedAt: string;
}

export interface InviteMemberRequest {
  email: string;
  role: MembershipRole;
}
