import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiKey,
  ApiKeyCreatedResponse,
  CreateApiKeyRequest,
  PageResponse,
} from '../models/api-key.model';

@Injectable({ providedIn: 'root' })
export class ApiKeyService {
  private readonly http = inject(HttpClient);

  list(
    organizationId: string,
    projectId: string,
    page = 0,
    size = 10
  ): Observable<PageResponse<ApiKey>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<ApiKey>>(
      `${environment.apiBaseUrl}/organizations/${organizationId}/projects/${projectId}/keys`,
      { params }
    );
  }

  create(
    organizationId: string,
    projectId: string,
    request: CreateApiKeyRequest
  ): Observable<ApiKeyCreatedResponse> {
    return this.http.post<ApiKeyCreatedResponse>(
      `${environment.apiBaseUrl}/organizations/${organizationId}/projects/${projectId}/keys`,
      request
    );
  }

  get(apiKeyId: string): Observable<ApiKey> {
    return this.http.get<ApiKey>(`${environment.apiBaseUrl}/keys/${apiKeyId}`);
  }

  revoke(apiKeyId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/keys/${apiKeyId}/revoke`, {});
  }

  /**
   * TODO: key rotation is not implemented on the backend yet - it currently
   * returns 501 Not Implemented. Wire this up once ApiKeyController#rotate
   * actually generates a new key + starts the grace period.
   */
  rotate(apiKeyId: string): Observable<ApiKeyCreatedResponse> {
    return this.http.post<ApiKeyCreatedResponse>(`${environment.apiBaseUrl}/keys/${apiKeyId}/rotate`, {});
  }
}
