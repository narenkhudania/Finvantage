const normalizeSegment = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);

export const getClientDeviceFingerprint = (): string => {
  if (typeof window === 'undefined') return '';

  try {
    const nav = window.navigator;
    const scr = window.screen;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const pieces = [
      normalizeSegment(nav.userAgent),
      normalizeSegment(nav.platform),
      normalizeSegment(nav.language),
      normalizeSegment(String(nav.hardwareConcurrency || '')),
      normalizeSegment(String(scr?.width || '')),
      normalizeSegment(String(scr?.height || '')),
      normalizeSegment(String(scr?.colorDepth || '')),
      normalizeSegment(timezone),
    ].filter(Boolean);

    return pieces.join('|').slice(0, 320);
  } catch {
    return '';
  }
};
