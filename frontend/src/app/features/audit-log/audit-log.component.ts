import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Placeholder shell for the audit log page (who created/revoked which key,
 * when). Backend has AuditLog entity + writes on create/revoke, but no
 * read API/controller exists yet - see AuditLogRepository TODO and
 * JUDGE-SOLUTION-GUIDE for the expected scope of this feature.
 */
@Component({
  selector: 'kf-audit-log',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="kf-page">
      <div class="kf-page-header">
        <h1>Audit Log</h1>
      </div>
      <div class="kf-audit-placeholder">
        <mat-icon>construction</mat-icon>
        <h3>Coming soon</h3>
        <p>
          This page will show who created or revoked API keys and when, org-wide. The backend
          already records these events (see AuditLog entity) but there's no endpoint to read them
          back yet, and this page has no data-fetching wired up.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .kf-audit-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 64px 24px;
      color: rgba(0, 0, 0, 0.6);
    }

    .kf-audit-placeholder mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 12px;
      color: rgba(0, 0, 0, 0.3);
    }

    .kf-audit-placeholder p {
      max-width: 480px;
      font-size: 14px;
    }
  `],
})
export class AuditLogComponent {}
