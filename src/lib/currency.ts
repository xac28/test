// Mock exchange rates against USD. In production these would come from an API.
// Last updated: example values.
const USD_RATES: Record<string, { rate: number; symbol: string; code: string }> = {
  US: { rate: 1, symbol: '$', code: 'USD' },
  TR: { rate: 32.5, symbol: '₺', code: 'TRY' },
  GB: { rate: 0.79, symbol: '£', code: 'GBP' },
  DE: { rate: 0.92, symbol: '€', code: 'EUR' },
  FR: { rate: 0.92, symbol: '€', code: 'EUR' },
  IN: { rate: 83.5, symbol: '₹', code: 'INR' },
  JP: { rate: 155, symbol: '¥', code: 'JPY' },
  BR: { rate: 5.1, symbol: 'R$', code: 'BRL' },
};

export function detectCountry(): string {
  if (typeof window === 'undefined') return 'US';
  const stored = localStorage.getItem('namaste-country');
  if (stored) return stored;
  // Fallback: locale-based guess
  const lang = navigator.language || 'en-US';
  const region = lang.split('-')[1]?.toUpperCase();
  return region && USD_RATES[region] ? region : 'US';
}

export function setCountry(country: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('namaste-country', country);
  }
}

export function formatLocalPrice(usdAmount: number, country?: string): string {
  const c = country ?? detectCountry();
  const info = USD_RATES[c] ?? USD_RATES.US;
  const amount = usdAmount * info.rate;
  const rounded = info.code === 'JPY' ? Math.round(amount) : Math.round(amount * 100) / 100;
  const formatted = info.code === 'JPY' ? rounded.toLocaleString() : rounded.toFixed(2);
  return `${info.symbol}${formatted}`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function localCurrencyCode(country?: string): string {
  const c = country ?? detectCountry();
  return USD_RATES[c]?.code ?? 'USD';
}
