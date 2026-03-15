export function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function scoreColor(s) {
  if (s >= 71) return '#276749';
  if (s >= 41) return '#C05621';
  return '#9B2335';
}

export function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s);
}
