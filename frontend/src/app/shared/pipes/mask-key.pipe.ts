import { Pipe, PipeTransform } from '@angular/core';

/**
 * Masks a key prefix for display in tables, e.g. "kf_live_ab12" -> "kf_live_ab12••••••••".
 * Used across the API Keys list and key detail views.
 */
@Pipe({
  name: 'maskKey',
  standalone: true,
})
export class MaskKeyPipe implements PipeTransform {
  transform(keyPrefix: string | null | undefined): string {
    if (!keyPrefix) {
      return '';
    }
    return `${keyPrefix}${'•'.repeat(8)}`;
  }
}
