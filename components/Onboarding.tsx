
import React, { useState, useMemo } from 'react';
import { FinanceState, IncomeSource } from '../types';
import { 
  CheckCircle2, ArrowRight, User, MapPin, ShieldCheck,
  TrendingUp, Zap, ChevronRight, BrainCircuit, 
  Lock, Key, AlertCircle, ArrowLeft
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

  const handleSignup = () => {
    if (formData.password.length < 8) {
      setError("Min 8 characters required.");
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
    setTimeout(() => {
      saveMockUser(formData.identifier, { 
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName
      });
      setAuthStep('onboarding');
      setIsProcessing(false);
      setError(null);
    }, 1000);
  };

  const handleLogin = () => {
    const users = getMockUsers();
    const user = users[formData.identifier];
    if (user && user.password === formData.password) {
      setIsProcessing(true);
      setTimeout(() => {
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
    return new Date().getFullYear() - birthDate.getFullYear();
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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-indigo-100 overflow-x-hidden text-slate-900 font-sans">
      
      {/* Steps HUD */}
      {authStep === 'onboarding' && (
        <div className="max-w-md w-full mb-6 sm:mb-10 flex items-center justify-between px-6 relative">
          <div className="absolute top-5 left-6 right-6 h-[2px] bg-slate-200 -z-0" />
          <div className="absolute top-5 left-6 h-[2px] bg-indigo-600 -z-0 transition-all duration-1000 ease-in-out" style={{ width: `${(onboardingStep / (stepConfig.length - 1)) * 100}%` }} />
          
          {stepConfig.map((s, i) => (
            <div key={i} className="flex flex-col items-center relative z-10">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700 ${
                onboardingStep >= i ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-400 border border-slate-200'
              }`}>
                <s.icon size={16} />
              </div>
              <span className={`text-[7px] font-black uppercase tracking-[0.1em] mt-2 transition-colors duration-500 ${
                onboardingStep >= i ? 'text-indigo-600' : 'text-slate-400'
              }`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-xl w-full bg-white rounded-[2.5rem] sm:rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 blur-[100px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />
        
        <div className="p-8 sm:p-12 lg:p-14 text-left">
          
          {/* STEP 1: Identifier Entry */}
          {authStep === 'identifier' && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                  <ShieldCheck size={12}/> System Gateway
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tighter leading-none text-slate-950">Access <br/><span className="text-indigo-600">Terminal.</span></h1>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">Enter your email or mobile to establish a secure connection.</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email or Mobile</label>
                  <input 
                    type="text" 
                    placeholder="ravindra@wealth.terminal"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none font-bold text-base transition-all placeholder:text-slate-300"
                    value={formData.identifier}
                    onChange={e => setFormData({...formData, identifier: e.target.value})}
                  />
                </div>
                <button onClick={handleProceedIdentifier} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-indigo-100">
                  Proceed <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Signup Form */}
          {authStep === 'signup' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3">
                <button onClick={() => setAuthStep('identifier')} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><ArrowLeft size={16}/></button>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                  <Zap size={12}/> New Identity
                </div>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-950">Initialize <span className="text-indigo-600">Node.</span></h1>
              
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                  <AlertCircle size={14}/> {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                    <input type="text" placeholder="John" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-indigo-600" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                    <input type="text" placeholder="Doe" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-indigo-600" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Choose Key</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="password" placeholder="Min 8 characters" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-indigo-600" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Key</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="password" placeholder="Repeat key" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-indigo-600" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                  </div>
                </div>
                <button onClick={handleSignup} disabled={isProcessing} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                  {isProcessing ? "Processing..." : "Deploy Identity"} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Login Form */}
          {authStep === 'login' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3">
                <button onClick={() => setAuthStep('identifier')} className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><ArrowLeft size={16}/></button>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                  <ShieldCheck size={12}/> Recognized Node
                </div>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-950">Welcome back, <br/><span className="text-indigo-600">Strategist.</span></h1>
              
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-bold">
                  <AlertCircle size={14}/> {error}
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Key</label>
                  <div className="relative">
                    <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-indigo-600" 
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>
                <button onClick={handleLogin} disabled={isProcessing} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                  {isProcessing ? "Authenticating..." : "Access Terminal"} <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Onboarding Flow */}
          {authStep === 'onboarding' && (
            <div className="space-y-8">
              {onboardingStep === 0 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-700">
                  <h2 className="text-3xl font-black tracking-tight text-slate-950">Actuarial <span className="text-indigo-600">Horizon.</span></h2>
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Temporal Origin (DOB)</label>
                    <input type="date" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-indigo-600 transition-all text-indigo-600" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                  </div>
                  <button onClick={() => setOnboardingStep(1)} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all">Next Phase</button>
                </div>
              )}

              {onboardingStep === 1 && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-700">
                  <h2 className="text-3xl font-black text-indigo-600 tracking-tight">Time Vector.</h2>
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Life Span</label><span className="text-2xl font-black text-indigo-600">{formData.lifeExpectancy} <span className="text-[8px] font-bold text-slate-400 uppercase">Yrs</span></span></div>
                      <input type="range" min="60" max="100" className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-indigo-600 cursor-pointer" value={formData.lifeExpectancy} onChange={e => setFormData({...formData, lifeExpectancy: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Retirement Node</label><span className="text-2xl font-black text-emerald-600">{formData.retirementAge} <span className="text-[8px] font-bold text-slate-400 uppercase">Yrs</span></span></div>
                      <input type="range" min="30" max="80" className="w-full h-1.5 bg-slate-100 rounded-full appearance-none accent-emerald-500 cursor-pointer" value={formData.retirementAge} onChange={e => setFormData({...formData, retirementAge: Number(e.target.value)})} />
                    </div>
                  </div>
                  <button onClick={() => setOnboardingStep(2)} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all">Geospatial Sync</button>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-700">
                   <h2 className="text-3xl font-black tracking-tight text-slate-950">Global <span className="text-indigo-600">Node.</span></h2>
                   <div className="space-y-5">
                    <input type="text" placeholder="Zip / Pin Code" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-base outline-none focus:border-indigo-600 text-indigo-600" value={formData.pincode} onChange={e => setFormData({...formData, pincode: e.target.value})} />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="City" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-600" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                      <input type="text" placeholder="State" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-600" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                    </div>
                  </div>
                  <button onClick={() => setOnboardingStep(3)} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all">Compute IQ</button>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="text-center space-y-8 animate-in zoom-in-95 duration-1000">
                  <div className="relative mx-auto w-44 h-44 sm:w-52 sm:h-52">
                    <div className="absolute inset-0 bg-indigo-50 blur-[50px] animate-pulse" />
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-100" />
                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray="283" strokeDashoffset={283 - (283 * baselineIq) / 100} className="text-indigo-600 transition-all duration-1000 ease-out" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl sm:text-5xl font-black tracking-tighter text-slate-900">{baselineIq}</span>
                        <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">Digital IQ</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-950 tracking-tighter leading-none">Sync Successful.</h3>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                      Welcome, <span className="text-indigo-600 font-bold">{formData.firstName}</span>. System readiness is nominal.
                    </p>
                  </div>

                  <button onClick={handleFinishOnboarding} className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 group">Enter Terminal <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></button>
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
