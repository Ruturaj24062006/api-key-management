import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateOrganizationRequest,
  InviteMemberRequest,
  Membership,
  Organization,
} from '../models/organization.model';
import { AuditLogPageResponse } from '../models/audit-log.model';
import { SessionStateService } from '../state/session-state.service';

@Injectable({ providedIn: 'root' })
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateService);
  private readonly baseUrl = `${environment.apiBaseUrl}/organizations`;

  list(): Observable<Organization[]> {
    return this.http
      .get<Organization[]>(this.baseUrl)
      .pipe(tap((orgs) => this.sessionState.setOrganizations(orgs)));
  }

  get(organizationId: string): Observable<Organization> {
    return this.http.get<Organization>(`${this.baseUrl}/${organizationId}`);
  }

  create(request: CreateOrganizationRequest): Observable<Organization> {
    return this.http.post<Organization>(this.baseUrl, request);
  }

  listMembers(organizationId: string): Observable<Membership[]> {
    return this.http.get<Membership[]>(`${this.baseUrl}/${organizationId}/members`);
  }

  inviteMember(organizationId: string, request: InviteMemberRequest): Observable<Membership> {
    return this.http.post<Membership>(`${this.baseUrl}/${organizationId}/members`, request);
  }

  getAuditLogs(organizationId: string, page = 0, size = 20): Observable<AuditLogPageResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<AuditLogPageResponse>(`${this.baseUrl}/${organizationId}/audit-logs`, { params });
  }
}
