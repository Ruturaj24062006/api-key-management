import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateProjectRequest, Project, UpdateProjectRequest } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);

  private baseUrl(organizationId: string): string {
    return `${environment.apiBaseUrl}/organizations/${organizationId}/projects`;
  }

  list(organizationId: string): Observable<Project[]> {
    return this.http.get<Project[]>(this.baseUrl(organizationId));
  }

  get(organizationId: string, projectId: string): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl(organizationId)}/${projectId}`);
  }

  create(organizationId: string, request: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>(this.baseUrl(organizationId), request);
  }

  update(organizationId: string, projectId: string, request: UpdateProjectRequest): Observable<Project> {
    return this.http.put<Project>(`${this.baseUrl(organizationId)}/${projectId}`, request);
  }

  delete(organizationId: string, projectId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(organizationId)}/${projectId}`);
  }
}
