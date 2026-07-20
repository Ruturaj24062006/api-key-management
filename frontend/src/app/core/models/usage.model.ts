export interface UsageLog {
  id: string;
  apiKeyId: string;
  apiKeyPrefix: string;
  endpoint: string;
  httpMethod: string;
  statusCode: number;
  responseTimeMs: number;
  occurredAt: string;
}

export interface DailyUsagePoint {
  date: string;
  totalCalls: number;
  errorCalls: number;
}

export interface UsageAnalytics {
  apiKeyId: string;
  windowDays: number;
  totalCalls: number;
  totalErrors: number;
  dailyBreakdown: DailyUsagePoint[];
}

export interface DashboardStats {
  totalApiCallsToday: number;
  activeKeyCount: number;
  errorRatePercent: number;
  totalProjects: number;
}
