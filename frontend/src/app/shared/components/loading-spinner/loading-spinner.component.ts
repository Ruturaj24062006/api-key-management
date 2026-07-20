import { Component, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'kf-loading-spinner',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="kf-loading-spinner" [style.padding.px]="padding()">
      <mat-spinner [diameter]="diameter()"></mat-spinner>
      @if (label()) {
        <span class="kf-loading-spinner__label">{{ label() }}</span>
      }
    </div>
  `,
  styles: [`
    .kf-loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
    }

    .kf-loading-spinner__label {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.6);
    }
  `],
})
export class LoadingSpinnerComponent {
  diameter = input<number>(40);
  padding = input<number>(48);
  label = input<string>('');
}
