import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiKeyService } from '../../../core/services/api-key.service';
import { SessionStateService } from '../../../core/state/session-state.service';
import { ApiKey } from '../../../core/models/api-key.model';
import { MaskKeyPipe } from '../../../shared/pipes/mask-key.pipe';
import { CreateApiKeyDialogComponent } from '../create-api-key-dialog/create-api-key-dialog.component';
import { KeyCreatedDialogComponent } from '../key-created-dialog/key-created-dialog.component';

@Component({
  selector: 'kf-api-key-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatPaginatorModule,
    MatTooltipModule,
    MaskKeyPipe,
  ],
  template: `
    <!-- Spacing/typography here is hand-rolled rather than using the shared
         .kf-page / .kf-page-header conventions used on the other pages -
         should probably be reconciled at some point. -->
    <div style="padding: 20px 30px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 18px;">
        <h2 style="font-size:20px; margin:0;">API Keys</h2>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>vpn_key</mat-icon>
          Create API Key
        </button>
      </div>

      <table mat-table [dataSource]="keys()" style="width:100%; margin-bottom: 8px;" class="mat-elevation-z1">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Name</th>
          <td mat-cell *matCellDef="let key">{{ key.name }}</td>
        </ng-container>

        <ng-container matColumnDef="prefix">
          <th mat-header-cell *matHeaderCellDef>Key</th>
          <td mat-cell *matCellDef="let key"><code>{{ key.keyPrefix | maskKey }}</code></td>
        </ng-container>

        <ng-container matColumnDef="scopes">
          <th mat-header-cell *matHeaderCellDef>Scopes</th>
          <td mat-cell *matCellDef="let key">
            @for (scope of key.scopes; track scope) {
              <mat-chip class="kf-scope-chip">{{ scope }}</mat-chip>
            }
          </td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let key">
            <mat-chip [class]="statusChipClass(key.status)">{{ key.status }}</mat-chip>
          </td>
        </ng-container>

        <ng-container matColumnDef="rateLimit">
          <th mat-header-cell *matHeaderCellDef>Rate Limit</th>
          <td mat-cell *matCellDef="let key">{{ key.rateLimitPerMinute }}/min</td>
        </ng-container>

        <ng-container matColumnDef="lastUsed">
          <th mat-header-cell *matHeaderCellDef>Last Used</th>
          <td mat-cell *matCellDef="let key">{{ key.lastUsedAt ? (key.lastUsedAt | date: 'short') : 'Never' }}</td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let key">
            <button
              mat-icon-button
              matTooltip="Revoke key"
              [disabled]="key.status !== 'ACTIVE'"
              (click)="revokeKey(key)"
            >
              <mat-icon>block</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Rotate key (coming soon)" (click)="rotateKey(key)">
              <mat-icon>autorenew</mat-icon>
            </button>
            <button mat-icon-button matTooltip="View usage analytics" (click)="viewAnalytics(key)">
              <mat-icon>insights</mat-icon>
            </button>
          </td>
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
    </div>
  `,
  styles: [`
    .kf-scope-chip {
      font-size: 11px;
      margin-right: 4px;
    }
  `],
})
export class ApiKeyListComponent implements OnInit {
  private readonly apiKeyService = inject(ApiKeyService);
  private readonly sessionState = inject(SessionStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  keys = signal<ApiKey[]>([]);
  totalElements = signal(0);
  pageSize = signal(10);
  pageIndex = signal(0);
  displayedColumns = ['name', 'prefix', 'scopes', 'status', 'rateLimit', 'lastUsed', 'actions'];

  private projectId!: string;

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('projectId')!;
    this.load();
  }

  load(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) return;

    // NOTE: no loading signal / spinner here - the table just appears empty
    // until the request resolves. Fine on localhost, noticeable over a real
    // network.
    this.apiKeyService.list(orgId, this.projectId, this.pageIndex(), this.pageSize()).subscribe((page) => {
      this.keys.set(page.content);
      this.totalElements.set(page.totalElements);
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  statusChipClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'kf-status-chip-active';
      case 'REVOKED':
        return 'kf-status-chip-revoked';
      case 'EXPIRED':
        return 'kf-status-chip-expired';
      default:
        return '';
    }
  }

  openCreateDialog(): void {
    const orgId = this.sessionState.currentOrgId();
    if (!orgId) return;

    const ref = this.dialog.open(CreateApiKeyDialogComponent, {
      width: '520px',
      data: { organizationId: orgId, projectId: this.projectId },
    });

    ref.afterClosed().subscribe((created) => {
      if (created?.fullKey) {
        this.dialog.open(KeyCreatedDialogComponent, {
          width: '520px',
          disableClose: true,
          data: { fullKey: created.fullKey, keyName: created.apiKey.name },
        });
        this.load();
      }
    });
  }

  revokeKey(key: ApiKey): void {
    if (!confirm(`Revoke "${key.name}"? This cannot be undone and any client using it will stop working immediately.`)) {
      return;
    }
    this.apiKeyService.revoke(key.id).subscribe(() => {
      this.snackBar.open('API key revoked', 'Dismiss', { duration: 3000 });
      this.load();
    });
  }

  rotateKey(_key: ApiKey): void {
    this.snackBar.open('Key rotation is coming soon', 'Dismiss', { duration: 3000 });
  }

  viewAnalytics(key: ApiKey): void {
    this.router.navigate(['/projects', this.projectId, 'keys', key.id, 'analytics']);
  }
}
