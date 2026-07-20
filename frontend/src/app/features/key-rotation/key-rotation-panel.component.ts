import { Component, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiKeyService } from '../../core/services/api-key.service';

/**
 * Early draft of an inline key-rotation panel (as opposed to the
 * tooltip/snackbar stub currently wired up in ApiKeyListComponent). Built
 * against the /keys/{id}/rotate endpoint before that endpoint was confirmed
 * to return 501 - not currently routed or imported anywhere. Left in place
 * since the rotation UI work in JUDGE-SOLUTION-GUIDE may want to start from
 * here instead of from scratch.
 */
@Component({
  selector: 'kf-key-rotation-panel',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <mat-card class="kf-rotation-panel">
      <h3>Rotate this key</h3>
      <p>
        Generates a new key and keeps the current one valid for a grace period so in-flight
        clients don't break immediately.
      </p>
      @if (error()) {
        <div class="kf-rotation-panel__error">{{ error() }}</div>
      }
      <button mat-flat-button color="primary" (click)="rotate()" [disabled]="loading()">
        <mat-icon>autorenew</mat-icon>
        Rotate Key
      </button>
    </mat-card>
  `,
  styles: [`
    .kf-rotation-panel {
      padding: 16px;
    }

    .kf-rotation-panel__error {
      color: #b3261e;
      font-size: 12px;
      margin-bottom: 8px;
    }
  `],
})
export class KeyRotationPanelComponent {
  private readonly apiKeyService = inject(ApiKeyService);

  apiKeyId = input.required<string>();
  loading = signal(false);
  error = signal<string | null>(null);

  rotate(): void {
    this.loading.set(true);
    this.error.set(null);
    this.apiKeyService.rotate(this.apiKeyId()).subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.loading.set(false);
        this.error.set('Key rotation is not available yet.');
      },
    });
  }
}
