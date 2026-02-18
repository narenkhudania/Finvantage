import React, { useState, useMemo } from 'react';
import { FinanceState, IncomeSource } from '../types';
import { supabase } from "../services/supabase";
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: Partial<FinanceState>) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {

  const [authStep, setAuthStep] = useState<'signup' | 'login' | 'onboarding'>('signup');
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

  // ------------------------
  // SIGNUP
  // ------------------------
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
      setError("First name is required.");
      return;
    }

    setIsProcessing(true);

    const { data, error } = await supabase.auth.signUp({
      email: formData.identifier,
      password: formData.password,
    });

    if (error) {
      setError(error.message);
      setIsProcessing(false);
      return;
    }

    const user = data.user;

    if (user) {
      await supabase.from("user_profiles").insert({
        id: user.id,
        first_name: formData.firstName,
        last_name: formData.lastName,
        onboarding_completed: false
      });

      setAuthStep("onboarding");
    }

    setIsProcessing(false);
  };

  // ------------------------
  // LOGIN
  // ------------------------
  const handleLogin = async () => {
    setError(null);
    setIsProcessing(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: formData.identifier,
      password: formData.password,
    });

    if (error) {
      setError(error.message);
      setIsProcessing(false);
      return;
    }

    setIsProcessing(false);
  };

  // ------------------------
  // IQ Logic
  // ------------------------
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

  // ------------------------
  // FINISH ONBOARDING
  // ------------------------
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
        mobile: formData.identifier.includes('@') ? '' : formData.identifier,
        email: formData.identifier,
        lifeExpectancy: Number(formData.lifeExpectancy),
        retirementAge: Number(formData.retirementAge),
        income: {
          salary: 0,
          bonus: 0,
          reimbursements: 0,
          business: 0,
          rental: 0,
          investment: 0,
          expectedIncrease: 6
        },
        monthlyExpenses: 0,
        iqScore: baselineIq
      }
    });
  };

  // ------------------------
  // UI
  // ------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-8">

      <div className="w-full max-w-xl space-y-6">

        {/* AUTH STEP */}
        {authStep !== "onboarding" && (
          <>
            <h1 className="text-3xl font-bold">
              {authStep === "signup" ? "Create Account" : "Login"}
            </h1>

            {error && (
              <div className="p-3 bg-red-500/20 rounded flex items-center gap-2">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 rounded bg-gray-800"
              value={formData.identifier}
              onChange={e => setFormData({ ...formData, identifier: e.target.value })}
            />

            {authStep === "signup" && (
              <>
                <input
                  type="text"
                  placeholder="First Name"
                  className="w-full p-3 rounded bg-gray-800"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                />

                <input
                  type="password"
                  placeholder="Password"
                  className="w-full p-3 rounded bg-gray-800"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />

                <input
                  type="password"
                  placeholder="Confirm Password"
                  className="w-full p-3 rounded bg-gray-800"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                />

                <button
                  onClick={handleSignup}
                  disabled={isProcessing}
                  className="w-full p-3 bg-indigo-600 rounded"
                >
                  {isProcessing ? "Creating..." : "Sign Up"}
                </button>

                <button
                  onClick={() => setAuthStep("login")}
                  className="text-sm text-gray-400"
                >
                  Already have an account? Login
                </button>
              </>
            )}

            {authStep === "login" && (
              <>
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full p-3 rounded bg-gray-800"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />

                <button
                  onClick={handleLogin}
                  disabled={isProcessing}
                  className="w-full p-3 bg-indigo-600 rounded"
                >
                  {isProcessing ? "Logging in..." : "Login"}
                </button>

                <button
                  onClick={() => setAuthStep("signup")}
                  className="text-sm text-gray-400"
                >
                  Need an account? Sign Up
                </button>
              </>
            )}
          </>
        )}

        {/* ONBOARDING FLOW */}
        {authStep === "onboarding" && (
          <>
            <h2 className="text-2xl font-bold">Complete Your Profile</h2>

            <input
              type="date"
              className="w-full p-3 rounded bg-gray-800"
              value={formData.dob}
              onChange={e => setFormData({ ...formData, dob: e.target.value })}
            />

            <input
              type="number"
              placeholder="Life Expectancy"
              className="w-full p-3 rounded bg-gray-800"
              value={formData.lifeExpectancy}
              onChange={e => setFormData({ ...formData, lifeExpectancy: Number(e.target.value) })}
            />

            <input
              type="number"
              placeholder="Retirement Age"
              className="w-full p-3 rounded bg-gray-800"
              value={formData.retirementAge}
              onChange={e => setFormData({ ...formData, retirementAge: Number(e.target.value) })}
            />

            <button
              onClick={handleFinishOnboarding}
              className="w-full p-4 bg-white text-black rounded flex items-center justify-center gap-2"
            >
              Finish Setup <ArrowRight size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
