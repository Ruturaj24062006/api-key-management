import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { SessionStateService } from '../../core/state/session-state.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'kf-topbar',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  template: `
    <mat-toolbar class="kf-topbar">
      <button mat-icon-button (click)="menuToggle.emit()" aria-label="Toggle navigation">
        <mat-icon>menu</mat-icon>
      </button>

      <span class="kf-topbar__brand">KeyForge</span>

      <span class="kf-topbar__spacer"></span>

      @if (sessionState.organizations().length > 0) {
        <button mat-button [matMenuTriggerFor]="orgMenu" class="kf-topbar__org-switcher">
          <mat-icon>domain</mat-icon>
          {{ sessionState.currentOrganization()?.name ?? 'Select organization' }}
          <mat-icon>arrow_drop_down</mat-icon>
        </button>
        <mat-menu #orgMenu="matMenu">
          @for (org of sessionState.organizations(); track org.id) {
            <button mat-menu-item (click)="selectOrg(org.id)">
              {{ org.name }}
              <span class="kf-topbar__org-plan">{{ org.planTier }}</span>
            </button>
          }
        </mat-menu>
      }

      <button mat-icon-button [matMenuTriggerFor]="userMenu" aria-label="User menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #userMenu="matMenu">
        <div class="kf-topbar__user-info">
          <strong>{{ sessionState.currentUser()?.fullName }}</strong>
          <span>{{ sessionState.currentUser()?.email }}</span>
        </div>
        <button mat-menu-item (click)="logout()">
          <mat-icon>logout</mat-icon>
          Sign out
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .kf-topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #ffffff;
      color: #1a1d24;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .kf-topbar__brand {
      font-weight: 700;
      font-size: 18px;
      margin-left: 4px;
      letter-spacing: -0.02em;
    }

    .kf-topbar__spacer {
      flex: 1 1 auto;
    }

    .kf-topbar__org-switcher {
      margin-right: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .kf-topbar__org-plan {
      margin-left: 8px;
      font-size: 11px;
      opacity: 0.6;
    }

    .kf-topbar__user-info {
      display: flex;
      flex-direction: column;
      padding: 8px 16px;
      font-size: 13px;
    }

    .kf-topbar__user-info span {
      color: rgba(0, 0, 0, 0.6);
      font-size: 12px;
    }
  `],
})
export class TopbarComponent {
  protected readonly sessionState = inject(SessionStateService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  menuToggle = output<void>();

  selectOrg(orgId: string): void {
    this.sessionState.setCurrentOrg(orgId);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
