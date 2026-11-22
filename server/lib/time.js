export function nowIso() {
  return new Date().toISOString();
}

export function toDateOnly(date = new Date()) {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

export function addDays(dateOrIso, days) {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : new Date(dateOrIso.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isExpired(expiresAtIso, referenceDate = new Date()) {
  const expiresAt = new Date(expiresAtIso).getTime();
  const ref = referenceDate instanceof Date ? referenceDate.getTime() : new Date(referenceDate).getTime();
  return expiresAt <= ref;
}
