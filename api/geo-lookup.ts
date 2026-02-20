type RequestLike = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (payload: unknown) => void;
};

const COUNTRY_MAP: Record<string, string> = {
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
  return COUNTRY_MAP[trimmed] || '';
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const countryRaw = Array.isArray(req.query?.country)
    ? req.query?.country?.[0]
    : req.query?.country;
  const postalRaw = Array.isArray(req.query?.postal)
    ? req.query?.postal?.[0]
    : req.query?.postal;

  const country = (countryRaw || '').toString();
  const postal = (postalRaw || '').toString().trim();

  if (!country || !postal) {
    res.status(400).json({ error: 'Country and postal code are required.' });
    return;
  }

  const countryCode = normalizeCountryCode(country);
  if (!countryCode) {
    res.status(400).json({ error: 'Unsupported country for auto-location.' });
    return;
  }

  let city = '';
  let state = '';

  try {
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to lookup postal code.' });
    return;
  }

  if (!city && !state) {
    res.status(404).json({ error: 'Postal code not found.' });
    return;
  }

  res.status(200).json({ city, state, countryCode });
}
