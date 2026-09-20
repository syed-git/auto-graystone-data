const pad = (n) => String(n).padStart(2, '0');

/** Formats a Date as MM-DD-YYYY (the AutoGraystone date format). */
export function toGraystoneDate(date) {
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`;
}

/**
 * Parses MM-DD-YYYY, MM/DD/YYYY, YYYY-MM-DD, YYYY/MM/DD or an ISO timestamp
 * (2026-09-20T00:00:00.000Z) into a local Date. Returns null when the text is not
 * a real calendar date.
 */
export function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  let year;
  let month;
  let day;

  let match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T.*)?$/);
  if (match) [, year, month, day] = match;
  else {
    match = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!match) return null;
    [, month, day, year] = match;
  }

  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const valid = date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
  return valid ? date : null;
}

/** Normalises any supported date text into MM-DD-YYYY, or null when invalid. */
export function normalizeDate(value) {
  const date = parseDate(value);
  return date ? toGraystoneDate(date) : null;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
