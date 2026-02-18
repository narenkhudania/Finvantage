import React, { useState, useMemo } from 'react';
import { FinanceState, IncomeSource } from '../types';
import { supabase } from "../services/supabase";
import {
  CheckCircle2, ArrowRight, User, MapPin, ShieldCheck,
  TrendingUp, Zap, ChevronRight, BrainCircuit,
  Lock, Key, AlertCircle, ArrowLeft
} from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: Partial<FinanceState>) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {

  const [authStep, setAuthStep] = useState<'identifier' | 'login' | 'signup' | 'onboarding'>('identifier');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // -----------------------------------
  // STEP 1 — CHECK IF USER EXISTS
  // -----------------------------------
  const handleProceedIdentifier = async () => {
    if (!formData.identifier.trim()) return;

    setError(null);
    setIsProcessing(true);

    const { data } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("email", formData.identifier)
      .maybeSingle();

    if (data) {
      setAuthStep("login");
    } else {
      setAuthStep("signup");
    }

    setIsProcessing(false);
  };

  // -----------------------------------
  // STEP 2 — SIGNUP
  // -----------------------------------
  const handleSignup = async () => {
    setError(null);

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!formData.firstName.trim()) {
      setError("Name is required.");
      return;
    }

    setIsProcessing(true);

    const { data, error } = await supabase.auth.signUp({
      email: formData.identifier,
      password: formData.password,
    });

    if (error) {
      setError("User already exists, please login.");
      setIsProcessing(false);
      return;
    }

    if (data.user) {
      await supabase.from("user_profiles").insert({
        id: data.user.id,
        email: formData.identifier,
        first_name: formData.firstName,
        last_name: formData.lastName,
        onboarding_completed: false
      });

      setAuthStep("onboarding");
    }

    setIsProcessing(false);
  };

  // -----------------------------------
  // STEP 3 — LOGIN
  // -----------------------------------
  const handleLogin = async () => {
    setError(null);
    setIsProcessing(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.identifier,
      password: formData.password,
    });

    if (error) {
      setError("Invalid credentials.");
      setIsProcessing(false);
      return;
    }

    // App.tsx handles redirect based on onboarding status
    setIsProcessing(false);
  };

  // -----------------------------------
  // IQ CALCULATION
  // -----------------------------------
  const currentAge = useMemo(() => {
    if (!formData.dob) return 30;
    const birthDate = new Date(formData.dob);
    return new Date().getFullYear() - birthDate.getFullYear();
  }, [formData.dob]);

  const baselineIq = useMemo(() => {
    let score = 65;
    if (formData.retirementAge - currentAge > 20) score += 10;
    return Math.min(98, score);
  }, [formData.retirementAge, currentAge]);

  // -----------------------------------
  // FINISH ONBOARDING
  // -----------------------------------
  const handleFinishOnboarding = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase
      .from("user_profiles")
      .update({ onboarding_completed: true })
      .eq("id", session.user.id);

    onComplete({
      isRegistered: true,
      profile: {
        ...formData,
        mobile: '',
        email: formData.identifier,
        lifeExpectancy: Number(formData.lifeExpectancy),
        retirementAge: Number(formData.retirementAge),
        income: {
          salary: 0, bonus: 0, reimbursements: 0,
          business: 0, rental: 0, investment: 0,
          expectedIncrease: 6
        },
        monthlyExpenses: 0,
        iqScore: baselineIq
      }
    });
  };

  // -----------------------------------
  // UI (UNCHANGED)
  // -----------------------------------
  return (
    <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center p-6 text-white">

      {/* IDENTIFIER */}
      {authStep === 'identifier' && (
        <div className="max-w-md w-full space-y-6">
          <h1 className="text-4xl font-black">Access Terminal</h1>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-2">
              <AlertCircle size={18}/> {error}
            </div>
          )}

          <input
            type="email"
            placeholder="Email"
            className="w-full p-4 rounded-xl bg-white/5"
            value={formData.identifier}
            onChange={e => setFormData({...formData, identifier: e.target.value})}
          />

          <button
            onClick={handleProceedIdentifier}
            disabled={isProcessing}
            className="w-full p-4 bg-indigo-600 rounded-xl"
          >
            {isProcessing ? "Checking..." : "Proceed"}
          </button>
        </div>
      )}

      {/* SIGNUP */}
      {authStep === 'signup' && (
        <div className="max-w-md w-full space-y-4">
          <button onClick={() => setAuthStep('identifier')}>
            <ArrowLeft />
          </button>

          <input
            placeholder="First Name"
            className="w-full p-4 rounded-xl bg-white/5"
            value={formData.firstName}
            onChange={e => setFormData({...formData, firstName: e.target.value})}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-4 rounded-xl bg-white/5"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />

          <input
            type="password"
            placeholder="Confirm Password"
            className="w-full p-4 rounded-xl bg-white/5"
            value={formData.confirmPassword}
            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
          />

          <button
            onClick={handleSignup}
            className="w-full p-4 bg-indigo-600 rounded-xl"
          >
            Sign Up
          </button>
        </div>
      )}

      {/* LOGIN */}
      {authStep === 'login' && (
        <div className="max-w-md w-full space-y-4">
          <button onClick={() => setAuthStep('identifier')}>
            <ArrowLeft />
          </button>

          <input
            type="password"
            placeholder="Password"
            className="w-full p-4 rounded-xl bg-white/5"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />

          <button
            onClick={handleLogin}
            className="w-full p-4 bg-indigo-600 rounded-xl"
          >
            Login
          </button>
        </div>
      )}

      {/* ONBOARDING FLOW */}
      {authStep === 'onboarding' && (
        <div className="max-w-md w-full space-y-6">
          <h2 className="text-3xl font-black">Complete Setup</h2>

          <input
            type="date"
            className="w-full p-4 rounded-xl bg-white/5"
            value={formData.dob}
            onChange={e => setFormData({...formData, dob: e.target.value})}
          />

          <button
            onClick={handleFinishOnboarding}
            className="w-full p-4 bg-white text-black rounded-xl"
          >
            Finish Setup <ArrowRight size={16}/>
          </button>
        </div>
      )}

    </div>
  );
};

export default Onboarding;
