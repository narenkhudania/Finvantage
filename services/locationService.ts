const baseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export interface GeoLookupResult {
  city: string;
  state: string;
  countryCode?: string;
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  india: 'IN',
  'united states': 'US',
  usa: 'US',
  us: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  canada: 'CA',
  australia: 'AU',
  singapore: 'SG',
  uae: 'AE',
  'united arab emirates': 'AE',
};

const normalizeCountryCode = (country: string) => {
  const trimmed = country.trim().toLowerCase();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return COUNTRY_CODE_MAP[trimmed] || '';
};

const lookupDirect = async (country: string, postal: string): Promise<GeoLookupResult> => {
  const countryCode = normalizeCountryCode(country);
  if (!countryCode) {
    throw new Error('Unsupported country for auto-location.');
  }

  let city = '';
  let state = '';

  if (countryCode === 'IN') {
    const indiaRes = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(postal)}`);
    if (indiaRes.ok) {
      const indiaData = await indiaRes.json();
      const entry = Array.isArray(indiaData) ? indiaData[0] : null;
      const office = entry?.PostOffice?.[0];
      if (entry?.Status === 'Success' && office) {
        city = office.District || office.Division || office.Name || '';
        state = office.State || '';
      }
    }
  }

  if (!city || !state) {
    const zipRes = await fetch(`https://api.zippopotam.us/${countryCode}/${encodeURIComponent(postal)}`);
    if (zipRes.ok) {
      const zipData = await zipRes.json();
      const place = zipData?.places?.[0];
      if (place) {
        city = city || place['place name'] || '';
        state = state || place['state'] || place['state abbreviation'] || '';
      }
    }
  }

  if (!city && !state) {
    throw new Error('Postal code not found.');
  }

  return { city, state, countryCode };
};

export const lookupPostalCode = async (country: string, postal: string): Promise<GeoLookupResult> => {
  const isDev = import.meta.env.DEV;
  if (isDev && !baseUrl) {
    return lookupDirect(country, postal);
  }

  const response = await fetch(
    `${baseUrl}/api/geo-lookup?country=${encodeURIComponent(country)}&postal=${encodeURIComponent(postal)}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw new Error(errorPayload?.error || "Unable to fetch location from postal code.");
  }

  try {
    return (await response.json()) as GeoLookupResult;
  } catch (err) {
    if (isDev) {
      return lookupDirect(country, postal);
    }
    throw new Error('Location service returned an unexpected response.');
  }
};
