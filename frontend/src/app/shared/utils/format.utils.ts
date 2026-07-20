/**
 * Small formatting helpers used in the key reveal screen and a couple of
 * table cells. Kept as plain functions (rather than pipes) here since they're
 * also used from component TS code directly (e.g. for clipboard text), not
 * just templates.
 */

export function maskApiKeyDisplay(keyPrefix: string): string {
  if (!keyPrefix) {
    return '';
  }
  // Shows the prefix followed by a fixed run of asterisks - intentionally
  // shorter than MaskKeyPipe's masked suffix since this is used in tighter
  // table cells where the pipe's version wraps awkwardly.
  return `${keyPrefix}****`;
}

export function formatRelativeDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return 'Never';
  }
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
