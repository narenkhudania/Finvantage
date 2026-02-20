const DEFAULT_COUNTRY = 'India';

type CurrencyConfig = {
  code: string;
  symbol: string;
  locale: string;
};

const COUNTRY_CURRENCY_MAP: Record<string, CurrencyConfig> = {
  india: { code: 'INR', symbol: '₹', locale: 'en-IN' },
  'united states': { code: 'USD', symbol: '$', locale: 'en-US' },
  usa: { code: 'USD', symbol: '$', locale: 'en-US' },
  us: { code: 'USD', symbol: '$', locale: 'en-US' },
  'united kingdom': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  uk: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  'great britain': { code: 'GBP', symbol: '£', locale: 'en-GB' },
  canada: { code: 'CAD', symbol: '$', locale: 'en-CA' },
  australia: { code: 'AUD', symbol: '$', locale: 'en-AU' },
  singapore: { code: 'SGD', symbol: '$', locale: 'en-SG' },
  uae: { code: 'AED', symbol: 'د.إ', locale: 'en-AE' },
  'united arab emirates': { code: 'AED', symbol: 'د.إ', locale: 'en-AE' },
};

let activeCountry = DEFAULT_COUNTRY;

const normalizeCountry = (country?: string) => (country || '').trim().toLowerCase();

export const setActiveCountry = (country?: string) => {
  const trimmed = (country || '').trim();
  activeCountry = trimmed || DEFAULT_COUNTRY;
};

export const getCurrencyConfig = (country?: string): CurrencyConfig => {
  const normalized = normalizeCountry(country || activeCountry);
  if (normalized.length === 2) {
    if (normalized === 'us') return COUNTRY_CURRENCY_MAP.us;
    if (normalized === 'uk') return COUNTRY_CURRENCY_MAP.uk;
    if (normalized === 'ae') return COUNTRY_CURRENCY_MAP.uae;
    if (normalized === 'ca') return COUNTRY_CURRENCY_MAP.canada;
    if (normalized === 'au') return COUNTRY_CURRENCY_MAP.australia;
    if (normalized === 'sg') return COUNTRY_CURRENCY_MAP.singapore;
    if (normalized === 'in') return COUNTRY_CURRENCY_MAP.india;
  }
  return COUNTRY_CURRENCY_MAP[normalized] || COUNTRY_CURRENCY_MAP.india;
};

export const getCurrencySymbol = (country?: string) => getCurrencyConfig(country).symbol;

export const formatCurrency = (
  amount: number,
  country?: string,
  options: Intl.NumberFormatOptions = {}
) => {
  const { code, symbol, locale } = getCurrencyConfig(country);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
      ...options,
    }).format(safeAmount);
  } catch {
    return `${symbol}${safeAmount.toLocaleString()}`;
  }
};
