import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionStateService } from '../state/session-state.service';

/**
 * Attaches the JWT (if present) to every outgoing request and redirects to
 * login on a 401 response (expired/invalid token).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionState = inject(SessionStateService);
  const router = inject(Router);
  const token = sessionState.getToken();

  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authorizedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        sessionState.clearSession();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
