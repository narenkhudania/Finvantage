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

const normalizeIncomeSource = (value?: string | null): IncomeSource => (
  value === 'business' ? 'business' : 'salaried'
);

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, initialAuthStep, resumeProfile }) => {
  const [authStep, setAuthStep] = useState<'identifier' | 'login' | 'signup' | 'onboarding'>(initialAuthStep ?? 'identifier');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [geoStatus, setGeoStatus] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [skipOptionalRequests, setSkipOptionalRequests] = useState(false);
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
  });

  const EMAIL_DOMAINS = [
    'gmail.com',
    'outlook.com',
    'yahoo.com',
    'icloud.com',
    'proton.me',
    'zoho.com',
  ];

  const stepConfig = [
    { title: 'Trust', icon: ShieldCheck },
    { title: 'Birth Date', icon: User },
    { title: 'Planning', icon: TrendingUp },
    { title: 'Location', icon: MapPin },
    { title: 'Review', icon: BrainCircuit },
  ];

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
      setAuthStep(exists ? 'login' : 'signup');
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

    setIsProcessing(true);
    setError(null);
    try {
      await signUp({
        identifier: email,
        password: formData.password,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim() || undefined,
      });
      setFormData(prev => ({ ...prev, identifier: email }));
      setLoggedInFirstName(formData.firstName.trim());
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

    score += formData.incomeSource === 'business' ? 3 : 2;

    if (formData.country.trim()) score += 1;
    if (formData.city.trim()) score += 1;
    if (formData.state.trim()) score += 1;
    if (formData.pincode.trim()) score += 1;

    return Math.min(98, Math.max(40, Math.round(score)));
  }, [formData, currentAge]);

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
    setOnboardingStep(2);
  };

  const handleLocationDecision = (mode: 'share' | 'skip') => {
    if (mode !== 'share') {
      setFormData(prev => ({ ...prev, pincode: '', city: '', state: '' }));
      setError(null);
      setOnboardingStep(4);
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
    setOnboardingStep(4);
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
      });

      const normalizedEmail = formData.identifier.trim().toLowerCase();

      onComplete({
        isRegistered: true,
        profile: {
          ...formData,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: normalizedEmail,
          mobile: '',
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
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to save profile. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const progressWidth = stepConfig.length > 1
    ? (onboardingStep / (stepConfig.length - 1)) * 100
    : 0;
  const dataSharingStepLabel = onboardingStep <= 2
    ? 'Step 1 of 2'
    : onboardingStep === 3
      ? 'Step 2 of 2'
      : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden text-slate-900">

      {authStep === 'onboarding' && (
        <>
          <div className="max-w-md w-full mb-4 sm:mb-6 flex items-center justify-between px-6 relative">
            <div className="absolute top-5 left-6 right-6 h-[2px] bg-slate-200 -z-0" />
            <div className="absolute top-5 left-6 h-[2px] bg-teal-600 -z-0 transition-all duration-1000 ease-in-out" style={{ width: `${progressWidth}%` }} />
            {stepConfig.map((s, i) => (
              <div key={i} className="flex flex-col items-center relative z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700 ${onboardingStep >= i ? 'bg-teal-600 text-white shadow-lg shadow-teal-200' : 'bg-white text-slate-400 border border-slate-200'}`}>
                  <s.icon size={16} />
                </div>
                <span className={`text-[7px] font-black uppercase tracking-[0.1em] mt-2 transition-colors duration-500 ${onboardingStep >= i ? 'text-teal-600' : 'text-slate-400'}`}>{s.title}</span>
              </div>
            ))}
          </div>

          <div className="w-full max-w-xl mb-4 px-2">
            <div className="bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-teal-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck size={12} /> End-to-end encryption</span>
                  <span className="text-teal-300">•</span>
                  <span>Industry-standard compliance</span>
                  <span className="text-teal-300">•</span>
                  <span>We never sell your data</span>
                </div>
                <button
                  onClick={() => setShowSecurityDetails(prev => !prev)}
                  className="text-[10px] font-black uppercase tracking-widest text-teal-700 hover:text-teal-900 transition-colors"
                >
                  {showSecurityDetails ? 'Show less' : 'Learn more'}
                </button>
              </div>
              {showSecurityDetails && (
                <p className="text-xs font-semibold text-slate-700">
                  Data is encrypted in transit and at rest, access is restricted, and storage is continuously monitored.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="max-w-xl w-full bg-white rounded-[2.5rem] sm:rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 blur-[100px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />

        <div className="p-8 sm:p-12 lg:p-14 text-left">

          {authStep === 'identifier' && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                  <ShieldCheck size={12} /> System Gateway
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none text-slate-950">Access <br /><span className="text-teal-600">Terminal.</span></h1>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Enter your email to establish a secure connection.</p>
              </div>
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="ravindra@wealth.terminal"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-600 outline-none font-bold text-base transition-all placeholder:text-slate-300"
                      value={formData.identifier}
                      onChange={e => setFormData({ ...formData, identifier: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleProceedIdentifier()}
                    />
                    {formData.identifier.includes('@') && emailSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20">
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
                {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold"><AlertCircle size={14} /> {error}</div>}
                <button onClick={handleProceedIdentifier} disabled={isProcessing} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-teal-100 disabled:opacity-60">
                  {isProcessing ? 'Checking...' : 'Proceed'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {authStep === 'signup' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3">
                <button onClick={() => { setAuthStep('identifier'); setError(null); }} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><ArrowLeft size={16} /></button>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                  <Zap size={12} /> New Identity
                </div>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-950">Initialize <span className="text-teal-600">Node.</span></h1>
              {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold"><AlertCircle size={14} /> {error}</div>}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
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
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Choose Key</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                    <button type="button" onClick={() => setShowPassword(prev => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Key</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat key" className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />
                    <button type="button" onClick={() => setShowConfirmPassword(prev => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button onClick={handleSignup} disabled={isProcessing} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-100 disabled:opacity-60">
                  {isProcessing ? 'Processing...' : 'Deploy Identity'} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {authStep === 'login' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3">
                <button onClick={() => { setAuthStep('identifier'); setError(null); }} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><ArrowLeft size={16} /></button>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                  <ShieldCheck size={12} /> Recognized Node
                </div>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-950">Welcome back, <br /><span className="text-teal-600">Strategist.</span></h1>
              {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold"><AlertCircle size={14} /> {error}</div>}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Key</label>
                  <div className="relative">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type={showLoginPassword ? 'text' : 'password'} placeholder="••••••••" className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                    <button type="button" onClick={() => setShowLoginPassword(prev => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors">
                      {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button onClick={handleLogin} disabled={isProcessing} className="w-full py-4 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-100 disabled:opacity-60">
                  {isProcessing ? 'Authenticating...' : 'Access Terminal'} <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {authStep === 'onboarding' && (
            <div className="space-y-8">
              {onboardingStep === 0 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-700">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                    <ShieldCheck size={12} /> Start with trust
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">Help us personalize your experience</h2>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    We understand sharing information is a big decision. It is completely okay to take your time.
                  </p>
                  <div className="p-4 rounded-2xl border border-teal-100 bg-teal-50 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-teal-700">What happens next</p>
                    <p className="text-sm text-slate-700 font-semibold">Step 1 covers required details for accurate projections. Step 2 is optional and improves relevance.</p>
                    <p className="text-xs text-slate-600 font-medium">You can disconnect optional data anytime in Settings.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => { setSkipOptionalRequests(false); setError(null); setOnboardingStep(1); }} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">
                      Continue Securely
                    </button>
                    <button onClick={() => { setSkipOptionalRequests(true); setError(null); setOnboardingStep(1); }} className="w-full py-3.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                      Not Now (Optional Data)
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-700">
                  {dataSharingStepLabel && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">{dataSharingStepLabel}</p>
                  )}
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">Date of Birth</h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-teal-600">Required to run retirement projections</p>
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                    <p className="text-sm font-semibold text-slate-900">Adding your date of birth gives you age-accurate insights.</p>
                    <p className="text-sm font-semibold text-slate-700">This reduces manual correction and improves planning accuracy.</p>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of birth</label>
                    <input type="date" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600 transition-all text-teal-600" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                  </div>

                  <button onClick={() => toggleUsage('dob')} className="w-full text-left px-4 py-3 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-600 hover:border-teal-200 hover:text-teal-700 transition-all">
                    <span>Why we ask</span>
                    <span className="inline-flex items-center gap-1">
                      {openUsageKey === 'dob' ? 'Show less' : 'Learn more'}
                      {openUsageKey === 'dob' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>
                  {openUsageKey === 'dob' && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 space-y-2">
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
                    <button onClick={() => setOnboardingStep(0)} className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                      Back
                    </button>
                    <button onClick={validateDobAndContinue} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-700">
                  {dataSharingStepLabel && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">{dataSharingStepLabel}</p>
                  )}
                  <h2 className="text-3xl font-black text-slate-950 tracking-tight">Planning Timeline</h2>
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Adding planning ages gives you more accurate long-term projections.</p>
                    <p className="text-sm font-semibold text-slate-700">It helps avoid underestimating how long your savings need to last.</p>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Life expectancy age</label>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Min {minLifeExpectancy} / Max {lifeSpanMax}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-teal-600">{formData.lifeExpectancy} <span className="text-[8px] font-bold text-slate-400 uppercase">Yrs</span></span>
                      </div>
                      <input type="range" min={minLifeExpectancy} max={lifeSpanMax} className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-teal-600 cursor-pointer" value={formData.lifeExpectancy} onChange={e => {
                        const next = Number(e.target.value);
                        const nextRetirement = Math.min(formData.retirementAge, Math.max(minLifeExpectancy, next - 1));
                        setFormData(prev => ({
                          ...prev,
                          lifeExpectancy: next,
                          retirementAge: nextRetirement,
                        }));
                      }} />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Retirement age</label>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Max {retirementMax}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-black text-emerald-600">{formData.retirementAge} <span className="text-[8px] font-bold text-slate-400 uppercase">Yrs</span></span>
                      </div>
                      <input type="range" min={minLifeExpectancy} max={retirementMax} className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-emerald-500 cursor-pointer" value={formData.retirementAge} onChange={e => {
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

                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 inline-flex items-center gap-2">
                        Income source (optional context)
                        <span title="Used to personalize assumptions only. You can change or remove it later." className="text-slate-400 cursor-help">?</span>
                      </label>
                      <select
                        value={normalizeIncomeSource(formData.incomeSource)}
                        onChange={e => setFormData(prev => ({ ...prev, incomeSource: normalizeIncomeSource(e.target.value) }))}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600"
                      >
                        <option value="salaried">Salaried</option>
                        <option value="business">Business</option>
                      </select>
                    </div>
                  </div>

                  <button onClick={() => toggleUsage('timeline')} className="w-full text-left px-4 py-3 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-600 hover:border-teal-200 hover:text-teal-700 transition-all">
                    <span>Why we ask</span>
                    <span className="inline-flex items-center gap-1">
                      {openUsageKey === 'timeline' ? 'Show less' : 'Learn more'}
                      {openUsageKey === 'timeline' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>
                  {openUsageKey === 'timeline' && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 space-y-2">
                      <p><span className="font-black text-slate-900">What we collect:</span> retirement age, life expectancy, and optional income source context.</p>
                      <p><span className="font-black text-slate-900">Why we need it:</span> to estimate your planning horizon and funding duration.</p>
                      <p><span className="font-black text-slate-900">How it improves your experience:</span> more relevant recommendations with less manual work.</p>
                      <p><span className="font-black text-slate-900">What we do not do:</span> we never sell it and never use it for ad targeting.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => setOnboardingStep(1)} className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                      Back
                    </button>
                    <button onClick={() => { setError(null); setOnboardingStep(skipOptionalRequests ? 4 : 3); }} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-700">
                  {dataSharingStepLabel && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-teal-600">{dataSharingStepLabel}</p>
                  )}
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">Location (Optional)</h2>
                  <p className="text-sm text-slate-600 font-medium">It is completely okay to skip this for now.</p>
                  <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Sharing location helps us show more relevant recommendations.</p>
                    <p className="text-sm font-semibold text-slate-700">For many users, this cuts manual adjustments by about 3 hours per week.</p>
                  </div>

                  <div className="space-y-5">
                    <select
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600 text-slate-700"
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
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600 text-teal-600"
                      value={formData.pincode}
                      onChange={e => setFormData({ ...formData, pincode: e.target.value })}
                    />
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Enter {formData.country.trim().toLowerCase() === 'india' ? 'PIN' : 'postal'} code to auto-detect city/state.</span>
                      {geoStatus.loading && <span className="text-teal-600">Detecting...</span>}
                    </div>
                    {geoStatus.error && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold">
                        {geoStatus.error}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
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
                  </div>

                  <button onClick={() => toggleUsage('location')} className="w-full text-left px-4 py-3 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-600 hover:border-teal-200 hover:text-teal-700 transition-all">
                    <span>Why we ask</span>
                    <span className="inline-flex items-center gap-1">
                      {openUsageKey === 'location' ? 'Show less' : 'Learn more'}
                      {openUsageKey === 'location' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                  </button>
                  {openUsageKey === 'location' && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 space-y-2">
                      <p><span className="font-black text-slate-900">What we collect:</span> country, postal code, city, and state.</p>
                      <p><span className="font-black text-slate-900">Why we need it:</span> to localize assumptions and service availability.</p>
                      <p><span className="font-black text-slate-900">How it improves your experience:</span> faster setup and more relevant insights.</p>
                      <p><span className="font-black text-slate-900">What we do not do:</span> we never sell your location data or use it for ads.</p>
                    </div>
                  )}

                  {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold text-left"><AlertCircle size={14} /> {error}</div>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => handleLocationDecision('share')} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">
                      Connect Securely
                    </button>
                    <button onClick={() => handleLocationDecision('skip')} className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                      Not Now
                    </button>
                  </div>
                </div>
              )}

              {onboardingStep === 4 && (
                <div className="space-y-8 animate-in zoom-in-95 duration-700">
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                      <CheckCircle2 size={12} /> Ready
                    </div>
                    <h3 className="text-3xl font-black text-slate-950 tracking-tighter leading-none">You are in control.</h3>
                    <p className="text-slate-600 text-sm font-medium leading-relaxed">
                      {`Thanks, ${loggedInFirstName || formData.firstName}.`} You can disconnect optional data anytime in Settings with one click.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="p-4 rounded-2xl border border-teal-100 bg-teal-50">
                      <p className="text-xs font-black uppercase tracking-widest text-teal-700 mb-1">Security summary</p>
                      <p className="text-sm font-semibold text-slate-800">Encryption, secure storage, and strict access controls protect your information. We never sell your data.</p>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Model quality score</p>
                      <p className="text-3xl font-black text-teal-600 leading-none">{baselineIq}</p>
                      <p className="text-xs text-slate-500 font-semibold mt-1">Higher data completeness improves recommendation quality.</p>
                    </div>
                  </div>

                  {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold text-left"><AlertCircle size={14} /> {error}</div>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => setOnboardingStep(skipOptionalRequests ? 2 : 3)} className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm uppercase tracking-widest hover:border-teal-200 hover:text-teal-700 transition-all">
                      Back
                    </button>
                    <button onClick={handleFinishOnboarding} disabled={isProcessing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-600 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-60">
                      {isProcessing ? 'Saving...' : 'Enter Terminal'} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
