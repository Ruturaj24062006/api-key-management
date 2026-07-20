import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardStats, UsageAnalytics, UsageLog } from '../models/usage.model';
import { PageResponse } from '../models/api-key.model';
import { SessionStateService } from '../state/session-state.service';

@Injectable({ providedIn: 'root' })
export class UsageService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateService);

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

  streamDashboardStats(organizationId: string): Observable<DashboardStats> {
    const token = this.sessionState.getToken();
    const url = `${environment.apiBaseUrl}/organizations/${organizationId}/dashboard/stream?token=${encodeURIComponent(token ?? '')}`;

    return new Observable<DashboardStats>((subscriber) => {
      const eventSource = new EventSource(url);

      eventSource.addEventListener('dashboard-stats', (event: MessageEvent) => {
        try {
          const stats: DashboardStats = JSON.parse(event.data);
          subscriber.next(stats);
        } catch (err) {
          subscriber.error(err);
        }
      });

      eventSource.onerror = (error) => {
        subscriber.error(error);
      };

      return () => {
        eventSource.close();
      };
    });
  }
}
