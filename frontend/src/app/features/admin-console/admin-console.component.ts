import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { AdminService } from '../../core/services/admin.service';
import { PlatformUsageSummary, UserSummary } from '../../core/models/admin.model';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'kf-admin-console',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatIconModule,
    LoadingSpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="kf-page">
      <div class="kf-page-header">
        <div>
          <h1>Admin Console</h1>
          <p class="kf-page-subtitle">Cross-organization platform metrics, access controls, and user active access summary.</p>
        </div>
      </div>

      @if (loading()) {
        <kf-loading-spinner label="Loading platform admin console..."></kf-loading-spinner>
      } @else {
        <!-- Metrics Grid -->
        @if (summary()) {
          <div class="kf-card-grid" style="margin-bottom: 24px;">
            <mat-card class="kf-stat-card">
              <mat-icon class="kf-stat-card__icon">analytics</mat-icon>
              <div class="kf-stat-card__value">{{ summary()!.totalApiCalls | number }}</div>
              <div class="kf-stat-card__label">Total API Calls</div>
            </mat-card>

            <mat-card class="kf-stat-card">
              <mat-icon class="kf-stat-card__icon">key</mat-icon>
              <div class="kf-stat-card__value">{{ summary()!.activeKeyCount | number }}</div>
              <div class="kf-stat-card__label">Active Keys</div>
            </mat-card>

            <mat-card class="kf-stat-card">
              <mat-icon class="kf-stat-card__icon">warning</mat-icon>
              <div class="kf-stat-card__value">{{ summary()!.errorRatePercent }}%</div>
              <div class="kf-stat-card__label">Platform Error Rate</div>
            </mat-card>

            <mat-card class="kf-stat-card">
              <mat-icon class="kf-stat-card__icon">business</mat-icon>
              <div class="kf-stat-card__value">{{ summary()!.totalOrganizations | number }}</div>
              <div class="kf-stat-card__label">Total Organizations</div>
            </mat-card>

            <mat-card class="kf-stat-card">
              <mat-icon class="kf-stat-card__icon">folder_shared</mat-icon>
              <div class="kf-stat-card__value">{{ summary()!.totalProjects | number }}</div>
              <div class="kf-stat-card__label">Total Projects</div>
            </mat-card>
          </div>
        }

        <!-- User Access Table -->
        <mat-card class="admin-table-card">
          <div class="admin-table-header">
            <h2>Registered Users & Access Roles</h2>
          </div>

          @if (users().length === 0) {
            <kf-empty-state
              icon="people_outline"
              title="No users registered"
              message="No registered users found on the platform."
            ></kf-empty-state>
          } @else {
            <table mat-table [dataSource]="users()" class="kf-full-width">
              <ng-container matColumnDef="fullName">
                <th mat-header-cell *matHeaderCellDef>Full Name</th>
                <td mat-cell *matCellDef="let user" style="font-weight: 500;">{{ user.fullName }}</td>
              </ng-container>

              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef>Email</th>
                <td mat-cell *matCellDef="let user">
                  <span class="email-container">
                    <mat-icon style="font-size: 16px; width: 16px; height: 16px; margin-right: 4px; vertical-align: middle; color: rgba(0,0,0,0.5);">email</mat-icon>
                    {{ user.email }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="role">
                <th mat-header-cell *matHeaderCellDef>System Role</th>
                <td mat-cell *matCellDef="let user">
                  <span [class]="'system-role-badge ' + (user.role === 'ADMIN' ? 'role-admin' : 'role-member')">
                    {{ user.role }}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="memberships">
                <th mat-header-cell *matHeaderCellDef>Company Memberships & Roles</th>
                <td mat-cell *matCellDef="let user">
                  <div class="membership-list">
                    @if (user.memberships.length === 0) {
                      <span class="no-membership">No active company associations</span>
                    } @else {
                      @for (membership of user.memberships; track membership.organizationId) {
                        <mat-chip class="org-membership-chip">
                          <span class="org-name">{{ membership.organizationName }}</span>
                          <span class="org-role">{{ membership.role }}</span>
                        </mat-chip>
                      }
                    }
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef>Joined At</th>
                <td mat-cell *matCellDef="let user">{{ user.createdAt | date: 'mediumDate' }}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          }
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .kf-page-subtitle {
      color: rgba(0, 0, 0, 0.6);
      font-size: 14px;
      margin-top: 4px;
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

    .admin-table-card {
      padding: 0;
      overflow: hidden;
    }

    .admin-table-header {
      padding: 20px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .admin-table-header h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .email-container {
      display: flex;
      align-items: center;
    }

    .system-role-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .role-admin {
      background-color: #ede7f6;
      color: #512da8;
    }

    .role-member {
      background-color: #e3f2fd;
      color: #0d47a1;
    }

    .membership-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 4px 0;
    }

    .no-membership {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.4);
      font-style: italic;
    }

    .org-membership-chip {
      height: auto !important;
      padding: 4px 10px !important;
      background-color: #f5f5f5 !important;
      border: 1px solid rgba(0, 0, 0, 0.06);
    }

    .org-name {
      font-weight: 500;
      margin-right: 6px;
    }

    .org-role {
      font-size: 10px;
      font-weight: 700;
      background-color: rgba(63, 81, 181, 0.1);
      color: #3f51b5;
      padding: 1px 5px;
      border-radius: 4px;
      text-transform: uppercase;
    }
  `],
})
export class AdminConsoleComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  loading = signal(true);
  summary = signal<PlatformUsageSummary | null>(null);
  users = signal<UserSummary[]>([]);

  displayedColumns = ['fullName', 'email', 'role', 'memberships', 'createdAt'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.adminService.getPlatformUsageSummary().subscribe({
      next: (summaryData) => {
        this.summary.set(summaryData);
        this.adminService.getUsers().subscribe({
          next: (usersData) => {
            this.users.set(usersData);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }
}
