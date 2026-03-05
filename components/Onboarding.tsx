import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FinanceState, IncomeSource } from '../types';
import {
  ArrowRight,
  User,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Zap,
  ChevronRight,
  BrainCircuit,
  Lock,
  Key,
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import {
  checkIdentifier,
  signUp,
  signIn,
  saveOnboardingProfile,
} from '../services/authService';
import { supabase } from '../services/supabase';
import {
  calculateAge,
  isFutureDate,
  isStrongPassword,
  isValidEmail,
  isValidIndiaPincode,
} from '../lib/validation';
import { lookupPostalCode } from '../services/locationService';

interface OnboardingProps {
  onComplete: (data: Partial<FinanceState>) => void;
  onBackToLanding?: () => void;
  initialAuthStep?: 'identifier' | 'login' | 'signup' | 'onboarding';
  resumeProfile?: Partial<FinanceState['profile']>;
}

type AuthStep = 'identifier' | 'login' | 'signup' | 'onboarding';
type MotionDirection = 'forward' | 'backward';
type DobParts = { year: string; month: string; day: string };

const normalizeReferralCode = (value?: string) => String(value || '').trim().toUpperCase();
const DEFAULT_PHONE_COUNTRY_CODE = '+91';
const normalizePhoneDigits = (value?: string) => String(value || '').replace(/\D/g, '');
const parsePhoneParts = (value?: string) => {
  const compact = String(value || '').trim().replace(/[\s-]/g, '');
  const exact = compact.match(/^(\+\d{1,4})(\d{4,15})$/);
  if (exact) {
    return {
      countryCode: exact[1],
      phone: exact[2],
    };
  }
  return {
    countryCode: DEFAULT_PHONE_COUNTRY_CODE,
    phone: normalizePhoneDigits(compact).slice(0, 15),
  };
};

const normalizeIncomeSource = (value?: string | null): IncomeSource => (
  value === 'business' ? 'business' : 'salaried'
);

const parseNonNegativeAmount = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const EMPTY_DOB_PARTS: DobParts = { year: '', month: '', day: '' };

const parseDobToParts = (dob?: string) => {
  const match = String(dob || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return EMPTY_DOB_PARTS;
  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
};

const pad2 = (value: number) => String(value).padStart(2, '0');

const composeDobFromParts = (parts: DobParts) => {
  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);
  if (!day || !month || !year) return '';
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const DOB_MONTH_OPTIONS = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

const PHONE_COUNTRY_CODE_OPTIONS = [
  { value: '+91', label: 'India (+91)' },
  { value: '+1', label: 'USA/Canada (+1)' },
  { value: '+44', label: 'UK (+44)' },
  { value: '+61', label: 'Australia (+61)' },
  { value: '+65', label: 'Singapore (+65)' },
  { value: '+971', label: 'UAE (+971)' },
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onBackToLanding, initialAuthStep, resumeProfile }) => {
  const initialPhone = useMemo(() => parsePhoneParts(resumeProfile?.mobile || ''), [resumeProfile?.mobile]);
  const initialReferralCodeFromUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const queryCode = new URLSearchParams(window.location.search).get('ref') || '';
    return normalizeReferralCode(queryCode);
  }, []);
  const [authStep, setAuthStep] = useState<AuthStep>(initialAuthStep ?? 'identifier');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [motionDirection, setMotionDirection] = useState<MotionDirection>('forward');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [geoStatus, setGeoStatus] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [openUsageKey, setOpenUsageKey] = useState<string | null>(null);
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loggedInFirstName, setLoggedInFirstName] = useState('');

  const [formData, setFormData] = useState({
    identifier: resumeProfile?.email || resumeProfile?.mobile || '',
    password: '',
    confirmPassword: '',
    firstName: resumeProfile?.firstName || '',
    lastName: resumeProfile?.lastName || '',
    dob: resumeProfile?.dob || '',
    lifeExpectancy: resumeProfile?.lifeExpectancy ?? 85,
    retirementAge: resumeProfile?.retirementAge ?? 60,
    pincode: resumeProfile?.pincode || '',
    city: resumeProfile?.city || '',
    state: resumeProfile?.state || '',
    country: resumeProfile?.country || 'India',
    incomeSource: normalizeIncomeSource(resumeProfile?.incomeSource as string | undefined),
    phoneCountryCode: PHONE_COUNTRY_CODE_OPTIONS.some((option) => option.value === initialPhone.countryCode)
      ? initialPhone.countryCode
      : DEFAULT_PHONE_COUNTRY_CODE,
    phoneNumber: initialPhone.phone,
    hasReferralCode: Boolean(initialReferralCodeFromUrl),
    referralCode: initialReferralCodeFromUrl,
    hasTermInsurance: false,
    termInsuranceAmount: 0,
    hasHealthInsurance: false,
    healthInsuranceAmount: 0,
  });
  const [dobParts, setDobParts] = useState(() => parseDobToParts(resumeProfile?.dob || ''));

  const EMAIL_DOMAINS = [
    'gmail.com',
    'outlook.com',
    'yahoo.com',
    'icloud.com',
    'proton.me',
    'zoho.com',
  ];
  const dobYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 100 }, (_, index) => String(currentYear - index));
  }, []);
  const dobDayOptions = useMemo(() => {
    const year = Number(dobParts.year);
    const month = Number(dobParts.month);
    const maxDays = year && month
      ? new Date(year, month, 0).getDate()
      : 31;
    return Array.from({ length: maxDays }, (_, index) => String(index + 1));
  }, [dobParts.month, dobParts.year]);

  const handleDobPartChange = (part: keyof DobParts, value: string) => {
    const nextParts: DobParts = { ...dobParts, [part]: value };
    const year = Number(nextParts.year);
    const month = Number(nextParts.month);
    if (nextParts.day && year && month) {
      const maxDays = new Date(year, month, 0).getDate();
      if (Number(nextParts.day) > maxDays) {
        nextParts.day = String(maxDays);
      }
    }
    setDobParts(nextParts);
    const nextDob = composeDobFromParts(nextParts);
    setFormData(prev => (prev.dob === nextDob ? prev : { ...prev, dob: nextDob }));
    if (error) setError(null);
  };

  const stepConfig = [
    { title: 'Trust', icon: ShieldCheck },
    { title: 'Birth Date', icon: User },
    { title: 'Planning', icon: TrendingUp },
    { title: 'Location', icon: MapPin },
    { title: 'Review', icon: BrainCircuit },
  ];

  const authStepOrder: Record<AuthStep, number> = {
    identifier: 0,
    signup: 1,
    login: 1,
    onboarding: 2,
  };

  const transitionToAuthStep = (nextStep: AuthStep) => {
    setMotionDirection(authStepOrder[nextStep] >= authStepOrder[authStep] ? 'forward' : 'backward');
    setAuthStep(nextStep);
  };

  const transitionToOnboardingStep = (nextStep: number) => {
    const boundedStep = Math.max(0, Math.min(stepConfig.length - 1, nextStep));
    setMotionDirection(boundedStep >= onboardingStep ? 'forward' : 'backward');
    setOnboardingStep(boundedStep);
  };

  useEffect(() => {
    if (initialAuthStep !== 'onboarding') return;

    if (resumeProfile?.firstName) {
      setLoggedInFirstName(resumeProfile.firstName);
    }

    const hasDob = Boolean((resumeProfile?.dob || '').trim());
    const hasPlanning = Number(resumeProfile?.lifeExpectancy) > Number(resumeProfile?.retirementAge);
    const hasLocation = Boolean(
      (resumeProfile?.pincode || '').trim() &&
      (resumeProfile?.city || '').trim() &&
      (resumeProfile?.state || '').trim()
    );

    if (hasLocation) setOnboardingStep(4);
    else if (hasPlanning) setOnboardingStep(3);
    else if (hasDob) setOnboardingStep(2);
    else setOnboardingStep(0);
  }, [initialAuthStep, resumeProfile]);

  const handleProceedIdentifier = async () => {
    const email = formData.identifier.trim().toLowerCase();
    if (!email) return;
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setIsProcessing(true);
    try {
      const exists = await checkIdentifier(email);
      setFormData(prev => ({ ...prev, identifier: email }));
      transitionToAuthStep(exists ? 'login' : 'signup');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignup = async () => {
    const email = formData.identifier.trim().toLowerCase();
    if (!isValidEmail(email)) { setError('Enter a valid email address.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('Passwords do not match.'); return; }
    if (!isStrongPassword(formData.password)) {
      setError('Password must be 8+ chars with letters and numbers, and not a common password.');
      return;
    }
    if (!formData.firstName.trim()) { setError('Name is required.'); return; }
    const phoneDigits = normalizePhoneDigits(formData.phoneNumber);
    if (!phoneDigits) {
      setError('Phone number is required.');
      return;
    }
    if (formData.phoneCountryCode === '+91' && phoneDigits.length !== 10) {
      setError('Enter a valid 10-digit India mobile number.');
      return;
    }
    if (phoneDigits.length < 6 || phoneDigits.length > 15) {
      setError('Enter a valid mobile number.');
      return;
    }
    const referralCode = formData.hasReferralCode ? normalizeReferralCode(formData.referralCode) : '';
    if (formData.hasReferralCode && !referralCode) {
      setError('Enter a valid referral code or turn off the referral toggle.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      await signUp({
        identifier: email,
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim() || undefined,
        phoneCountryCode: formData.phoneCountryCode,
        phoneNumber: phoneDigits,
        referralCode: referralCode || undefined,
      });
      setFormData(prev => ({ ...prev, identifier: email }));
      setLoggedInFirstName(formData.firstName.trim());
      setMotionDirection('forward');
      setAuthStep('onboarding');
      setOnboardingStep(0);
    } catch (e: any) {
      setError(e.message ?? 'Sign-up failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogin = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const email = formData.identifier.trim().toLowerCase();
      if (!isValidEmail(email)) {
        setError('Enter a valid email address.');
        setIsProcessing(false);
        return;
      }

      const profile = await signIn({
        identifier: email,
        password: formData.password,
      });

      const hasCompletedOnboardingData = Boolean(
        profile.dob &&
        Number.isFinite(Number(profile.life_expectancy)) &&
        Number.isFinite(Number(profile.retirement_age)) &&
        Number(profile.life_expectancy) > Number(profile.retirement_age) &&
        Number.isFinite(Number(profile.iq_score)) &&
        Number(profile.iq_score) > 0
      );

      if (!profile.onboarding_done && !hasCompletedOnboardingData) {
        setLoggedInFirstName(profile.first_name);
        setFormData(prev => ({
          ...prev,
          identifier: email,
          firstName: profile.first_name || prev.firstName,
          lastName: profile.last_name ?? prev.lastName,
          dob: profile.dob ?? prev.dob,
          lifeExpectancy: profile.life_expectancy ?? prev.lifeExpectancy,
          retirementAge: profile.retirement_age ?? prev.retirementAge,
          pincode: profile.pincode ?? prev.pincode,
          city: profile.city ?? prev.city,
          state: profile.state ?? prev.state,
          country: profile.country ?? prev.country,
          incomeSource: normalizeIncomeSource(profile.income_source),
        }));

        const hasDob = Boolean((profile.dob ?? '').trim());
        const hasPlanning = Number(profile.life_expectancy) > Number(profile.retirement_age);
        const hasLocation = Boolean(
          (profile.pincode ?? '').trim() &&
          (profile.city ?? '').trim() &&
          (profile.state ?? '').trim()
        );

        setMotionDirection('forward');
        setAuthStep('onboarding');
        if (hasLocation) setOnboardingStep(4);
        else if (hasPlanning) setOnboardingStep(3);
        else if (hasDob) setOnboardingStep(2);
        else setOnboardingStep(0);
        return;
      }

      onComplete({
        isRegistered: true,
        profile: {
          firstName: profile.first_name,
          lastName: profile.last_name ?? '',
          email: email,
          mobile: '',
          dob: profile.dob ?? '',
          lifeExpectancy: profile.life_expectancy,
          retirementAge: profile.retirement_age,
          pincode: profile.pincode ?? '',
          city: profile.city ?? '',
          state: profile.state ?? '',
          country: profile.country,
          incomeSource: normalizeIncomeSource(profile.income_source),
          iqScore: profile.iq_score,
          income: {
            salary: 50000, bonus: 0, reimbursements: 0,
            business: 0, rental: 0, investment: 0, pension: 0, expectedIncrease: 6,
          },
          monthlyExpenses: 20000,
        },
      });
    } catch (e: any) {
      setError(e.message ?? 'Invalid credentials.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    setDobParts(prev => {
      const parsed = parseDobToParts(formData.dob);
      if (
        prev.year === parsed.year &&
        prev.month === parsed.month &&
        prev.day === parsed.day
      ) {
        return prev;
      }
      return parsed;
    });
  }, [formData.dob]);

  const currentAge = useMemo(() => {
    if (!formData.dob) return 30;
    return new Date().getFullYear() - new Date(formData.dob).getFullYear();
  }, [formData.dob]);

  const ageGateError = useMemo(() => {
    if (!formData.dob) return null;
    const age = calculateAge(formData.dob);
    if (age === null) return 'Please enter a valid date of birth.';
    if (isFutureDate(formData.dob)) return 'Date of birth cannot be in the future.';
    if (age < 18) return 'You must be at least 18 years old.';
    if (age > 90) return 'Age must be 90 or below.';
    return null;
  }, [formData.dob]);

  const minLifeExpectancy = useMemo(() => {
    return Math.min(100, Math.max(18, currentAge));
  }, [currentAge]);

  const lifeSpanMax = 100;
  const retirementMax = lifeSpanMax;

  const emailSuggestions = useMemo(() => {
    const value = formData.identifier.trim().toLowerCase();
    const atIndex = value.indexOf('@');
    if (atIndex < 1) return [];
    const local = value.slice(0, atIndex);
    const domainPart = value.slice(atIndex + 1);
    return EMAIL_DOMAINS
      .filter(domain => domain.startsWith(domainPart))
      .map(domain => `${local}@${domain}`);
  }, [formData.identifier]);

  useEffect(() => {
    if (!formData.dob) return;
    if (formData.lifeExpectancy < minLifeExpectancy) {
      setFormData(prev => ({ ...prev, lifeExpectancy: minLifeExpectancy }));
    }
  }, [formData.dob, minLifeExpectancy, formData.lifeExpectancy]);

  useEffect(() => {
    let nextLife = formData.lifeExpectancy;
    let nextRetirement = formData.retirementAge;

    if (nextLife < minLifeExpectancy) nextLife = minLifeExpectancy;
    if (nextLife > lifeSpanMax) nextLife = lifeSpanMax;

    if (nextRetirement < minLifeExpectancy) nextRetirement = minLifeExpectancy;
    if (nextRetirement > retirementMax) nextRetirement = retirementMax;

    if (nextLife <= nextRetirement) {
      if (nextLife < lifeSpanMax) {
        nextLife = Math.min(lifeSpanMax, nextRetirement + 1);
      } else {
        nextRetirement = Math.max(minLifeExpectancy, lifeSpanMax - 1);
      }
    }

    if (nextLife !== formData.lifeExpectancy || nextRetirement !== formData.retirementAge) {
      setFormData(prev => ({
        ...prev,
        lifeExpectancy: nextLife,
        retirementAge: nextRetirement,
      }));
    }
  }, [formData.lifeExpectancy, formData.retirementAge, minLifeExpectancy, retirementMax, lifeSpanMax]);

  useEffect(() => {
    const country = formData.country.trim();
    const postal = formData.pincode.trim();
    const isIndia = country.toLowerCase() === 'india';
    const minPostalLength = isIndia ? 6 : 3;

    if (!postal || postal.length < minPostalLength) {
      if (geoTimer.current) clearTimeout(geoTimer.current);
      setGeoStatus({ loading: false, error: null });
      return;
    }

    if (geoTimer.current) clearTimeout(geoTimer.current);
    geoTimer.current = setTimeout(async () => {
      setGeoStatus({ loading: true, error: null });
      try {
        const result = await lookupPostalCode(country, postal);
        setFormData(prev => ({
          ...prev,
          city: result.city || prev.city,
          state: result.state || prev.state,
        }));
        setGeoStatus({ loading: false, error: null });
      } catch (err: any) {
        setGeoStatus({ loading: false, error: err?.message || 'Unable to auto-fetch city/state.' });
      }
    }, 450);

    return () => {
      if (geoTimer.current) clearTimeout(geoTimer.current);
    };
  }, [formData.country, formData.pincode]);

  const baselineIq = useMemo(() => {
    const age = currentAge;
    const retirementAge = Number(formData.retirementAge) || 0;
    const lifeExpectancy = Number(formData.lifeExpectancy) || 0;
    const horizonToRetire = Math.max(0, retirementAge - age);
    const retirementSpan = Math.max(0, lifeExpectancy - retirementAge);

    let score = 45;

    if (age <= 25) score += 12;
    else if (age <= 35) score += 10;
    else if (age <= 45) score += 8;
    else if (age <= 55) score += 5;
    else if (age <= 65) score += 3;

    if (horizonToRetire >= 30) score += 12;
    else if (horizonToRetire >= 20) score += 9;
    else if (horizonToRetire >= 15) score += 6;
    else if (horizonToRetire >= 10) score += 3;

    if (retirementSpan >= 25) score += 10;
    else if (retirementSpan >= 18) score += 7;
    else if (retirementSpan >= 12) score += 4;
    else if (retirementSpan >= 8) score += 2;

    score += 2;

    if (formData.country.trim()) score += 1;
    if (formData.city.trim()) score += 1;
    if (formData.state.trim()) score += 1;
    if (formData.pincode.trim()) score += 1;

    return Math.min(98, Math.max(40, Math.round(score)));
  }, [formData.country, formData.city, formData.state, formData.pincode, formData.retirementAge, formData.lifeExpectancy, currentAge]);

  const toggleUsage = (key: string) => {
    setOpenUsageKey(prev => prev === key ? null : key);
  };

  const validateDobAndContinue = () => {
    const age = calculateAge(formData.dob);
    if (!formData.dob || age === null) {
      setError('Please enter a valid date of birth.');
      return;
    }
    if (isFutureDate(formData.dob)) {
      setError('Date of birth cannot be in the future.');
      return;
    }
    if (age < 18 || age > 90) {
      setError('Age must be between 18 and 90 to proceed.');
      return;
    }
    setError(null);
    transitionToOnboardingStep(2);
  };

  const handleLocationDecision = (mode: 'share' | 'skip') => {
    if (mode !== 'share') {
      setFormData(prev => ({ ...prev, pincode: '', city: '', state: '' }));
      setError(null);
      transitionToOnboardingStep(4);
      return;
    }

    const country = (formData.country || 'India').trim();
    const pincode = formData.pincode.trim();
    const city = formData.city.trim();
    const state = formData.state.trim();

    if (!pincode || !city || !state) {
      setError('Please complete location fields or choose Not now.');
      return;
    }

    if (country.toLowerCase() === 'india' && !isValidIndiaPincode(pincode)) {
      setError('Enter a valid 6-digit India pincode or choose Not now.');
      return;
    }

    if (country.toLowerCase() !== 'india' && pincode.length < 3) {
      setError('Enter a valid postal code or choose Not now.');
      return;
    }

    setError(null);
    transitionToOnboardingStep(4);
  };

  const handleFinishOnboarding = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const age = calculateAge(formData.dob);
      if (!formData.dob || age === null) {
        setError('Please enter a valid date of birth.');
        setIsProcessing(false);
        return;
      }
      if (isFutureDate(formData.dob)) {
        setError('Date of birth cannot be in the future.');
        setIsProcessing(false);
        return;
      }
      if (age < 18 || age > 90) {
        setError('Age must be between 18 and 90.');
        setIsProcessing(false);
        return;
      }

      const retirementAge = Number(formData.retirementAge);
      const lifeExpectancy = Number(formData.lifeExpectancy);
      if (!Number.isFinite(retirementAge) || retirementAge <= age) {
        setError('Retirement age must be greater than your current age.');
        setIsProcessing(false);
        return;
      }
      if (!Number.isFinite(lifeExpectancy) || lifeExpectancy <= age) {
        setError('Life expectancy must be greater than your current age.');
        setIsProcessing(false);
        return;
      }
      if (lifeExpectancy <= retirementAge) {
        setError('Life expectancy must be greater than retirement age.');
        setIsProcessing(false);
        return;
      }

      const country = (formData.country || 'India').trim();
      const pincode = formData.pincode.trim();
      const city = formData.city.trim();
      const state = formData.state.trim();
      const hasAnyLocationData = Boolean(pincode || city || state);

      if (hasAnyLocationData) {
        if (!pincode || !city || !state) {
          setError('Please complete location fields or clear them to skip for now.');
          setIsProcessing(false);
          return;
        }

        if (country.toLowerCase() === 'india' && !isValidIndiaPincode(pincode)) {
          setError('Enter a valid 6-digit India pincode or remove location for now.');
          setIsProcessing(false);
          return;
        }

        if (country.toLowerCase() !== 'india' && pincode.length < 3) {
          setError('Enter a valid postal code or remove location for now.');
          setIsProcessing(false);
          return;
        }
      }

      const normalizedIncomeSource = normalizeIncomeSource(formData.incomeSource);
      const termInsuranceAmount = formData.hasTermInsurance ? Number(formData.termInsuranceAmount) : 0;
      const healthInsuranceAmount = formData.hasHealthInsurance ? Number(formData.healthInsuranceAmount) : 0;
      if (formData.hasTermInsurance && termInsuranceAmount <= 0) {
        setError('Enter a valid term insurance amount.');
        setIsProcessing(false);
        return;
      }
      if (formData.hasHealthInsurance && healthInsuranceAmount <= 0) {
        setError('Enter a valid health insurance amount.');
        setIsProcessing(false);
        return;
      }

      await saveOnboardingProfile({
        dob: formData.dob,
        lifeExpectancy: Number(formData.lifeExpectancy),
        retirementAge: Number(formData.retirementAge),
        pincode,
        city,
        state,
        country,
        incomeSource: normalizedIncomeSource,
        iqScore: baselineIq,
        termInsuranceAmount,
        healthInsuranceAmount,
      });

      const normalizedEmail = formData.identifier.trim().toLowerCase();
      const normalizedPhone = normalizePhoneDigits(formData.phoneNumber);
      const mobileE164 = normalizedPhone ? `${formData.phoneCountryCode}${normalizedPhone}` : '';

      onComplete({
        isRegistered: true,
        profile: {
          ...formData,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: normalizedEmail,
          mobile: mobileE164,
          lifeExpectancy: Number(formData.lifeExpectancy),
          retirementAge: Number(formData.retirementAge),
          pincode,
          city,
          state,
          country,
          incomeSource: normalizedIncomeSource,
          iqScore: baselineIq,
          income: {
            salary: 0, bonus: 0, reimbursements: 0,
            business: 0, rental: 0, investment: 0, pension: 0, expectedIncrease: 6,
          },
          monthlyExpenses: 0,
        },
        insuranceAnalysis: {
          inflation: 6,
          termInsuranceAmount,
          healthInsuranceAmount,
          liabilityCovers: {},
          goalCovers: {},
          assetCovers: { financial: 50, personal: 0, inheritance: 100 },
          inheritanceValue: 0,
        },
      });

      // Subscription-first entry: wait for auth session persistence before pricing redirect.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) break;
        await supabase.auth.refreshSession().catch(() => undefined);
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 120);
        });
      }
      window.location.href = '/pricing?entry=terminal&skip=1&skip_to=%2F';
    } catch (e: any) {
      setError(e.message ?? 'Failed to save profile. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const completionPct = Math.max(0, Math.min(100, Math.round(((onboardingStep + 1) / stepConfig.length) * 100)));
  const remainingSteps = Math.max(0, stepConfig.length - onboardingStep - 1);
  const estimatedMinutesLeft = Math.max(1, remainingSteps * 2);
  const dobAge = formData.dob ? calculateAge(formData.dob) : null;
  const yearsToRetirement = Math.max(0, Number(formData.retirementAge) - currentAge);
  const yearsInRetirement = Math.max(0, Number(formData.lifeExpectancy) - Number(formData.retirementAge));
  const hasLocationData = Boolean(formData.pincode.trim() && formData.city.trim() && formData.state.trim());
  const panelKey = authStep === 'onboarding' ? `${authStep}-${onboardingStep}` : authStep;
  const panelAnimationClass = motionDirection === 'forward' ? 'onboarding-panel-forward' : 'onboarding-panel-backward';
  const activeOnboardingTitle = stepConfig[onboardingStep]?.title || 'Setup';
  const onboardingNarratives = [
    'Control what is shared before we run any projections.',
    'Required details for age-accurate planning timelines.',
    'Set your planning horizon so recommendations stay realistic.',
    'Optional location context improves local insurance requirement estimates and assumptions.',
    'Review controls and launch your planning workspace.',
  ];
  const activeOnboardingNarrative = onboardingNarratives[onboardingStep] || onboardingNarratives[0];
  const timelineReady = Number(formData.lifeExpectancy) > Number(formData.retirementAge) && Number(formData.retirementAge) > currentAge;
  const reviewChecklist = [
    { label: 'Date of birth', value: formData.dob || 'Missing', complete: Boolean(formData.dob) },
    {
      label: 'Planning timeline',
      value: timelineReady ? `${formData.retirementAge} to ${formData.lifeExpectancy} years` : 'Incomplete',
      complete: timelineReady,
    },
    {
      label: 'Location context',
      value: hasLocationData ? `${formData.city}, ${formData.state}` : 'Skipped (optional)',
      complete: hasLocationData,
    },
    {
      label: 'Insurance snapshot',
      value: (formData.hasTermInsurance || formData.hasHealthInsurance)
        ? `Term: ${formData.hasTermInsurance ? 'Provided' : 'Not provided'} • Health: ${formData.hasHealthInsurance ? 'Provided' : 'Not provided'}`
        : 'Not shared yet',
      complete: formData.hasTermInsurance || formData.hasHealthInsurance,
    },
  ];
  const dataSharingStepLabel = onboardingStep <= 2
    ? 'Step 1 of 2'
    : onboardingStep === 3
      ? 'Step 2 of 2'
      : null;

  return (
    <div className="onboarding-shell min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden text-slate-900">
      <div className="onboarding-aurora onboarding-aurora-one" />
      <div className="onboarding-aurora onboarding-aurora-two" />

      <div className="w-full max-w-4xl flex flex-col items-center gap-2.5 sm:gap-4">
        {authStep === 'onboarding' && (
          <div className="w-full px-1 sm:px-2">
            <div className="rounded-[1.8rem] border border-teal-100/80 bg-white/75 backdrop-blur-xl shadow-[0_24px_80px_-40px_rgba(15,118,110,0.55)] px-4 sm:px-5 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-600">Guided onboarding</p>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-950 mt-0.5 leading-tight">
                    {activeOnboardingTitle} <span className="text-teal-600">{completionPct}% complete</span>
                  </h2>
                  <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1 leading-snug">{activeOnboardingNarrative}</p>
                </div>
                <div className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-teal-700 self-start">
                  ~{estimatedMinutesLeft} min left
                </div>
              </div>

              <div className="mt-2.5">
                <div className="h-1.5 rounded-full bg-teal-100/70 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 transition-all duration-700 onboarding-progress-glow"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-5 gap-1.5 sm:gap-2">
                {stepConfig.map((s, i) => {
                  const isCurrent = onboardingStep === i;
                  const isCompleted = onboardingStep > i;
                  const canJump = i <= onboardingStep;

                  return (
                    <button
                      key={s.title}
                      type="button"
                      onClick={() => {
                        if (!canJump || i === onboardingStep) return;
                        setError(null);
                        transitionToOnboardingStep(i);
                      }}
                      disabled={!canJump}
                      className={`group flex flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 transition-all duration-300 ${
                        canJump ? 'cursor-pointer hover:bg-teal-50/80' : 'cursor-not-allowed'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border transition-all duration-500 ${
                          isCurrent
                            ? 'border-teal-600 bg-teal-600 text-white shadow-lg shadow-teal-200/70'
                            : isCompleted
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-slate-200 bg-white text-slate-400'
                        }`}
                      >
                        <s.icon size={14} />
                      </div>
                      <span
                        className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest transition-colors ${
                          isCurrent || isCompleted ? 'text-teal-700' : 'text-slate-400'
                        }`}
                      >
                        {s.title}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 rounded-xl border border-teal-100 bg-teal-50/80 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-teal-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> End-to-end encryption</span>
                    <span className="text-teal-300">•</span>
                    <span>Industry-standard compliance</span>
                    <span className="text-teal-300">•</span>
                    <span>Data control in Settings</span>
                  </div>
                  <button
                    onClick={() => setShowSecurityDetails(prev => !prev)}
                    className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-teal-700 hover:text-teal-900 transition-colors"
                  >
                    {showSecurityDetails ? 'Show less' : 'Learn more'}
                  </button>
                </div>
                {showSecurityDetails && (
                  <p className="text-xs font-semibold text-slate-700 mt-1.5 onboarding-fade-expand">
                    Data is encrypted in transit and at rest, access is role-restricted, and activity is monitored continuously.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={`w-full ${authStep === 'onboarding' ? 'max-w-3xl' : 'max-w-xl'} bg-white/90 rounded-[2.2rem] sm:rounded-[3rem] shadow-[0_30px_90px_-55px_rgba(15,118,110,0.55)] border border-white/80 overflow-hidden relative backdrop-blur`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-100/60 blur-[100px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-cyan-100/40 blur-[100px] -z-10 rounded-full -translate-x-1/2 translate-y-1/2" />

          <div className="p-7 sm:p-10 lg:p-12 text-left">
            <div key={panelKey} className={panelAnimationClass}>
              {authStep === 'identifier' && (
                <div className="space-y-8 onboarding-stagger">
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                      <ShieldCheck size={12} /> System Gateway
                    </div>
                    {onBackToLanding && (
                      <button
                        type="button"
                        onClick={onBackToLanding}
                        className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-teal-700 transition-colors"
                      >
                        Back to home
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none text-slate-950">
                      Start your
                      <br />
                      <span className="text-teal-600">secure setup.</span>
                    </h1>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      Enter your email to continue. If your email is already registered, we will take you to password login. If not, we will take you to signup.
                    </p>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                      <div>
                        <input
                          type="email"
                          placeholder="you@example.com"
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-600 outline-none font-bold text-base transition-all placeholder:text-slate-300"
                          value={formData.identifier}
                          onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && handleProceedIdentifier()}
                        />
                        {formData.identifier.includes('@') && emailSuggestions.length > 0 && (
                          <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-44 overflow-y-auto">
                            {emailSuggestions.map(suggestion => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, identifier: suggestion }))}
                                className="w-full text-left px-4 py-2 text-sm font-bold text-slate-600 hover:bg-teal-50 hover:text-teal-600 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {error && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                        <AlertCircle size={14} /> {error}
                      </div>
                    )}
                    <button
                      onClick={handleProceedIdentifier}
                      disabled={isProcessing}
                      className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-teal-100 disabled:opacity-60"
                    >
                      {isProcessing ? 'Checking...' : 'Proceed'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}

              {authStep === 'signup' && (
                <div className="space-y-6 onboarding-stagger">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        transitionToAuthStep('identifier');
                        setError(null);
                      }}
                      className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                      <Zap size={12} /> New Identity
                    </div>
                  </div>
                  <h1 className="text-3xl font-black tracking-tighter text-slate-950">Create your secure account</h1>
                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                      <AlertCircle size={14} /> {error}
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                        <input type="text" placeholder="John" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                        <input type="text" placeholder="Doe" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                      <div className="grid grid-cols-[minmax(130px,170px)_1fr] gap-2">
                        <select
                          value={formData.phoneCountryCode}
                          onChange={e => setFormData(prev => ({ ...prev, phoneCountryCode: e.target.value }))}
                          className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600"
                        >
                          {PHONE_COUNTRY_CODE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="tel-national"
                          placeholder="Mobile number"
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600"
                          value={formData.phoneNumber}
                          onChange={e => {
                            const digits = normalizePhoneDigits(e.target.value).slice(0, 15);
                            setFormData(prev => ({ ...prev, phoneNumber: digits }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 space-y-3">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          hasReferralCode: !prev.hasReferralCode,
                          referralCode: !prev.hasReferralCode ? prev.referralCode : '',
                        }))}
                        className="w-full flex items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Referral</p>
                          <p className="text-sm font-bold text-slate-900">I have a referral code</p>
                        </div>
                        <span
                          className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                            formData.hasReferralCode ? 'bg-teal-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                              formData.hasReferralCode ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </span>
                      </button>

                      {formData.hasReferralCode && (
                        <div className="space-y-2 onboarding-fade-expand">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Referral Code</label>
                          <input
                            type="text"
                            placeholder="Enter code"
                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600"
                            value={formData.referralCode}
                            onChange={e => setFormData(prev => ({ ...prev, referralCode: normalizeReferralCode(e.target.value) }))}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Choose Password</label>
                      <div className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        <button type="button" onClick={() => setShowPassword(prev => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors">
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat password" className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />
                        <button type="button" onClick={() => setShowConfirmPassword(prev => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors">
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <button onClick={handleSignup} disabled={isProcessing} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-100 disabled:opacity-60">
                      {isProcessing ? 'Processing...' : 'Create Account'} <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}

              {authStep === 'login' && (
                <div className="space-y-8 onboarding-stagger">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        transitionToAuthStep('identifier');
                        setError(null);
                      }}
                      className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                      <ShieldCheck size={12} /> Recognized Profile
                    </div>
                  </div>
                  <h1 className="text-3xl font-black tracking-tighter text-slate-950">
                    Welcome back,
                    <br />
                    <span className="text-teal-600">continue securely.</span>
                  </h1>
                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                      <AlertCircle size={14} /> {error}
                    </div>
                  )}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                      <div className="relative">
                        <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type={showLoginPassword ? 'text' : 'password'} placeholder="••••••••" className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                        <button type="button" onClick={() => setShowLoginPassword(prev => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors">
                          {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <button onClick={handleLogin} disabled={isProcessing} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-100 disabled:opacity-60">
                      {isProcessing ? 'Authenticating...' : 'Continue'} <ArrowRight size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        transitionToAuthStep('signup');
                        setError(null);
                      }}
                      className="w-full py-3 text-xs font-black uppercase tracking-widest text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-50 transition-colors"
                    >
                      New user? Create account
                    </button>
                  </div>
                </div>
              )}

              {authStep === 'onboarding' && (
                <div className="space-y-8">
                  {onboardingStep === 0 && (
                    <div className="space-y-6 onboarding-stagger">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                        <ShieldCheck size={12} /> Trust + control
                      </div>
                      <h2 className="text-3xl font-black tracking-tight text-slate-950">Help us personalize responsibly</h2>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">
                        Required details unlock accurate projections. Optional context can be skipped now and added later.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-2xl border border-teal-100 bg-teal-50">
                          <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">Minimal required data</p>
                          <p className="text-xs font-semibold text-slate-700 mt-1">Only core fields are required for baseline plans.</p>
                        </div>
                        <div className="p-4 rounded-2xl border border-teal-100 bg-white">
                          <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">Revoke anytime</p>
                          <p className="text-xs font-semibold text-slate-700 mt-1">Disconnect optional permissions from Settings.</p>
                        </div>
                        <div className="p-4 rounded-2xl border border-teal-100 bg-white">
                          <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">No data resale</p>
                          <p className="text-xs font-semibold text-slate-700 mt-1">Your onboarding data is never sold or used for ads.</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            setError(null);
                            transitionToOnboardingStep(1);
                          }}
                          className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all"
                        >
                          Continue Securely
                        </button>
                        <button
                          onClick={() => {
                            setError(null);
                            transitionToOnboardingStep(1);
                          }}
                          className="w-full py-3.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all"
                        >
                          Skip Optional Data
                        </button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 1 && (
                    <div className="space-y-4 onboarding-stagger">
                      {dataSharingStepLabel && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">{dataSharingStepLabel}</p>
                      )}
                      <div className="space-y-1.5">
                        <h2 className="text-3xl font-black tracking-tight text-slate-950">Date of Birth</h2>
                        <p className="text-xs font-bold uppercase tracking-widest text-teal-600">Required for age-based projections</p>
                      </div>
                      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5">
                        <p className="text-sm font-semibold text-slate-900">Your date of birth calibrates every retirement and life-stage projection.</p>
                        <p className="text-sm font-semibold text-slate-700">Without it, assumptions may drift from your actual planning horizon.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[1.7fr_0.9fr] gap-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of birth</label>
                          <div className="grid grid-cols-3 gap-2.5">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Day</label>
                              <select
                                value={dobParts.day}
                                onChange={e => handleDobPartChange('day', e.target.value)}
                                className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600 transition-all text-slate-900"
                              >
                                <option value="">DD</option>
                                {dobDayOptions.map(day => (
                                  <option key={day} value={day}>
                                    {pad2(Number(day))}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Month</label>
                              <select
                                value={dobParts.month}
                                onChange={e => handleDobPartChange('month', e.target.value)}
                                className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600 transition-all text-slate-900"
                              >
                                <option value="">MM</option>
                                {DOB_MONTH_OPTIONS.map(month => (
                                  <option key={month.value} value={month.value}>
                                    {month.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Year</label>
                              <select
                                value={dobParts.year}
                                onChange={e => handleDobPartChange('year', e.target.value)}
                                className="w-full px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600 transition-all text-slate-900"
                              >
                                <option value="">YYYY</option>
                                {dobYearOptions.map(year => (
                                  <option key={year} value={year}>
                                    {year}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-500 ml-1">Pick day, month, and year for smoother mobile entry.</p>
                        </div>
                        <div className={`rounded-xl border p-3.5 flex flex-col justify-center ${dobAge && !ageGateError ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <p className={`text-[10px] font-black uppercase tracking-widest ${dobAge && !ageGateError ? 'text-emerald-700' : 'text-slate-500'}`}>Age detected</p>
                          <p className={`text-2xl font-black leading-none mt-1 ${dobAge && !ageGateError ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {dobAge && !ageGateError ? `${dobAge} years` : '--'}
                          </p>
                        </div>
                      </div>

                      <button onClick={() => toggleUsage('dob')} className="w-full text-left px-4 py-2.5 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-600 hover:border-teal-200 hover:text-teal-700 transition-all">
                        <span>Why we ask</span>
                        <span className="inline-flex items-center gap-1">
                          {openUsageKey === 'dob' ? 'Show less' : 'Learn more'}
                          {openUsageKey === 'dob' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>
                      </button>
                      {openUsageKey === 'dob' && (
                        <div className="p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 space-y-2 onboarding-fade-expand">
                          <p><span className="font-black text-slate-900">What we collect:</span> your date of birth.</p>
                          <p><span className="font-black text-slate-900">Why we need it:</span> to build age-based planning windows.</p>
                          <p><span className="font-black text-slate-900">How it improves your experience:</span> more accurate timelines and recommendations.</p>
                          <p><span className="font-black text-slate-900">What we do not do:</span> we never sell this information or use it for ads.</p>
                        </div>
                      )}

                      {ageGateError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                          <AlertCircle size={14} /> {ageGateError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button onClick={() => transitionToOnboardingStep(0)} className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                          Back
                        </button>
                        <button onClick={validateDobAndContinue} className="w-full py-3 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 2 && (
                    <div className="space-y-4 onboarding-stagger">
                      {dataSharingStepLabel && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">{dataSharingStepLabel}</p>
                      )}
                      <div className="space-y-1.5">
                        <h2 className="text-3xl font-black text-slate-950 tracking-tight">Planning Timeline</h2>
                        <p className="text-xs font-semibold text-slate-600">Set these ranges to calibrate long-horizon projections.</p>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3.5 rounded-2xl border border-teal-100 bg-teal-50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">Years to retirement</p>
                            <p className="text-2xl font-black text-teal-700 mt-1 leading-none">{yearsToRetirement}</p>
                          </div>
                          <div className="p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Retirement span</p>
                            <p className="text-2xl font-black text-emerald-700 mt-1 leading-none">{yearsInRetirement}</p>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Planning horizon quality</p>
                          <p className="text-xs font-semibold text-slate-700">
                            These age sliders set your retirement start and end window. You can adjust them later in Planning Engine.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Life expectancy age</label>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Min {minLifeExpectancy} / Max {lifeSpanMax}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-2xl font-black text-teal-600 leading-none">{formData.lifeExpectancy} <span className="text-[8px] font-bold text-slate-400 uppercase">Yrs</span></span>
                          </div>
                          <input type="range" min={minLifeExpectancy} max={lifeSpanMax} className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-teal-600 cursor-pointer" value={formData.lifeExpectancy} onChange={e => {
                            const next = Number(e.target.value);
                            const nextRetirement = Math.min(formData.retirementAge, Math.max(minLifeExpectancy, next - 1));
                            setFormData(prev => ({
                              ...prev,
                              lifeExpectancy: next,
                              retirementAge: nextRetirement,
                            }));
                          }} />
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Retirement age</label>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Max {retirementMax}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-2xl font-black text-emerald-600 leading-none">{formData.retirementAge} <span className="text-[8px] font-bold text-slate-400 uppercase">Yrs</span></span>
                          </div>
                          <input type="range" min={minLifeExpectancy} max={retirementMax} className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-emerald-500 cursor-pointer" value={formData.retirementAge} onChange={e => {
                            const next = Number(e.target.value);
                            const nextLife = Math.min(lifeSpanMax, Math.max(formData.lifeExpectancy, next + 1));
                            const nextRetirement = Math.min(next, Math.max(minLifeExpectancy, nextLife - 1));
                            setFormData(prev => ({
                              ...prev,
                              retirementAge: nextRetirement,
                              lifeExpectancy: nextLife,
                            }));
                          }} />
                        </div>
                      </div>

                      <button onClick={() => toggleUsage('timeline')} className="w-full text-left px-4 py-2.5 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-600 hover:border-teal-200 hover:text-teal-700 transition-all">
                        <span>Why we ask</span>
                        <span className="inline-flex items-center gap-1">
                          {openUsageKey === 'timeline' ? 'Show less' : 'Learn more'}
                          {openUsageKey === 'timeline' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>
                      </button>
                      {openUsageKey === 'timeline' && (
                        <div className="p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 space-y-2 onboarding-fade-expand">
                          <p><span className="font-black text-slate-900">What we collect:</span> retirement age and life expectancy.</p>
                          <p><span className="font-black text-slate-900">Why we need it:</span> to estimate your planning horizon and funding duration.</p>
                          <p><span className="font-black text-slate-900">How it improves your experience:</span> more relevant recommendations with less manual work.</p>
                          <p><span className="font-black text-slate-900">What we do not do:</span> we never sell it and never use it for ad targeting.</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button onClick={() => transitionToOnboardingStep(1)} className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                          Back
                        </button>
                        <button onClick={() => { setError(null); transitionToOnboardingStep(3); }} className="w-full py-3 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">
                          Continue
                        </button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 3 && (
                    <div className="space-y-4 onboarding-stagger">
                      {dataSharingStepLabel && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">{dataSharingStepLabel}</p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-1">
                          <h2 className="text-3xl font-black tracking-tight text-slate-950">Location (Optional)</h2>
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Completely optional. Skip now if you prefer.</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${hasLocationData ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                          {hasLocationData ? 'Connected' : 'Not shared'}
                        </span>
                      </div>

                      <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5">
                        <p className="text-sm font-semibold text-slate-900">Location improves local assumptions and recommendation relevance.</p>
                        <p className="text-sm font-semibold text-slate-700">
                          We also use your location context to calibrate health insurance need estimates for regional treatment cost trends.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <select
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600 text-slate-700"
                            value={formData.country}
                            onChange={e => setFormData(prev => ({ ...prev, country: e.target.value, pincode: '', city: '', state: '' }))}
                          >
                            <option>India</option>
                            <option>United States</option>
                            <option>United Kingdom</option>
                            <option>Canada</option>
                            <option>Australia</option>
                            <option>Singapore</option>
                            <option>UAE</option>
                            <option>Other</option>
                          </select>
                          <input
                            type="text"
                            placeholder={formData.country.trim().toLowerCase() === 'india' ? 'PIN Code' : 'Postal Code'}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600 text-teal-600"
                            value={formData.pincode}
                            onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            placeholder="City"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600"
                            value={formData.city}
                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                          />
                          <input
                            type="text"
                            placeholder="State"
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600"
                            value={formData.state}
                            onChange={e => setFormData({ ...formData, state: e.target.value })}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                          <span className="text-slate-400">Enter {formData.country.trim().toLowerCase() === 'india' ? 'PIN' : 'postal'} code to auto-detect city/state.</span>
                          {geoStatus.loading && <span className="text-teal-600">Detecting...</span>}
                        </div>
                        {geoStatus.error && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold">
                            {geoStatus.error}
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-3.5 space-y-3">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">Insurance details for location-aware estimate</p>
                          <p className="text-xs font-semibold text-slate-700">
                            Tell us your current covers so we can estimate required insurance amount versus deficit with your location assumptions.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Term insurance</p>
                                <p className="text-xs font-semibold text-slate-700 mt-1">Do you already have a term insurance cover?</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  hasTermInsurance: !prev.hasTermInsurance,
                                  termInsuranceAmount: prev.hasTermInsurance ? 0 : prev.termInsuranceAmount,
                                }))}
                                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                                  formData.hasTermInsurance ? 'bg-teal-600' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                    formData.hasTermInsurance ? 'translate-x-5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                            {formData.hasTermInsurance ? (
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Term insurance amount</label>
                                <input
                                  type="number"
                                  min="0"
                                  inputMode="decimal"
                                  placeholder="e.g. 10000000"
                                  value={formData.termInsuranceAmount > 0 ? String(formData.termInsuranceAmount) : ''}
                                  onChange={e => setFormData(prev => ({
                                    ...prev,
                                    termInsuranceAmount: e.target.value === '' ? 0 : parseNonNegativeAmount(e.target.value),
                                  }))}
                                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600"
                                />
                              </div>
                            ) : (
                              <p className="text-[11px] font-semibold text-slate-500">Turn this on if you already hold a term policy.</p>
                            )}
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Health insurance</p>
                                <p className="text-xs font-semibold text-slate-700 mt-1">Do you already have a health insurance cover?</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({
                                  ...prev,
                                  hasHealthInsurance: !prev.hasHealthInsurance,
                                  healthInsuranceAmount: prev.hasHealthInsurance ? 0 : prev.healthInsuranceAmount,
                                }))}
                                className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
                                  formData.hasHealthInsurance ? 'bg-teal-600' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                    formData.hasHealthInsurance ? 'translate-x-5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                            {formData.hasHealthInsurance ? (
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Health insurance amount</label>
                                <input
                                  type="number"
                                  min="0"
                                  inputMode="decimal"
                                  placeholder="e.g. 500000"
                                  value={formData.healthInsuranceAmount > 0 ? String(formData.healthInsuranceAmount) : ''}
                                  onChange={e => setFormData(prev => ({
                                    ...prev,
                                    healthInsuranceAmount: e.target.value === '' ? 0 : parseNonNegativeAmount(e.target.value),
                                  }))}
                                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600"
                                />
                              </div>
                            ) : (
                              <p className="text-[11px] font-semibold text-slate-500">Turn this on if you already hold health coverage.</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <button onClick={() => toggleUsage('location')} className="w-full text-left px-4 py-2.5 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-600 hover:border-teal-200 hover:text-teal-700 transition-all">
                        <span>Why we ask</span>
                        <span className="inline-flex items-center gap-1">
                          {openUsageKey === 'location' ? 'Show less' : 'Learn more'}
                          {openUsageKey === 'location' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </span>
                      </button>
                      {openUsageKey === 'location' && (
                        <div className="p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 space-y-2 onboarding-fade-expand">
                          <p><span className="font-black text-slate-900">What we collect:</span> country, postal code, city, state, and optional insurance cover amounts.</p>
                          <p><span className="font-black text-slate-900">Why we need it:</span> to localize assumptions and estimate required term/health cover more accurately.</p>
                          <p><span className="font-black text-slate-900">How it improves your experience:</span> faster setup and better insurance deficit insights.</p>
                          <p><span className="font-black text-slate-900">What we do not do:</span> we never sell your location data or use it for ads.</p>
                        </div>
                      )}

                      {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold text-left"><AlertCircle size={14} /> {error}</div>}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button onClick={() => transitionToOnboardingStep(2)} className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                          Back
                        </button>
                        <button onClick={() => handleLocationDecision('share')} className="w-full py-3 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">
                          Connect Securely
                        </button>
                        <button onClick={() => handleLocationDecision('skip')} className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                          Not Now
                        </button>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 4 && (
                    <div className="space-y-8 onboarding-stagger">
                      <div className="text-center space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                          <CheckCircle2 size={12} /> Ready
                        </div>
                        <h3 className="text-3xl font-black text-slate-950 tracking-tighter leading-none">You are in control.</h3>
                        <p className="text-slate-600 text-sm font-medium leading-relaxed">
                          {`Thanks, ${loggedInFirstName || formData.firstName}.`} Optional data can be revoked anytime from Settings.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl border border-teal-100 bg-teal-50">
                          <p className="text-xs font-black uppercase tracking-widest text-teal-700 mb-1">Security summary</p>
                          <p className="text-sm font-semibold text-slate-800">Encryption, secure storage, and strict access controls protect your information.</p>
                        </div>
                        <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Model quality score</p>
                          <p className="text-3xl font-black text-teal-600 leading-none">{baselineIq}</p>
                          <p className="text-xs text-slate-500 font-semibold mt-1">Higher completeness generally improves recommendations.</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Setup review</p>
                        <div className="space-y-2">
                          {reviewChecklist.map(item => (
                            <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-white border border-slate-200 px-3 py-2.5">
                              <div>
                                <p className="text-xs font-black uppercase tracking-wider text-slate-500">{item.label}</p>
                                <p className="text-sm font-semibold text-slate-700 mt-0.5">{item.value}</p>
                              </div>
                              <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${item.complete ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                {item.complete ? 'Ready' : 'Optional'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold text-left"><AlertCircle size={14} /> {error}</div>}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button onClick={() => transitionToOnboardingStep(3)} className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                          Back
                        </button>
                        <button onClick={handleFinishOnboarding} disabled={isProcessing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-600 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-60">
                          {isProcessing ? 'Saving...' : 'Go to Dashboard'} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
