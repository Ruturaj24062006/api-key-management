import { Component, DestroyRef, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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

          <mat-card class="kf-stat-card kf-stat-card--clickable" (click)="viewErrorAnalytics()">
            <div class="kf-stat-card__header">
              <mat-icon class="kf-stat-card__icon kf-stat-card__icon--error">error_outline</mat-icon>
              <span class="kf-stat-card__badge">Click for Details ➔</span>
            </div>
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

    .kf-stat-card--clickable {
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }

    .kf-stat-card--clickable:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(63, 81, 181, 0.18);
      border-color: #3f51b5;
    }

    .kf-stat-card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kf-stat-card__badge {
      font-size: 11px;
      font-weight: 600;
      color: #3f51b5;
      background: #eef1fb;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .kf-stat-card__icon {
      color: #3f51b5;
      margin-bottom: 8px;
    }

    .kf-stat-card__icon--error {
      color: #d32f2f;
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
  private readonly router = inject(Router);

  stats = signal<DashboardStats | null>(null);
  loading = signal(true);

  viewErrorAnalytics(): void {
    this.router.navigate(['/error-analytics']);
  }

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
