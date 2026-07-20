import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardStats, UsageAnalytics, UsageLog } from '../models/usage.model';
import { PageResponse } from '../models/api-key.model';

@Injectable({ providedIn: 'root' })
export class UsageService {
  private readonly http = inject(HttpClient);

  getKeyAnalytics(
    organizationId: string,
    apiKeyId: string,
    windowDays = 30
  ): Observable<UsageAnalytics> {
    const params = new HttpParams().set('windowDays', windowDays);
    return this.http.get<UsageAnalytics>(
      `${environment.apiBaseUrl}/organizations/${organizationId}/keys/${apiKeyId}/analytics`,
      { params }
    );
  }

  listUsageLogs(
    organizationId: string,
    apiKeyId: string,
    page = 0,
    size = 25
  ): Observable<PageResponse<UsageLog>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<UsageLog>>(
      `${environment.apiBaseUrl}/organizations/${organizationId}/keys/${apiKeyId}/usage-logs`,
      { params }
    );
  }

  getDashboardStats(organizationId: string): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(
      `${environment.apiBaseUrl}/organizations/${organizationId}/dashboard-stats`
    );
  }
}
