import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlatformUsageSummary, UserSummary } from '../models/admin.model';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin`;

  getPlatformUsageSummary(): Observable<PlatformUsageSummary> {
    return this.http.get<PlatformUsageSummary>(`${this.baseUrl}/platform-usage-summary`);
  }

  getUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>(`${this.baseUrl}/users`);
  }
}
