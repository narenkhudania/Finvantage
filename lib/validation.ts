const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  '12345678',
  '123456789',
  'qwerty123',
  'qwertyui',
  'admin123',
  'letmein',
  'welcome',
]);

export const normalizeIdentifier = (identifier: string) => {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return { type: 'email' as const, value: trimmed.toLowerCase() };
  }
  const digits = trimmed.replace(/\D/g, '');
  return { type: 'phone' as const, value: digits };
};

export const isValidEmail = (value: string) => {
  const trimmed = value.trim();
  return /^\S+@\S+\.\S+$/.test(trimmed);
};

export const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

export const isStrongPassword = (value: string) => {
  if (value.length < 8) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  return !COMMON_WEAK_PASSWORDS.has(value.toLowerCase());
};

export const parseNumber = (value: number | string, fallback = 0) => {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
};

export const clampNumber = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

export const isValidDate = (value: string) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

export const isFutureDate = (value: string) => {
  if (!isValidDate(value)) return false;
  const date = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today;
};

export const calculateAge = (dob: string) => {
  if (!isValidDate(dob)) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

export const isValidIndiaPincode = (value: string) => {
  return /^\d{6}$/.test(value.trim());
};
