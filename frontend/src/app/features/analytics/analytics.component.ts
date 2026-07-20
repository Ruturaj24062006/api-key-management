import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { UsageService } from '../../core/services/usage.service';
import { SessionStateService } from '../../core/state/session-state.service';
import { UsageAnalytics } from '../../core/models/usage.model';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'kf-analytics',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    LoadingSpinnerComponent,
  ],
  template: `
    <div class="kf-page">
      <div class="kf-page-header">
        <h1>Usage Analytics</h1>
        <mat-form-field appearance="outline" style="width: 160px;">
          <mat-label>Window</mat-label>
          <mat-select [value]="windowDays()" (selectionChange)="onWindowChange($event.value)">
            <mat-option [value]="7">Last 7 days</mat-option>
            <mat-option [value]="30">Last 30 days</mat-option>
            <mat-option [value]="90">Last 90 days</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="kf-card-grid">
        <mat-card class="kf-stat-card">
          <div class="kf-stat-card__value">{{ analytics()?.totalCalls ?? 0 | number }}</div>
          <div class="kf-stat-card__label">Total calls</div>
        </mat-card>
        <mat-card class="kf-stat-card">
          <div class="kf-stat-card__value">{{ analytics()?.totalErrors ?? 0 | number }}</div>
          <div class="kf-stat-card__label">Total errors</div>
        </mat-card>
      </div>

      @if (loading()) {
        <kf-loading-spinner label="Crunching usage numbers..."></kf-loading-spinner>
      }

      <table mat-table [dataSource]="analytics()?.dailyBreakdown ?? []" class="mat-elevation-z1 kf-full-width">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Date</th>
          <td mat-cell *matCellDef="let row">{{ row.date }}</td>
        </ng-container>

        <ng-container matColumnDef="totalCalls">
          <th mat-header-cell *matHeaderCellDef>Calls</th>
          <td mat-cell *matCellDef="let row">{{ row.totalCalls }}</td>
        </ng-container>

        <ng-container matColumnDef="errorCalls">
          <th mat-header-cell *matHeaderCellDef>Errors</th>
          <td mat-cell *matCellDef="let row">{{ row.errorCalls }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>
    </div>
  `,
  styles: [`
    .kf-stat-card {
      padding: 20px;
    }

    .kf-stat-card__value {
      font-size: 24px;
      font-weight: 700;
    }

    .kf-stat-card__label {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }
  `],
})
export class AnalyticsComponent implements OnInit {
  private readonly usageService = inject(UsageService);
  private readonly sessionState = inject(SessionStateService);
  private readonly route = inject(ActivatedRoute);

  analytics = signal<UsageAnalytics | null>(null);
  loading = signal(false);
  windowDays = signal(30);
  displayedColumns = ['date', 'totalCalls', 'errorCalls'];

  private apiKeyId!: string;

  ngOnInit(): void {
    this.apiKeyId = this.route.snapshot.paramMap.get('keyId')!;
    this.fetch();
  }

  onWindowChange(days: number): void {
    // Updates the signal driving the select's displayed value, but does not
    // itself trigger a refetch - fetch() has to be called separately below.
    this.windowDays.set(days);
    this.fetch();
  }

  private fetch(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) return;

    this.loading.set(true);
    this.usageService.getKeyAnalytics(orgId, this.apiKeyId, this.windowDays()).subscribe({
      next: (data) => {
        this.analytics.set(data);
        // loading is left true here on the happy path - only the error
        // handler below resets it, so a slow-but-successful request leaves
        // the spinner and the (now populated) table stacked on top of each
        // other until the next fetch.
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
