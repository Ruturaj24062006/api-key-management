import { Injectable, computed, signal } from '@angular/core';
import { AuthenticatedUser } from '../models/user.model';
import { Organization } from '../models/organization.model';

const TOKEN_KEY = 'keyforge_token';
const USER_KEY = 'keyforge_user';
const ORG_KEY = 'keyforge_current_org_id';

/**
 * Central signal-based store for "who is logged in" and "which org is
 * currently selected". Kept deliberately small - most page-level data
 * (projects, keys, usage) is fetched fresh per-route rather than cached here.
 */
@Injectable({ providedIn: 'root' })
export class SessionStateService {
  private readonly currentUserSignal = signal<AuthenticatedUser | null>(this.loadUser());
  private readonly organizationsSignal = signal<Organization[]>([]);
  private readonly currentOrgIdSignal = signal<string | null>(localStorage.getItem(ORG_KEY));

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly organizations = computed(() => this.organizationsSignal());
  readonly currentOrganization = computed(() =>
    this.organizationsSignal().find((org) => org.id === this.currentOrgIdSignal()) ?? null
  );
  readonly currentOrgId = computed(() => this.currentOrgIdSignal());

  setSession(user: AuthenticatedUser, token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUserSignal.set(user);
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ORG_KEY);
    this.currentUserSignal.set(null);
    this.organizationsSignal.set([]);
    this.currentOrgIdSignal.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setOrganizations(orgs: Organization[]): void {
    this.organizationsSignal.set(orgs);
    if (orgs.length > 0) {
      const currentExists = orgs.some((org) => org.id === this.currentOrgIdSignal());
      if (!currentExists) {
        this.setCurrentOrg(orgs[0].id);
      }
    } else {
      this.setCurrentOrg(null);
    }
  }

  setCurrentOrg(orgId: string | null): void {
    if (orgId) {
      localStorage.setItem(ORG_KEY, orgId);
    } else {
      localStorage.removeItem(ORG_KEY);
    }
    this.currentOrgIdSignal.set(orgId);
  }

  private loadUser(): AuthenticatedUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthenticatedUser;
    } catch {
      return null;
    }
  }
}
