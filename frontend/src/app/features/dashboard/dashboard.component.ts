import { Component, DestroyRef, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap } from 'rxjs';
import { UsageService } from '../../core/services/usage.service';
import { SessionStateService } from '../../core/state/session-state.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { DashboardStats } from '../../core/models/usage.model';

const POLL_INTERVAL_MS = 15000;

@Component({
  selector: 'kf-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, LoadingSpinnerComponent],
  template: `
    <div class="kf-page">
      <div class="kf-page-header">
        <h1>Dashboard</h1>
        <span class="kf-dashboard__live-indicator">
          <mat-icon class="kf-dashboard__live-dot">fiber_manual_record</mat-icon>
          Live (Server-Sent Events Stream)
        </span>
      </div>

      @if (loading()) {
        <kf-loading-spinner label="Loading dashboard stats..."></kf-loading-spinner>
      } @else if (stats()) {
        <div class="kf-card-grid">
          <mat-card class="kf-stat-card">
            <mat-icon class="kf-stat-card__icon">bolt</mat-icon>
            <div class="kf-stat-card__value">{{ stats()!.totalApiCallsToday | number }}</div>
            <div class="kf-stat-card__label">API calls today</div>
          </mat-card>

          <mat-card class="kf-stat-card">
            <mat-icon class="kf-stat-card__icon">vpn_key</mat-icon>
            <div class="kf-stat-card__value">{{ stats()!.activeKeyCount }}</div>
            <div class="kf-stat-card__label">Active keys</div>
          </mat-card>

          <mat-card class="kf-stat-card">
            <mat-icon class="kf-stat-card__icon">error_outline</mat-icon>
            <div class="kf-stat-card__value">{{ stats()!.errorRatePercent }}%</div>
            <div class="kf-stat-card__label">Error rate (today)</div>
          </mat-card>

          <mat-card class="kf-stat-card">
            <mat-icon class="kf-stat-card__icon">folder</mat-icon>
            <div class="kf-stat-card__value">{{ stats()!.totalProjects }}</div>
            <div class="kf-stat-card__label">Projects</div>
          </mat-card>
        </div>

        <mat-card class="kf-dashboard__hint">
          <mat-icon>sensors</mat-icon>
          <span>
            Connected to live backend SSE stream. Stats update instantly as API key requests are processed.
          </span>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .kf-dashboard__live-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }

    .kf-dashboard__live-dot {
      font-size: 10px;
      width: 10px;
      height: 10px;
      color: #2e7d32;
    }

    .kf-stat-card {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kf-stat-card__icon {
      color: #3f51b5;
      margin-bottom: 8px;
    }

    .kf-stat-card__value {
      font-size: 28px;
      font-weight: 700;
    }

    .kf-stat-card__label {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }

    .kf-dashboard__hint {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      font-size: 13px;
      color: #1565c0;
      background: #e3f2fd;
      margin-top: 24px;
    }
  `],
})
export class DashboardComponent {
  private readonly usageService = inject(UsageService);
  private readonly sessionState = inject(SessionStateService);
  private readonly destroyRef = inject(DestroyRef);

  stats = signal<DashboardStats | null>(null);
  loading = signal(true);

  constructor() {
    effect(() => {
      const orgId = this.sessionState.currentOrgId();
      if (!orgId) {
        this.loading.set(false);
        return;
      }
      this.loading.set(true);

      // Subscribe to backend SSE push stream for real-time usage metrics
      this.usageService
        .streamDashboardStats(orgId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.stats.set(data);
            this.loading.set(false);
          },
          error: () => {
            // Fallback to one-shot fetch if SSE stream connection closes or errors
            this.usageService.getDashboardStats(orgId).subscribe({
              next: (data) => {
                this.stats.set(data);
                this.loading.set(false);
              },
              error: () => {
                this.loading.set(false);
              },
            });
          },
        });
    });
  }
}
