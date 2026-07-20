import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface KeyCreatedDialogData {
  fullKey: string;
  keyName: string;
}

@Component({
  selector: 'kf-key-created-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>API Key Created</h2>
    <mat-dialog-content>
      <div class="kf-warning-banner">
        <mat-icon>warning</mat-icon>
        <span>Copy this key now. For your security, you won't be able to see it again.</span>
      </div>

      <p class="kf-key-name">{{ data.keyName }}</p>

      <div class="kf-key-reveal">
        <code>{{ data.fullKey }}</code>
        <button mat-icon-button (click)="copyToClipboard()" aria-label="Copy key">
          <mat-icon>content_copy</mat-icon>
        </button>
      </div>

      @if (copied()) {
        <div class="kf-copy-confirmation">Copied to clipboard</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" (click)="dialogRef.close()">Done</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .kf-warning-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #fff3e0;
      color: #a66300;
      padding: 12px 14px;
      border-radius: 4px;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .kf-key-name {
      font-weight: 600;
      margin: 0 0 8px 0;
    }

    .kf-key-reveal {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #1a1d24;
      color: #e0e0e0;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: 'Roboto Mono', monospace;
      font-size: 13px;
      word-break: break-all;
    }

    .kf-key-reveal code {
      flex: 1;
      margin-right: 12px;
    }

    .kf-key-reveal button {
      color: #e0e0e0;
    }

    .kf-copy-confirmation {
      margin-top: 8px;
      font-size: 12px;
      color: #2e7d32;
    }
  `],
})
export class KeyCreatedDialogComponent {
  protected readonly dialogRef = inject(MatDialogRef<KeyCreatedDialogComponent>);
  protected readonly data = inject<KeyCreatedDialogData>(MAT_DIALOG_DATA);

  copied = signal(false);

  copyToClipboard(): void {
    // navigator.clipboard.writeText() returns a rejected promise on
    // insecure contexts / when the browser denies clipboard permission -
    // that rejection isn't handled here, so a failed copy just does nothing
    // instead of telling the user it didn't work.
    navigator.clipboard.writeText(this.data.fullKey).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }
}
