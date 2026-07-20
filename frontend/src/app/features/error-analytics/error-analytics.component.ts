import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UsageService } from '../../core/services/usage.service';
import { SessionStateService } from '../../core/state/session-state.service';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'kf-error-analytics',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatTooltipModule,
    LoadingSpinnerComponent,
  ],
  template: `
    <div class="kf-page">
      <div class="kf-page-header">
        <div class="kf-page-header__left">
          <button mat-icon-button routerLink="/dashboard" matTooltip="Back to Dashboard">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div>
            <h1>Error & Rate Limit Analytics</h1>
            <p class="kf-page-subtitle">Detailed breakdown of HTTP 429 Rate Limit breaches and system errors</p>
          </div>
        </div>
        <button mat-stroked-button (click)="loadData()">
          <mat-icon>refresh</mat-icon>
          Refresh Data
        </button>
      </div>

      @if (loading()) {
        <kf-loading-spinner label="Analyzing error logs and rate limits..."></kf-loading-spinner>
      } @else if (data()) {
        <!-- Summary Cards -->
        <div class="kf-card-grid">
          <mat-card class="kf-stat-card kf-stat-card--error">
            <mat-icon class="kf-stat-card__icon">error_outline</mat-icon>
            <div class="kf-stat-card__value">{{ data().totalErrorsToday }}</div>
            <div class="kf-stat-card__label">Total Errors Today</div>
          </mat-card>

          <mat-card class="kf-stat-card kf-stat-card--warning">
            <mat-icon class="kf-stat-card__icon">speed</mat-icon>
            <div class="kf-stat-card__value">{{ data().rateLimitErrorsToday }}</div>
            <div class="kf-stat-card__label">Rate Limit Breaches (HTTP 429)</div>
          </mat-card>

          <mat-card class="kf-stat-card">
            <mat-icon class="kf-stat-card__icon">warning_amber</mat-icon>
            <div class="kf-stat-card__value">{{ data().otherErrorsToday }}</div>
            <div class="kf-stat-card__label">Other HTTP Errors</div>
          </mat-card>

          <mat-card class="kf-stat-card">
            <mat-icon class="kf-stat-card__icon">percent</mat-icon>
            <div class="kf-stat-card__value">{{ data().errorRatePercent }}%</div>
            <div class="kf-stat-card__label">Error Rate (Today)</div>
          </mat-card>
        </div>

        <!-- Explanatory Banner -->
        <mat-card class="kf-info-banner">
          <mat-icon class="kf-info-banner__icon">info</mat-icon>
          <div class="kf-info-banner__content">
            <strong>How Rate Limit Enforcement Works:</strong>
            <p>
              Each API key is assigned a maximum request limit per 60-second window (e.g. 60 req/min). 
              When incoming traffic exceeds this threshold, KeyForge rejects requests with <code>HTTP 429 Too Many Requests</code>. 
              The window counter resets automatically after 60 seconds of inactivity.
            </p>
          </div>
        </mat-card>

        <!-- Affected API Keys Table -->
        <div class="kf-section">
          <h2>Affected API Keys & Quota Usage</h2>
          <table mat-table [dataSource]="data().affectedKeys" class="mat-elevation-z1 kf-full-width">
            <ng-container matColumnDef="keyName">
              <th mat-header-cell *matHeaderCellDef>Key Name</th>
              <td mat-cell *matCellDef="let row">
                <strong>{{ row.keyName }}</strong>
              </td>
            </ng-container>

            <ng-container matColumnDef="keyPrefix">
              <th mat-header-cell *matHeaderCellDef>Prefix</th>
              <td mat-cell *matCellDef="let row"><code>{{ row.keyPrefix }}••••</code></td>
            </ng-container>

            <ng-container matColumnDef="rateLimitPerMinute">
              <th mat-header-cell *matHeaderCellDef>Configured Limit</th>
              <td mat-cell *matCellDef="let row">{{ row.rateLimitPerMinute }} req/min</td>
            </ng-container>

            <ng-container matColumnDef="currentWindowCount">
              <th mat-header-cell *matHeaderCellDef>Current Window Count</th>
              <td mat-cell *matCellDef="let row">
                <span [class.kf-text-danger]="row.isRateLimited">
                  {{ row.currentWindowCount }} / {{ row.rateLimitPerMinute }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="totalBlockedCalls">
              <th mat-header-cell *matHeaderCellDef>Blocked Calls Today</th>
              <td mat-cell *matCellDef="let row">
                <span class="kf-badge-count" [class.kf-badge-count--danger]="row.totalBlockedCalls > 0">
                  {{ row.totalBlockedCalls }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                @if (row.isRateLimited) {
                  <span class="kf-chip kf-chip--danger">🔴 RATE LIMITED</span>
                } @else {
                  <span class="kf-chip kf-chip--success">🟢 NORMAL</span>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="keyColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: keyColumns"></tr>
          </table>
          @if (data().affectedKeys.length === 0) {
            <div class="kf-empty-table">No API keys have hit rate limits or errors today.</div>
          }
        </div>

        <!-- Recent Error Logs Table -->
        <div class="kf-section">
          <h2>Recent Error & Rate-Limit Request Logs</h2>
          <table mat-table [dataSource]="data().recentErrorLogs" class="mat-elevation-z1 kf-full-width">
            <ng-container matColumnDef="time">
              <th mat-header-cell *matHeaderCellDef>Time</th>
              <td mat-cell *matCellDef="let row">{{ row.occurredAt | date:'mediumTime' }}</td>
            </ng-container>

            <ng-container matColumnDef="keyName">
              <th mat-header-cell *matHeaderCellDef>Key Name</th>
              <td mat-cell *matCellDef="let row">{{ row.keyName }}</td>
            </ng-container>

            <ng-container matColumnDef="endpoint">
              <th mat-header-cell *matHeaderCellDef>Endpoint</th>
              <td mat-cell *matCellDef="let row">
                <code>{{ row.httpMethod }} {{ row.endpoint }}</code>
              </td>
            </ng-container>

            <ng-container matColumnDef="statusCode">
              <th mat-header-cell *matHeaderCellDef>HTTP Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="kf-chip" [class.kf-chip--danger]="row.statusCode === 429" [class.kf-chip--warning]="row.statusCode !== 429">
                  {{ row.statusCode }} {{ row.statusCode === 429 ? 'TOO MANY REQUESTS' : 'ERROR' }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="errorReason">
              <th mat-header-cell *matHeaderCellDef>Error Reason</th>
              <td mat-cell *matCellDef="let row">{{ row.errorReason }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="logColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: logColumns"></tr>
          </table>
          @if (data().recentErrorLogs.length === 0) {
            <div class="kf-empty-table">No error logs recorded for today.</div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .kf-page-header__left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .kf-page-subtitle {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }

    .kf-stat-card {
      padding: 20px;
    }

    .kf-stat-card__icon {
      color: #3f51b5;
      margin-bottom: 8px;
    }

    .kf-stat-card--error .kf-stat-card__icon {
      color: #d32f2f;
    }

    .kf-stat-card--warning .kf-stat-card__icon {
      color: #ed6c02;
    }

    .kf-stat-card__value {
      font-size: 28px;
      font-weight: 700;
    }

    .kf-stat-card__label {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }

    .kf-info-banner {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 16px;
      padding: 16px 20px;
      margin-top: 24px;
      background: #fff8e1;
      border-left: 4px solid #ffa000;
    }

    .kf-info-banner__icon {
      color: #ffa000;
    }

    .kf-info-banner__content p {
      margin: 4px 0 0 0;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.8);
      line-height: 1.5;
    }

    .kf-section {
      margin-top: 32px;
    }

    .kf-section h2 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .kf-chip {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
    }

    .kf-chip--danger {
      background: #fdeaea;
      color: #d32f2f;
    }

    .kf-chip--warning {
      background: #fff3e0;
      color: #e65100;
    }

    .kf-chip--success {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .kf-text-danger {
      color: #d32f2f;
      font-weight: 700;
    }

    .kf-badge-count {
      font-weight: 600;
    }

    .kf-badge-count--danger {
      color: #d32f2f;
    }

    .kf-empty-table {
      padding: 24px;
      text-align: center;
      color: rgba(0, 0, 0, 0.5);
      background: #fff;
      border: 1px solid rgba(0, 0, 0, 0.08);
      font-size: 14px;
    }
  `],
})
export class ErrorAnalyticsComponent implements OnInit {
  private readonly usageService = inject(UsageService);
  private readonly sessionState = inject(SessionStateService);

  loading = signal(true);
  data = signal<any | null>(null);

  keyColumns = ['keyName', 'keyPrefix', 'rateLimitPerMinute', 'currentWindowCount', 'totalBlockedCalls', 'status'];
  logColumns = ['time', 'keyName', 'endpoint', 'statusCode', 'errorReason'];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) return;

    this.loading.set(true);
    this.usageService.getErrorAnalytics(orgId).subscribe({
      next: (resp) => {
        this.data.set(resp);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
