import { Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'kf-empty-state',
  standalone: true,
  imports: [MatIconModule, MatButtonModule],
  template: `
    <div class="kf-empty-state">
      <mat-icon class="kf-empty-state__icon">{{ icon() }}</mat-icon>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      @if (actionLabel()) {
        <button mat-flat-button color="primary" (click)="actionClicked.emit()">
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [`
    .kf-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 64px 24px;
      color: rgba(0, 0, 0, 0.6);
    }

    .kf-empty-state__icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      color: rgba(0, 0, 0, 0.3);
    }

    h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.87);
    }

    p {
      margin: 0 0 20px 0;
      font-size: 14px;
      max-width: 360px;
    }
  `],
})
export class EmptyStateComponent {
  icon = input<string>('inbox');
  title = input<string>('Nothing here yet');
  message = input<string>('');
  actionLabel = input<string | null>(null);

  actionClicked = output<void>();
}
