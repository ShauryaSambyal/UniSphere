/**
 * AICTE-sourced values arrive in ALL CAPS (e.g. "BANGALORE URBAN"). Display
 * them in Title Case while keeping the raw value for API filters.
 */
export function prettyLabel(value) {
  if (typeof value !== 'string' || value.length === 0) return value;

  const isAllCaps = value === value.toUpperCase() && /[A-Z]/.test(value);
  if (!isAllCaps) return value;

  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

/**
 * Renders a college location for display. Open-dataset rows do not always
 * carry a city or state, so fall back gracefully instead of printing
 * ", " or "undefined".
 */
export function locationLabel(location) {
  const city = prettyLabel(location?.city || '');
  const state = prettyLabel(location?.state || '');

  const parts = [city, state].filter((part) => typeof part === 'string' && part.trim());
  return parts.length > 0 ? parts.join(', ') : 'India';
}

/** "Unranked" reads better than the #999 sentinel used for open-data rows. */
export function rankLabel(value) {
  const rank = Number(value);
  return Number.isFinite(rank) && rank > 0 && rank < 999 ? `#${rank}` : 'Unranked';
}

/**
 * NIRF label for a college. Exact ranks (top 100 per category) win; otherwise
 * the published rank band (101-150, 151-200, 201-300) is reported, which is
 * what NIRF itself discloses for those institutions. Falls back to the legacy
 * numeric field for rows without an NIRF record.
 */
export function nirfLabel(college) {
  const best = Number(college?.nirf?.bestRank);
  if (Number.isFinite(best) && best > 0) return `#${best}`;

  const band = college?.nirf?.bands?.[0]?.band;
  if (band) return `Band ${String(band).replace('-', '–')}`;

  return rankLabel(college?.ranking?.nirf ?? college?.nirfRanking);
}

/** True when the college carries any NIRF evidence (exact rank or band). */
export function hasNirf(college) {
  if (college?.nirf && (college.nirf.bestRank || college.nirf.bands?.length > 0)) return true;
  const legacy = Number(college?.ranking?.nirf ?? college?.nirfRanking);
  return Number.isFinite(legacy) && legacy > 0 && legacy < 999;
}

/** "₹19.6 L", "₹1.5 Cr", "₹85,000" — for NIRF rupee figures. */
export function formatRupees(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2).replace(/\.?0+$/, '')} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2).replace(/\.?0+$/, '')} L`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Human-friendly "3 hours ago" label for dataset freshness stamps. */
export function timeAgo(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Date(value).toLocaleDateString();
}
