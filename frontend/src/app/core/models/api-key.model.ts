export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export type Scope =
  | 'READ_USERS'
  | 'WRITE_USERS'
  | 'READ_BILLING'
  | 'WRITE_BILLING'
  | 'READ_PROJECTS'
  | 'WRITE_PROJECTS'
  | 'READ_ANALYTICS'
  | 'ADMIN_ALL';

export const ALL_SCOPES: { value: Scope; label: string; description: string }[] = [
  { value: 'READ_USERS', label: 'Read Users', description: 'View user records' },
  { value: 'WRITE_USERS', label: 'Write Users', description: 'Create/update user records' },
  { value: 'READ_BILLING', label: 'Read Billing', description: 'View invoices and billing data' },
  { value: 'WRITE_BILLING', label: 'Write Billing', description: 'Modify billing/subscription data' },
  { value: 'READ_PROJECTS', label: 'Read Projects', description: 'View project metadata' },
  { value: 'WRITE_PROJECTS', label: 'Write Projects', description: 'Create/update projects' },
  { value: 'READ_ANALYTICS', label: 'Read Analytics', description: 'View usage analytics' },
  { value: 'ADMIN_ALL', label: 'Admin (All)', description: 'Full administrative access - use sparingly' },
];

export interface ApiKey {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  keyPrefix: string;
  scopes: Scope[];
  status: ApiKeyStatus;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  rateLimitPerMinute: number;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: Scope[];
  expiresAt?: string | null;
  rateLimitPerMinute: number;
}

export interface ApiKeyCreatedResponse {
  apiKey: ApiKey;
  fullKey: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}
