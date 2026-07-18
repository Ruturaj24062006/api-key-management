import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * authGuard — protects ALL routes that require an authenticated user.
 *
 * While the session is still being restored (isAuthLoading = true) we return
 * true and let the route render — the restoreSession() call is synchronous, so
 * isAuthLoading will already be false by the time any route guard runs in
 * Angular's sync change-detection cycle. This guard is therefore also safe for
 * the async future case.
 *
 * If NOT authenticated → /login
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Session restore is synchronous — isAuthLoading should be false here.
  // Guard defensively anyway: if still loading, allow through and let roleGuard re-evaluate.
  if (authService.isAuthLoading()) {
    return true;
  }

  if (authService.isAuthenticated()) {
    return true;
  }

  // Not authenticated — send to login, preserving the intended URL for returnUrl
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

/**
 * roleGuard — checks that the authenticated user has the correct role for the route.
 *
 * Expected route data: { roles: ['ROLE_STUDENT'] } or { roles: ['ROLE_RECRUITER'] }
 *
 * Rules:
 *  - Still loading → allow (prevents Access Denied flash during page refresh)
 *  - Not authenticated → /login  (authGuard should have caught this first, but be defensive)
 *  - Authenticated but wrong role → /unauthorized
 *  - Authenticated and correct role → allow
 */
export const roleGuard: CanActivateFn = (route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // While session is being restored, do not make a role decision yet
  if (authService.isAuthLoading()) {
    return true;
  }

  // Not authenticated at all — redirect to login, not to unauthorized
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const expectedRoles: string[] = route.data?.['roles'] ?? [];
  const userRole = authService.getCurrentRole() ?? '';

  // No role restriction configured on this route → allow
  if (expectedRoles.length === 0) {
    return true;
  }

  // Role matches → allow
  if (expectedRoles.includes(userRole)) {
    return true;
  }

  // Authenticated but wrong role → show access-denied page
  router.navigate(['/unauthorized']);
  return false;
};
