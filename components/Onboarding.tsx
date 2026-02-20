// components/Onboarding.tsx
// REPLACE your existing Onboarding.tsx with this file.
// Only the handler functions changed — all UI is identical.

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FinanceState, IncomeSource } from '../types';
import { 
  ArrowRight, User, MapPin, ShieldCheck,
  TrendingUp, Zap, ChevronRight, BrainCircuit, 
  Lock, Key, AlertCircle, ArrowLeft, Eye, EyeOff
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
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onBackToLanding }) => {
  const [authStep, setAuthStep] = useState<'identifier' | 'login' | 'signup' | 'onboarding'>('identifier');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [geoStatus, setGeoStatus] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const geoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stores the logged-in user's name after sign-up/sign-in
  const [loggedInFirstName, setLoggedInFirstName] = useState('');

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    dob: '',
    lifeExpectancy: 85,
    retirementAge: 60,
    pincode: '',
    city: '',
    state: '',
    country: 'India',
    incomeSource: 'salaried' as IncomeSource,
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
    { title: 'Personal', icon: User },
    { title: 'Planning', icon: TrendingUp },
    { title: 'Location', icon: MapPin },
    { title: 'Intelligence', icon: BrainCircuit },
  ];

  // ── HANDLER 1: Check if identifier is registered ─────────────
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

  // ── HANDLER 2: Sign up a new user ─────────────────────────────
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
        password:   formData.password,
        firstName:  formData.firstName.trim(),
        lastName:   formData.lastName.trim() || undefined,
      });
      setFormData(prev => ({ ...prev, identifier: email }));
      setLoggedInFirstName(formData.firstName.trim());
      setAuthStep('onboarding');
    } catch (e: any) {
      setError(e.message ?? 'Sign-up failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── HANDLER 3: Sign in an existing user ───────────────────────
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
        password:   formData.password,
      });

      onComplete({
        isRegistered: true,
        profile: {
          firstName:      profile.first_name,
          lastName:       profile.last_name ?? '',
          email:          email,
          mobile:         '',
          dob:            profile.dob ?? '',
          lifeExpectancy: profile.life_expectancy,
          retirementAge:  profile.retirement_age,
          pincode:        profile.pincode  ?? '',
          city:           profile.city     ?? '',
          state:          profile.state    ?? '',
          country:        profile.country,
          incomeSource:   profile.income_source as IncomeSource,
          iqScore:        profile.iq_score,
          income: {
            salary: 50000, bonus: 0, reimbursements: 0,
            business: 0, rental: 0, investment: 0, expectedIncrease: 6,
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

    // Earlier planning tends to correlate with higher readiness.
    if (age <= 25) score += 12;
    else if (age <= 35) score += 10;
    else if (age <= 45) score += 8;
    else if (age <= 55) score += 5;
    else if (age <= 65) score += 3;

    // Longer planning runway = stronger financial strategy runway.
    if (horizonToRetire >= 30) score += 12;
    else if (horizonToRetire >= 20) score += 9;
    else if (horizonToRetire >= 15) score += 6;
    else if (horizonToRetire >= 10) score += 3;

    // Longer retirement span requires stronger planning.
    if (retirementSpan >= 25) score += 10;
    else if (retirementSpan >= 18) score += 7;
    else if (retirementSpan >= 12) score += 4;
    else if (retirementSpan >= 8) score += 2;

    // Income source complexity.
    score += formData.incomeSource === 'business' ? 3 : 2;

    // Data completeness helps model quality.
    if (formData.country.trim()) score += 1;
    if (formData.city.trim()) score += 1;
    if (formData.state.trim()) score += 1;
    if (formData.pincode.trim()) score += 1;

    return Math.min(98, Math.max(40, Math.round(score)));
  }, [formData, currentAge]);

  // ── HANDLER 4: Save onboarding data and enter the app ─────────
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

      if (formData.country.trim().toLowerCase() === 'india') {
        if (!isValidIndiaPincode(formData.pincode)) {
          setError('Enter a valid 6-digit India pincode.');
          setIsProcessing(false);
          return;
        }
        if (!formData.city.trim() || !formData.state.trim()) {
          setError('City and State are required for India.');
          setIsProcessing(false);
          return;
        }
      } else {
        if (formData.pincode.trim().length < 3) {
          setError('Enter a valid postal code.');
          setIsProcessing(false);
          return;
        }
        if (!formData.city.trim() || !formData.state.trim()) {
          setError('City and State are required.');
          setIsProcessing(false);
          return;
        }
      }

      await saveOnboardingProfile({
        dob:            formData.dob,
        lifeExpectancy: Number(formData.lifeExpectancy),
        retirementAge:  Number(formData.retirementAge),
        pincode:        formData.pincode,
        city:           formData.city,
        state:          formData.state,
        country:        formData.country,
        incomeSource:   formData.incomeSource,
        iqScore:        baselineIq,
      });

      const normalizedEmail = formData.identifier.trim().toLowerCase();

      onComplete({
        isRegistered: true,
        profile: {
          ...formData,
          firstName:      formData.firstName,
          lastName:       formData.lastName,
          email:          normalizedEmail,
          mobile:         '',
          lifeExpectancy: Number(formData.lifeExpectancy),
          retirementAge:  Number(formData.retirementAge),
          iqScore:        baselineIq,
          income: {
            salary: 0, bonus: 0, reimbursements: 0,
            business: 0, rental: 0, investment: 0, expectedIncrease: 6,
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

  // ── UI (identical to original) ────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden text-slate-900">
      
      {authStep === 'onboarding' && (
        <div className="max-w-md w-full mb-6 sm:mb-10 flex items-center justify-between px-6 relative">
          <div className="absolute top-5 left-6 right-6 h-[2px] bg-slate-200 -z-0" />
          <div className="absolute top-5 left-6 h-[2px] bg-teal-600 -z-0 transition-all duration-1000 ease-in-out" style={{ width: `${(onboardingStep / (stepConfig.length - 1)) * 100}%` }} />
          {stepConfig.map((s, i) => (
            <div key={i} className="flex flex-col items-center relative z-10">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700 ${onboardingStep >= i ? 'bg-teal-600 text-white shadow-lg shadow-teal-200' : 'bg-white text-slate-400 border border-slate-200'}`}>
                <s.icon size={16} />
              </div>
              <span className={`text-[7px] font-black uppercase tracking-[0.1em] mt-2 transition-colors duration-500 ${onboardingStep >= i ? 'text-teal-600' : 'text-slate-400'}`}>{s.title}</span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-xl w-full bg-white rounded-[2.5rem] sm:rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-50 blur-[100px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />
        
        <div className="p-8 sm:p-12 lg:p-14 text-left">

          {/* STEP 1: Identifier */}
          {authStep === 'identifier' && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                  <ShieldCheck size={12}/> System Gateway
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none text-slate-950">Access <br/><span className="text-teal-600">Terminal.</span></h1>
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
                      onChange={e => setFormData({...formData, identifier: e.target.value})}
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
                {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold"><AlertCircle size={14}/> {error}</div>}
                <button onClick={handleProceedIdentifier} disabled={isProcessing} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-teal-100 disabled:opacity-60">
                  {isProcessing ? 'Checking...' : 'Proceed'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Signup */}
          {authStep === 'signup' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3">
                <button onClick={() => { setAuthStep('identifier'); setError(null); }} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><ArrowLeft size={16}/></button>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                  <Zap size={12}/> New Identity
                </div>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-950">Initialize <span className="text-teal-600">Node.</span></h1>
              {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold"><AlertCircle size={14}/> {error}</div>}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                    <input type="text" placeholder="John" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                    <input type="text" placeholder="Doe" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Choose Key</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type={showPassword ? "text" : "password"} placeholder="Min 8 characters" className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                    <button type="button" onClick={() => setShowPassword(prev => !prev)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-teal-600 transition-colors">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Key</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type={showConfirmPassword ? "text" : "password"} placeholder="Repeat key" className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
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

          {/* STEP 3: Login */}
          {authStep === 'login' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3">
                <button onClick={() => { setAuthStep('identifier'); setError(null); }} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><ArrowLeft size={16}/></button>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-teal-50 text-teal-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-teal-100">
                  <ShieldCheck size={12}/> Recognized Node
                </div>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-950">Welcome back, <br/><span className="text-teal-600">Strategist.</span></h1>
              {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold"><AlertCircle size={14}/> {error}</div>}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Key</label>
                  <div className="relative">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type={showLoginPassword ? "text" : "password"} placeholder="••••••••" className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
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

          {/* STEP 4: Onboarding Flow */}
          {authStep === 'onboarding' && (
            <div className="space-y-8">
              {onboardingStep === 0 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-700">
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">Actuarial <span className="text-teal-600">Horizon.</span></h2>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Temporal Origin (DOB)</label>
                    <input type="date" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-teal-600 transition-all text-teal-600" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                  </div>
                  {ageGateError && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                      <AlertCircle size={14}/> {ageGateError}
                    </div>
                  )}
                  <button onClick={() => {
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
                    setOnboardingStep(1);
                  }} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">Next Phase</button>
                </div>
              )}

              {onboardingStep === 1 && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-700">
                  <h2 className="text-3xl font-black text-teal-600 tracking-tight">Time Vector.</h2>
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Life Span</label>
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
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Retirement Node</label>
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
                  </div>
                  <button onClick={() => setOnboardingStep(2)} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">Geospatial Sync</button>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-700">
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">Global <span className="text-teal-600">Node.</span></h2>
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
                      onChange={e => setFormData({...formData, pincode: e.target.value})}
                    />
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-slate-400">Enter {formData.country.trim().toLowerCase() === 'india' ? 'PIN' : 'postal'} code to unlock city/state.</span>
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
                        disabled={formData.country.trim().toLowerCase() === 'india' ? !isValidIndiaPincode(formData.pincode) : formData.pincode.trim().length < 3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600 disabled:opacity-50"
                        value={formData.city}
                        onChange={e => setFormData({...formData, city: e.target.value})}
                      />
                      <input
                        type="text"
                        placeholder="State"
                        disabled={formData.country.trim().toLowerCase() === 'india' ? !isValidIndiaPincode(formData.pincode) : formData.pincode.trim().length < 3}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-teal-600 disabled:opacity-50"
                        value={formData.state}
                        onChange={e => setFormData({...formData, state: e.target.value})}
                      />
                    </div>
                  </div>
                  <button onClick={() => setOnboardingStep(3)} className="w-full py-3.5 bg-teal-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-700 transition-all">Compute IQ</button>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="text-center space-y-8 animate-in zoom-in-95 duration-1000">
                  <div className="relative mx-auto w-44 h-44 sm:w-52 sm:h-52">
                    <div className="absolute inset-0 bg-teal-50 blur-[50px] animate-pulse" />
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="283" strokeDashoffset={283 - (283 * baselineIq) / 100} className="text-teal-600 transition-all duration-1000 ease-out" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900">{baselineIq}</span>
                      <span className="text-[8px] font-black text-teal-600 uppercase tracking-widest">Digital IQ</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-950 tracking-tighter leading-none">Sync Successful.</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      Welcome, <span className="text-teal-600 font-bold">{loggedInFirstName || formData.firstName}</span>. System readiness is nominal.
                    </p>
                  </div>
                  {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold text-left"><AlertCircle size={14}/> {error}</div>}
                  <button onClick={handleFinishOnboarding} disabled={isProcessing} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-teal-600 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-60">
                    {isProcessing ? 'Syncing...' : 'Enter Terminal'} <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
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
