import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Dynamically rewrite localhost backend URL to Render backend in production
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  let targetUrl = req.url;
  if (!isLocalhost && req.url.startsWith('http://localhost:8080')) {
    targetUrl = req.url.replace('http://localhost:8080', 'https://nexus-backend-56gy.onrender.com');
  }

  let authReq = req.clone({ url: targetUrl });
  
  // Skip adding token to auth endpoints
  if (targetUrl.includes('/api/v1/auth/')) {
    return next(authReq);
  }

  const token = authService.getAccessToken();
  if (token) {
    authReq = authReq.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: any) => {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        // Clear local credentials on expired/invalid/rejected token and route back to login.
        // 403 happens when the JWT is structurally valid but rejected by the server (e.g. wrong
        // secret after redeploy, stale session, or missing role). Treat it the same as 401.
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
