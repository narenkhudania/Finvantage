
import React, { useState, useMemo, useEffect } from 'react';
import { FinanceState, IncomeSource } from '../types';
import { 
  CheckCircle2, ArrowRight, User, MapPin, ShieldCheck,
  TrendingUp, Zap, ChevronRight, BrainCircuit, Activity, Globe,
  Shield, Mail, Search, Clock, Lock, Key, AlertCircle, ArrowLeft
} from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: Partial<FinanceState>) => void;
  onBackToLanding?: () => void;
}

// Simulated Mock Database in LocalStorage
const MOCK_DB_KEY = 'finvantage_users_db';
const getMockUsers = () => JSON.parse(localStorage.getItem(MOCK_DB_KEY) || '{}');
const saveMockUser = (email: string, userData: any) => {
  const users = getMockUsers();
  users[email] = userData;
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(users));
};

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onBackToLanding }) => {
  const [authStep, setAuthStep] = useState<'identifier' | 'login' | 'signup' | 'onboarding'>('identifier');
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    identifier: '', // Email or Phone
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

  const stepConfig = [
    { title: 'Personal', icon: User },
    { title: 'Planning', icon: TrendingUp },
    { title: 'Location', icon: MapPin },
    { title: 'Intelligence', icon: BrainCircuit },
  ];

  // Auth Logic 1: Check Existence
  const handleProceedIdentifier = () => {
    if (!formData.identifier.trim()) return;
    setError(null);
    const users = getMockUsers();
    if (users[formData.identifier]) {
      setAuthStep('login');
    } else {
      setAuthStep('signup');
    }
  };

  // Auth Logic 2: Signup
  const handleSignup = () => {
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
    // Simulate API Latency
    setTimeout(() => {
      saveMockUser(formData.identifier, { 
        password: formData.password, // In real world: bcrypt here
        firstName: formData.firstName,
        lastName: formData.lastName
      });
      setAuthStep('onboarding');
      setIsProcessing(false);
      setError(null);
    }, 1000);
  };

  // Auth Logic 3: Login
  const handleLogin = () => {
    const users = getMockUsers();
    const user = users[formData.identifier];
    if (user && user.password === formData.password) {
      setIsProcessing(true);
      setTimeout(() => {
        // Log in user and skip onboarding if profile is already complete
        // For this demo, we assume login takes you straight to terminal
        onComplete({
          isRegistered: true,
          profile: {
            ...formData,
            firstName: user.firstName,
            lastName: user.lastName,
            income: { salary: 50000, bonus: 0, reimbursements: 0, business: 0, rental: 0, investment: 0, expectedIncrease: 6 },
            monthlyExpenses: 20000,
          }
        });
      }, 1000);
    } else {
      setError("Invalid credentials.");
    }
  };

  const currentAge = useMemo(() => {
    if (!formData.dob) return 30;
    const birthDate = new Date(formData.dob);
    let age = new Date().getFullYear() - birthDate.getFullYear();
    return age;
  }, [formData.dob]);

  const baselineIq = useMemo(() => {
    let score = 65; 
    if (formData.retirementAge - currentAge > 20) score += 10;
    return Math.min(98, score);
  }, [formData, currentAge]);

  const handleFinishOnboarding = () => {
    onComplete({
      isRegistered: true,
      profile: {
        ...formData,
        mobile: formData.identifier.includes('@') ? '' : formData.identifier,
        email: formData.identifier.includes('@') ? formData.identifier : '',
        lifeExpectancy: Number(formData.lifeExpectancy),
        retirementAge: Number(formData.retirementAge),
        income: { salary: 0, bonus: 0, reimbursements: 0, business: 0, rental: 0, investment: 0, expectedIncrease: 6 },
        monthlyExpenses: 0,
        iqScore: baselineIq
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#05070a] flex flex-col items-center justify-center p-6 selection:bg-indigo-900/30 overflow-hidden text-white font-sans">
      
      {/* HUD Layer - Only shown during onboarding */}
      {authStep === 'onboarding' && (
        <div className="max-w-xl w-full mb-16 flex items-center justify-between px-10 relative">
          <div className="absolute top-6 left-10 right-10 h-[1px] bg-white/10 -z-0" />
          <div className="absolute top-6 left-10 h-[1px] bg-indigo-500 -z-0 transition-all duration-1000 ease-in-out" style={{ width: `${(onboardingStep / (stepConfig.length - 1)) * 100}%` }} />
          
          {stepConfig.map((s, i) => (
            <div key={i} className="flex flex-col items-center relative z-10">
              <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all duration-700 ${
                onboardingStep >= i ? 'bg-indigo-600 text-white shadow-[0_0_30px_rgba(79,70,229,0.4)]' : 'bg-[#0f1218] text-slate-600 border border-white/5'
              }`}>
                <s.icon size={20} />
              </div>
              <span className={`text-[8px] font-black uppercase tracking-[0.2em] mt-4 transition-colors duration-500 ${
                onboardingStep >= i ? 'text-indigo-400' : 'text-slate-700'
              }`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-2xl w-full bg-[#0f1218]/80 backdrop-blur-2xl rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[150px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />
        
        <div className="p-12 md:p-20 text-left">
          
          {/* STEP 1: Identifier Entry */}
          {authStep === 'identifier' && (
            <div className="space-y-12 animate-in fade-in zoom-in-95 duration-700">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-3 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
                  <ShieldCheck size={14}/> System Gateway
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none">Access <br/><span className="text-indigo-500">Terminal.</span></h1>
                <p className="text-slate-500 font-medium text-lg leading-relaxed">Enter your identifier to establish a node connection.</p>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] ml-2">Email or Mobile</label>
                  <input 
                    type="text" 
                    placeholder="ravindra@wealth.terminal"
                    className="w-full px-10 py-7 bg-white/5 border border-white/10 rounded-[2.5rem] focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600/50 outline-none font-black text-2xl transition-all placeholder:text-white/10"
                    value={formData.identifier}
                    onChange={e => setFormData({...formData, identifier: e.target.value})}
                  />
                </div>
                <button onClick={handleProceedIdentifier} className="w-full py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-4 group">
                  Proceed <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Signup Form */}
          {authStep === 'signup' && (
            <div className="space-y-8 animate-in slide-in-from-right-8 duration-700">
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setAuthStep('identifier')} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10"><ArrowLeft size={20}/></button>
                <div className="inline-flex items-center gap-3 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-emerald-500/20">
                  <Zap size={14}/> New Node Detection
                </div>
              </div>
              <h1 className="text-4xl font-black tracking-tighter">Initialize <span className="text-indigo-500">Identity.</span></h1>
              
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm font-bold">
                  <AlertCircle size={18}/> {error}
                </div>
              )}

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="First Name" className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-[1.75rem] font-black text-lg outline-none" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  <input type="text" placeholder="Last Name" className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-[1.75rem] font-black text-lg outline-none" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700" size={20} />
                  <input type="password" placeholder="Choose Access Key" className="w-full pl-16 pr-8 py-5 bg-white/5 border border-white/10 rounded-[1.75rem] font-black text-lg outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
                <div className="relative">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700" size={20} />
                  <input type="password" placeholder="Confirm Access Key" className="w-full pl-16 pr-8 py-5 bg-white/5 border border-white/10 rounded-[1.75rem] font-black text-lg outline-none" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                </div>
                <button onClick={handleSignup} disabled={isProcessing} className="w-full py-7 bg-indigo-600 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-4">
                  {isProcessing ? "Allocating Resources..." : "Initialize Terminal"} <ChevronRight size={24} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Login Form */}
          {authStep === 'login' && (
            <div className="space-y-10 animate-in slide-in-from-right-8 duration-700">
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setAuthStep('identifier')} className="p-3 bg-white/5 rounded-2xl hover:bg-white/10"><ArrowLeft size={20}/></button>
                <div className="inline-flex items-center gap-3 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
                  <ShieldCheck size={14}/> Recognized Node
                </div>
              </div>
              <h1 className="text-4xl font-black tracking-tighter">Welcome Back, <br/><span className="text-indigo-500">Strategist.</span></h1>
              
              {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm font-bold">
                  <AlertCircle size={18}/> {error}
                </div>
              )}

              <div className="space-y-6">
                <div className="relative">
                  <Key className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700" size={20} />
                  <input 
                    type="password" 
                    placeholder="Enter Access Key" 
                    className="w-full pl-16 pr-8 py-6 bg-white/5 border border-white/10 rounded-[2rem] font-black text-xl outline-none" 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <button onClick={handleLogin} disabled={isProcessing} className="w-full py-8 bg-indigo-600 text-white rounded-[2.5rem] font-black text-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-4">
                  {isProcessing ? "Booting..." : "Access Terminal"} <ArrowRight size={24} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Onboarding Flow (Sequential) */}
          {authStep === 'onboarding' && (
            <div className="space-y-12">
              {onboardingStep === 0 && (
                <div className="space-y-10 animate-in slide-in-from-right-8 duration-700">
                  <h2 className="text-4xl font-black">Actuarial <span className="text-indigo-500">Horizon.</span></h2>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-4">Temporal Origin (DOB)</label>
                    <input type="date" className="w-full px-8 py-6 bg-white/5 border border-white/10 rounded-[2rem] font-black text-xl outline-none focus:border-indigo-600 transition-all text-indigo-400" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                  </div>
                  <button onClick={() => setOnboardingStep(1)} className="w-full py-7 bg-indigo-600 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-500 transition-all">Continue to Planning</button>
                </div>
              )}

              {onboardingStep === 1 && (
                <div className="space-y-12 animate-in slide-in-from-right-8 duration-700">
                  <h2 className="text-4xl font-black text-indigo-500">Time Vector.</h2>
                  <div className="space-y-10">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Life Expectancy</label><span className="text-3xl font-black text-indigo-500">{formData.lifeExpectancy} <span className="text-[10px] font-bold text-slate-600 uppercase">Yrs</span></span></div>
                      <input type="range" min="60" max="100" className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-600" value={formData.lifeExpectancy} onChange={e => setFormData({...formData, lifeExpectancy: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Retirement Protocol</label><span className="text-3xl font-black text-emerald-500">{formData.retirementAge} <span className="text-[10px] font-bold text-slate-600 uppercase">Yrs</span></span></div>
                      <input type="range" min="30" max="80" className="w-full h-1 bg-white/10 rounded-full appearance-none accent-emerald-500" value={formData.retirementAge} onChange={e => setFormData({...formData, retirementAge: Number(e.target.value)})} />
                    </div>
                  </div>
                  <button onClick={() => setOnboardingStep(2)} className="w-full py-7 bg-indigo-600 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-500 transition-all">Geospatial Sync</button>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-12 animate-in slide-in-from-right-8 duration-700">
                   <h2 className="text-4xl font-black">Global <span className="text-indigo-500">Node.</span></h2>
                   <div className="space-y-8">
                    <input type="text" placeholder="Zip / Pin Code" className="w-full px-10 py-7 bg-white/5 border border-white/10 rounded-[2.5rem] font-black text-3xl outline-none focus:border-indigo-600 transition-all text-indigo-400 placeholder:text-white/5" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
                    <div className="grid grid-cols-2 gap-6">
                      <input type="text" placeholder="City" className="w-full px-8 py-6 bg-white/5 border border-white/10 rounded-[2rem] font-black text-xl outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                      <input type="text" placeholder="State" className="w-full px-8 py-6 bg-white/5 border border-white/10 rounded-[2rem] font-black text-xl outline-none" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                    </div>
                  </div>
                  <button onClick={() => setOnboardingStep(3)} className="w-full py-7 bg-indigo-600 text-white rounded-[2rem] font-black text-xl hover:bg-indigo-500 transition-all">Finalize Intelligence</button>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="text-center space-y-12 animate-in zoom-in-95 duration-1000">
                  <div className="relative mx-auto w-64 h-64">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] animate-pulse" />
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-white/5" />
                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="283" strokeDashoffset={283 - (283 * baselineIq) / 100} className="text-indigo-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-7xl font-black tracking-tighter text-white">{baselineIq}</span>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Digital IQ</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">Sync Successful.</h3>
                    <p className="text-slate-500 font-medium text-lg leading-relaxed px-8">
                      Welcome, <span className="text-white">{formData.firstName}</span>. Your baseline IQ of <span className="text-indigo-400 font-black">{baselineIq}</span> suggests high wealth velocity potential.
                    </p>
                  </div>

                  <button onClick={handleFinishOnboarding} className="w-full py-10 bg-white text-slate-950 rounded-[3rem] font-black text-2xl hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-[0.98] flex items-center justify-center gap-6 group">Access Master Terminal <ArrowRight size={32} className="group-hover:translate-x-3 transition-transform" /></button>
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
