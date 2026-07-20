import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap, map, concatMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/user.model';
import { SessionStateService } from '../state/session-state.service';
import { OrganizationService } from './organization.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly sessionState = inject(SessionStateService);
  private readonly orgService = inject(OrganizationService);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, request).pipe(
      tap((response) => this.persistSession(response)),
      concatMap((response) =>
        this.orgService.list().pipe(map(() => response))
      )
    );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, request).pipe(
      tap((response) => this.persistSession(response)),
      concatMap((response) =>
        this.orgService.list().pipe(map(() => response))
      )
    );
  }

  logout(): void {
    this.sessionState.clearSession();
  }

  private persistSession(response: AuthResponse): void {
    this.sessionState.setSession(
      {
        userId: response.userId,
        email: response.email,
        fullName: response.fullName,
        role: response.role,
      },
      response.token
    );
  }
}
