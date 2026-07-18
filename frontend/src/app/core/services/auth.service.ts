import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface UserSession {
  userId: string;
  email: string;
  role: string; // Always normalized to ROLE_STUDENT | ROLE_RECRUITER | ROLE_ADMIN
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  email: string;
  role: string;
  userId: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiUrl = 'http://localhost:8080/api/v1/auth';

  // Signals for state management
  readonly currentUser = signal<UserSession | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  /** True while session is being restored from localStorage on startup. Guards must wait for this to become false. */
  readonly isAuthLoading = signal<boolean>(true);

  constructor(private readonly http: HttpClient) {
    this.restoreSession();
  }

  register(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, payload);
  }

  login(payload: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, payload).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.saveSession(res.data);
        }
      })
    );
  }

  loginWithGoogle(token: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/google`, { idToken: token }).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.saveSession(res.data);
        }
      })
    );
  }

  refreshToken(): Observable<any> {
    const refreshToken = localStorage.getItem('refresh_token');
    return this.http.post<any>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap(res => {
        if (res.success && res.data) {
          this.saveSession(res.data);
        } else {
          this.logout();
        }
      })
    );
  }

  verifyEmail(token: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/verify-email`, { params: { token } });
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(payload: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reset-password`, payload);
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_session');
    this.currentUser.set(null);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /** Returns the current user's role normalized to uppercase (e.g. ROLE_STUDENT). */
  getCurrentRole(): string | null {
    const user = this.currentUser();
    if (!user?.role) return null;
    return normalizeRole(user.role);
  }

  /**
   * Centralized dashboard redirect — the single source of truth for
   * "where does this role go after login / session restore / guard redirect".
   */
  redirectToDashboard(router: Router, role?: string): void {
    const r = normalizeRole(role ?? this.getCurrentRole() ?? '');
    switch (r) {
      case 'ROLE_STUDENT':
        router.navigate(['/student/dashboard']);
        break;
      case 'ROLE_RECRUITER':
        router.navigate(['/recruiter/dashboard']);
        break;
      case 'ROLE_ADMIN':
        router.navigate(['/admin/dashboard']);
        break;
      default:
        // Unknown / missing role — send to login, not to unauthorized
        router.navigate(['/login']);
        break;
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  saveSession(data: LoginResponse): void {
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);

    // Derive email: prefer response field, then fall back to JWT sub claim
    const email = data.email ?? extractEmailFromJwt(data.accessToken) ?? '';

    const session: UserSession = {
      userId: data.userId,
      email,
      role: normalizeRole(data.role)
    };

    localStorage.setItem('user_session', JSON.stringify(session));
    this.currentUser.set(session);
  }

  private restoreSession(): void {
    this.isAuthLoading.set(true);
    try {
      const sessionStr = localStorage.getItem('user_session');
      const token = localStorage.getItem('access_token');

      if (sessionStr && token) {
        // Validate token expiry BEFORE restoring the session.
        // If the token is expired, clear everything so the user is prompted to log in fresh
        // instead of being stuck with 403 errors on every API call.
        if (this.isTokenExpired(token)) {
          console.warn('Stored access token is expired. Clearing session.');
          this.logout();
          return;
        }
        const raw: UserSession = JSON.parse(sessionStr);
        // Always normalize the stored role in case localStorage has stale casing
        const session: UserSession = { ...raw, role: normalizeRole(raw.role) };
        this.currentUser.set(session);
      }
    } catch (e) {
      console.error('Failed to restore auth session', e);
      this.logout();
    } finally {
      this.isAuthLoading.set(false);
    }
  }

  /** Decodes a JWT and returns true if it has expired (client-side only, no signature check). */
  private isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      const expMs = payload.exp * 1000;
      return Date.now() > expMs;
    } catch {
      return true; // Malformed token — treat as expired
    }
  }
}

// ─── Pure utility functions (exported for use in guards / components) ─────────

/** Normalizes any role string to uppercase ROLE_ prefix form. */
export function normalizeRole(role: string): string {
  if (!role) return '';
  const upper = role.trim().toUpperCase();
  return upper.startsWith('ROLE_') ? upper : `ROLE_${upper}`;
}

/** Decodes the email claim from a JWT without verifying signature (client-side only). */
function extractEmailFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.email ?? payload.sub ?? null;
  } catch {
    return null;
  }
}
