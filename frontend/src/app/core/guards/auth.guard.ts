import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStateService } from '../state/session-state.service';

export const authGuard: CanActivateFn = () => {
  const sessionState = inject(SessionStateService);
  const router = inject(Router);

  if (sessionState.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const sessionState = inject(SessionStateService);
  const router = inject(Router);

  if (!sessionState.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
