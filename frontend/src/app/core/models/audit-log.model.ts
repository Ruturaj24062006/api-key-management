import { PageResponse } from './api-key.model';

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export type AuditLogPageResponse = PageResponse<AuditLogEntry>;
