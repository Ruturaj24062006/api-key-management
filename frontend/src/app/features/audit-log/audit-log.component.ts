import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { OrganizationService } from '../../core/services/organization.service';
import { SessionStateService } from '../../core/state/session-state.service';
import { AuditLogEntry } from '../../core/models/audit-log.model';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'kf-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatChipsModule,
    MatIconModule,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="kf-page">
      <div class="kf-page-header">
        <div>
          <h1>Audit Log</h1>
          <p class="kf-page-subtitle">Track key creation, rotation, and revocation activities across your organization.</p>
        </div>
      </div>

      @if (loading()) {
        <kf-loading-spinner></kf-loading-spinner>
      } @else if (logs().length === 0) {
        <kf-empty-state
          icon="history"
          title="No audit events found"
          message="Security and management events for your organization will appear here."
        ></kf-empty-state>
      } @else {
        <table mat-table [dataSource]="logs()" class="mat-elevation-z1" style="width: 100%; margin-bottom: 8px;">
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Timestamp</th>
            <td mat-cell *matCellDef="let log">{{ log.createdAt | date: 'medium' }}</td>
          </ng-container>

          <ng-container matColumnDef="actorEmail">
            <th mat-header-cell *matHeaderCellDef>Actor</th>
            <td mat-cell *matCellDef="let log">{{ log.actorEmail }}</td>
          </ng-container>

          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>Action</th>
            <td mat-cell *matCellDef="let log">
              <mat-chip [class]="actionChipClass(log.action)">{{ log.action }}</mat-chip>
            </td>
          </ng-container>

          <ng-container matColumnDef="targetType">
            <th mat-header-cell *matHeaderCellDef>Target Type</th>
            <td mat-cell *matCellDef="let log"><code>{{ log.targetType }}</code></td>
          </ng-container>

          <ng-container matColumnDef="targetId">
            <th mat-header-cell *matHeaderCellDef>Target ID</th>
            <td mat-cell *matCellDef="let log"><code>{{ log.targetId }}</code></td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>

        <mat-paginator
          [length]="totalElements()"
          [pageSize]="pageSize()"
          [pageIndex]="pageIndex()"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)"
        ></mat-paginator>
      }
    </div>
  `,
  styles: [`
    .kf-page-subtitle {
      color: rgba(0, 0, 0, 0.6);
      font-size: 14px;
      margin-top: 4px;
    }

    .action-chip-created {
      background-color: #e8f5e9 !important;
      color: #2e7d32 !important;
    }

    .action-chip-revoked {
      background-color: #ffebee !important;
      color: #c62828 !important;
    }

    .action-chip-rotated {
      background-color: #e3f2fd !important;
      color: #1565c0 !important;
    }
  `],
})
export class AuditLogComponent implements OnInit {
  private readonly orgService = inject(OrganizationService);
  private readonly sessionState = inject(SessionStateService);

  logs = signal<AuditLogEntry[]>([]);
  totalElements = signal(0);
  pageSize = signal(10);
  pageIndex = signal(0);
  loading = signal(true);

  displayedColumns = ['createdAt', 'actorEmail', 'action', 'targetType', 'targetId'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.orgService.getAuditLogs(orgId, this.pageIndex(), this.pageSize()).subscribe({
      next: (page) => {
        this.logs.set(page.content);
        this.totalElements.set(page.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  actionChipClass(action: string): string {
    switch (action) {
      case 'API_KEY_CREATED':
        return 'action-chip-created';
      case 'API_KEY_REVOKED':
        return 'action-chip-revoked';
      case 'API_KEY_ROTATED':
        return 'action-chip-rotated';
      default:
        return '';
    }
  }
}
