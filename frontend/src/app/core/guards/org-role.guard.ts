import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MembershipRole } from '../models/organization.model';
import { SessionStateService } from '../state/session-state.service';

/**
 * Restricts a route to users whose role in the CURRENTLY SELECTED org is one
 * of the allowed roles, e.g. `orgRoleGuard(['OWNER', 'ADMIN'])` for
 * settings/member-management pages. Reads role off the cached Organization
 * signal (populated from the last /organizations list call) rather than
 * re-fetching - keeps route transitions fast since org membership rarely
 * changes mid-session.
 */
export function orgRoleGuard(allowedRoles: MembershipRole[]): CanActivateFn {
  return () => {
    const sessionState = inject(SessionStateService);
    const router = inject(Router);

    const org = sessionState.currentOrganization();
    if (!org) {
      // No org loaded into state yet (e.g. deep link on a fresh tab) - send
      // the user to the dashboard, which loads orgs before anything else.
      return router.createUrlTree(['/dashboard']);
    }

    if (allowedRoles.includes(org.currentUserRole)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}
